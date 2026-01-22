"""
WebRTC Service for Jetson (Story 1)

Jetson에서 WebRTC 영상 송출을 담당하는 서비스 모듈
- start(room_id): 송출 시작
- stop(): 송출 중지
- status(): 현재 상태 조회

GStreamer 파이프라인 + GLib MainLoop를 별도 스레드로 구동
시그널링(offer/answer/candidate WS)은 Story 2에서 연결 예정
"""

import threading
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Callable

import gi
gi.require_version("Gst", "1.0")
gi.require_version("GstWebRTC", "1.0")
from gi.repository import Gst, GLib

logger = logging.getLogger(__name__)


class WebRTCState(str, Enum):
    """WebRTC 서비스 상태"""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    ERROR = "error"


@dataclass
class WebRTCConfig:
    """WebRTC 파이프라인 설정"""
    device: str = "/dev/video0"
    width: int = 640
    height: int = 480
    fps: int = 30
    bitrate_kbps: int = 1200
    keyint: int = 30
    stun_server: str = "stun://stun.l.google.com:19302"


class WebRTCService:
    """
    Jetson WebRTC 송출 서비스 (Story 1)
    
    - start(room_id), stop(), status()
    - 내부적으로 GStreamer 파이프라인 + GLib MainLoop를 별도 스레드로 구동
    - 중복 start/stop 호출 방어
    """

    def __init__(
        self,
        config: Optional[WebRTCConfig] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ):
        """
        Args:
            config: WebRTC 파이프라인 설정 (기본값 사용 가능)
            on_error: 에러 발생 시 호출될 콜백 함수
        """
        self.config = config or WebRTCConfig()
        self._on_error = on_error

        self._state: WebRTCState = WebRTCState.STOPPED
        self._state_reason: str = ""

        self._lock = threading.RLock()
        self._loop: Optional[GLib.MainLoop] = None
        self._loop_thread: Optional[threading.Thread] = None

        self._pipeline: Optional[Gst.Pipeline] = None
        self._bus_watch_id: Optional[int] = None

        # room_id는 Story 2에서 시그널링 연결 시 사용
        self._room_id: Optional[str] = None

        Gst.init(None)

    def status(self) -> dict:
        """
        현재 WebRTC 서비스 상태 조회
        
        Returns:
            dict: state, reason, room_id 포함
        """
        with self._lock:
            return {
                "state": self._state.value,
                "reason": self._state_reason,
                "room_id": self._room_id,
            }

    def start(self, room_id: str) -> None:
        """
        WebRTC 송출 시작
        
        Args:
            room_id: 참여할 방 ID (시그널링 서버에서 사용)
        """
        with self._lock:
            # 중복 시작 방어
            if self._state in (WebRTCState.STARTING, WebRTCState.RUNNING):
                logger.info("webrtc already started: %s", self._state.value)
                return

            self._room_id = room_id
            self._set_state(WebRTCState.STARTING, "starting")

            # GLib MainLoop를 별도 스레드에서 실행
            self._loop = GLib.MainLoop()
            self._loop_thread = threading.Thread(target=self._run_loop, daemon=True)
            self._loop_thread.start()

            # 파이프라인 생성/재생은 GLib 스레드에서 처리 (스레드 안정성)
            GLib.idle_add(self._build_and_play_pipeline)

    def stop(self) -> None:
        """
        WebRTC 송출 중지
        파이프라인을 안전하게 종료하고 자원 회수
        """
        with self._lock:
            # 중복 중지 방어
            if self._state == WebRTCState.STOPPED:
                logger.info("webrtc already stopped")
                return

            # 파이프라인 정리도 GLib 스레드에서 처리
            if self._loop is not None:
                GLib.idle_add(self._stop_pipeline_and_quit_loop)
            else:
                # 루프가 없으면 직접 정리
                self._cleanup_pipeline()
                self._set_state(WebRTCState.STOPPED, "stopped")

    def _run_loop(self) -> None:
        """GLib MainLoop 실행 (별도 스레드)"""
        try:
            assert self._loop is not None
            self._loop.run()
        except Exception as e:
            self._set_state(WebRTCState.ERROR, f"mainloop error: {e}")
        finally:
            # 루프 종료 후 정리
            self._cleanup_pipeline()
            self._room_id = None
            if self._state != WebRTCState.ERROR:
                self._set_state(WebRTCState.STOPPED, "stopped")

    def _build_and_play_pipeline(self) -> bool:
        """
        파이프라인 생성 및 PLAYING 상태로 전환
        GLib thread context에서 호출됨
        """
        try:
            self._pipeline = self._build_pipeline()
            bus = self._pipeline.get_bus()
            bus.add_signal_watch()
            self._bus_watch_id = bus.connect("message", self._on_bus_message)

            ret = self._pipeline.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                raise RuntimeError("failed to set pipeline PLAYING")

            self._set_state(WebRTCState.RUNNING, "playing")
            logger.info("webrtc pipeline PLAYING for room: %s", self._room_id)
        except Exception as e:
            self._set_state(WebRTCState.ERROR, str(e))
            self._notify_error(str(e))
            # 에러 시 루프 종료
            self._stop_pipeline_and_quit_loop()
        return False  # idle_add: one-shot

    def _stop_pipeline_and_quit_loop(self) -> bool:
        """
        파이프라인 정리 및 MainLoop 종료
        GLib thread context에서 호출됨
        """
        try:
            self._cleanup_pipeline()
        finally:
            if self._loop is not None and self._loop.is_running():
                self._loop.quit()
        return False  # idle_add: one-shot

    def _cleanup_pipeline(self) -> None:
        """
        파이프라인 자원 정리
        어느 스레드에서든 호출 가능 (락으로 보호됨)
        """
        with self._lock:
            if self._pipeline is not None:
                try:
                    self._pipeline.set_state(Gst.State.NULL)
                except Exception:
                    pass

                try:
                    bus = self._pipeline.get_bus()
                    if bus is not None:
                        try:
                            bus.remove_signal_watch()
                        except Exception:
                            pass
                except Exception:
                    pass

                self._pipeline = None
                self._bus_watch_id = None
                logger.info("webrtc pipeline cleaned up")

    def _on_bus_message(self, bus: Gst.Bus, message: Gst.Message) -> None:
        """GStreamer 버스 메시지 핸들러"""
        t = message.type

        if t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            msg = f"Gst ERROR: {err.message}"
            if debug:
                msg += f" | Debug: {debug}"
            logger.error(msg)
            self._set_state(WebRTCState.ERROR, msg)
            self._notify_error(msg)
            self.stop()

        elif t == Gst.MessageType.STATE_CHANGED:
            if message.src == self._pipeline:
                old, new, pending = message.parse_state_changed()
                logger.debug("Pipeline state: %s -> %s", old.value_nick, new.value_nick)

        elif t == Gst.MessageType.EOS:
            logger.warning("Gst EOS received")
            self.stop()

    def _build_pipeline(self) -> Gst.Pipeline:
        """
        GStreamer 파이프라인 구성
        
        Story 1: 파이프라인 생성 + webrtcbin까지 링크
        시그널링(offer/answer/candidate WS)은 Story 2에서 연결
        
        파이프라인 구조:
        v4l2src -> capsfilter -> videoconvert -> x264enc -> rtph264pay -> capsfilter -> queue -> webrtcbin
        """
        cfg = self.config

        pipeline = Gst.Pipeline.new("webrtc-pipeline")

        # 요소 생성
        v4l2src = Gst.ElementFactory.make("v4l2src", "src")
        caps = Gst.ElementFactory.make("capsfilter", "caps")
        conv = Gst.ElementFactory.make("videoconvert", "conv")
        x264 = Gst.ElementFactory.make("x264enc", "enc")
        pay = Gst.ElementFactory.make("rtph264pay", "pay")
        rtpcaps = Gst.ElementFactory.make("capsfilter", "rtpcaps")
        q = Gst.ElementFactory.make("queue", "q")
        webrtc = Gst.ElementFactory.make("webrtcbin", "webrtc")

        if not all([v4l2src, caps, conv, x264, pay, rtpcaps, q, webrtc]):
            raise RuntimeError("missing gstreamer elements (check plugins)")

        # 소스 설정
        v4l2src.set_property("device", cfg.device)

        # 비디오 캡처 caps
        caps.set_property(
            "caps",
            Gst.Caps.from_string(
                f"video/x-raw,width={cfg.width},height={cfg.height},framerate={cfg.fps}/1"
            ),
        )

        # 인코더 설정 (저지연)
        x264.set_property("tune", "zerolatency")
        x264.set_property("speed-preset", "veryfast")
        x264.set_property("bitrate", cfg.bitrate_kbps)
        x264.set_property("key-int-max", cfg.keyint)

        # RTP 페이로더 설정
        pay.set_property("config-interval", 1)
        pay.set_property("pt", 96)

        # RTP caps
        rtpcaps.set_property(
            "caps",
            Gst.Caps.from_string("application/x-rtp,media=video,encoding-name=H264,payload=96"),
        )

        # STUN 서버 설정
        webrtc.set_property("stun-server", cfg.stun_server)

        # 파이프라인에 요소 추가
        for e in [v4l2src, caps, conv, x264, pay, rtpcaps, q, webrtc]:
            pipeline.add(e)

        # 요소 연결 (v4l2src -> ... -> queue) - 하나씩 link
        elements = [v4l2src, caps, conv, x264, pay, rtpcaps, q]
        for i in range(len(elements) - 1):
            if not elements[i].link(elements[i + 1]):
                raise RuntimeError(f"failed to link {elements[i].get_name()} -> {elements[i+1].get_name()}")

        # queue -> webrtcbin 연결 (request pad 사용)
        q_src = q.get_static_pad("src")
        if q_src is None:
            raise RuntimeError("queue src pad not found")

        sinkpad = webrtc.request_pad_simple("sink_%u")
        if sinkpad is None:
            raise RuntimeError("failed to request webrtcbin sink pad from 'sink_%u'")

        if q_src.link(sinkpad) != Gst.PadLinkReturn.OK:
            raise RuntimeError("failed to link queue -> webrtcbin request pad")

        logger.info("webrtc pipeline built successfully")
        return pipeline

    def _set_state(self, state: WebRTCState, reason: str) -> None:
        """내부 상태 설정"""
        with self._lock:
            self._state = state
            self._state_reason = reason
            logger.info("webrtc state: %s (%s)", state.value, reason)

    def _notify_error(self, msg: str) -> None:
        """에러 콜백 호출"""
        try:
            if self._on_error:
                self._on_error(msg)
        except Exception:
            pass


# 싱글톤 인스턴스 (mqtt_service와 동일한 패턴)
webrtc_service = WebRTCService()
