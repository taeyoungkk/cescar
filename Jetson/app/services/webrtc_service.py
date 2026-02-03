"""
WebRTC Service for Jetson (Story 1 + Story 2)

Jetson에서 WebRTC 영상 송출을 담당하는 서비스 모듈
- start(room_id): 송출 시작 + 시그널링 서버 연결
- stop(): 송출 중지
- status(): 현재 상태 조회

GStreamer 파이프라인 + GLib MainLoop를 별도 스레드로 구동
WebSocket으로 Spring 시그널링 서버와 offer/answer/candidate 교환
"""

import json
import time
import threading
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Callable

import gi
gi.require_version("Gst", "1.0")
gi.require_version("GstWebRTC", "1.0")
gi.require_version("GstSdp", "1.0")
from gi.repository import Gst, GLib, GstWebRTC, GstSdp

import websocket
import numpy as np

from app.core.config import settings
from app.services.camera_service import camera_service

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
    width: int = 640
    height: int = 480
    fps: int = 30
    bitrate_kbps: int = 1200
    keyint: int = 30
    stun_server: str = "stun://stun.l.google.com:19302"
    # TURN 서버 설정 (Metered.ca Open Relay - 무료 공개 TURN)
    turn_server: str = "turn://openrelay.metered.ca:80"
    turn_username: str = "openrelayproject"
    turn_password: str = "openrelayproject"
    # 재연결 설정
    reconnect_enabled: bool = True
    reconnect_delay_sec: float = 3.0
    max_reconnect_attempts: int = 5


class WebRTCService:
    """
    Jetson WebRTC 송출 서비스 (Story 1 + Story 2)
    
    - start(room_id), stop(), status()
    - GStreamer 파이프라인 + GLib MainLoop
    - WebSocket 시그널링 (offer/answer/candidate)
    """

    def __init__(
        self,
        config: Optional[WebRTCConfig] = None,
        signaling_url: Optional[str] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ):
        """
        Args:
            config: WebRTC 파이프라인 설정 (기본값 사용 가능)
            signaling_url: 시그널링 서버 WebSocket URL (기본: settings.SIGNALING_WS_URL)
            on_error: 에러 발생 시 호출될 콜백 함수
        """
        self.config = config or WebRTCConfig()
        self.signaling_url = signaling_url or settings.SIGNALING_WS_URL
        self._on_error = on_error

        self._state: WebRTCState = WebRTCState.STOPPED
        self._state_reason: str = ""

        self._lock = threading.RLock()
        self._loop: Optional[GLib.MainLoop] = None
        self._loop_thread: Optional[threading.Thread] = None

        self._pipeline: Optional[Gst.Pipeline] = None
        self._webrtc: Optional[Gst.Element] = None
        self._bus_watch_id: Optional[int] = None

        # WebSocket 관련
        self._ws: Optional[websocket.WebSocketApp] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._ws_connected: bool = False

        self._room_id: Optional[str] = None
        
        # 협상 중 플래그 (무한 루프 방지)
        self._negotiating: bool = False
        # Viewer 준비 완료 플래그 (파이프라인 준비 전 도착 대비)
        self._viewer_ready: bool = False
        
        # 재시작 관련 (쿨다운/락)
        self._restart_in_progress: bool = False
        self._last_restart_ts: float = 0.0
        self._restart_cooldown_sec: float = 1.0  # 너무 연속으로 오면 1초 쿨다운

        # 재연결 관련
        self._reconnect_attempts: int = 0
        self._should_reconnect: bool = False
        self._reconnect_timer: Optional[threading.Timer] = None

        # appsrc for CameraService integration
        self._appsrc: Optional[Gst.Element] = None

        Gst.init(None)

    def status(self) -> dict:
        """현재 WebRTC 서비스 상태 조회"""
        with self._lock:
            return {
                "state": self._state.value,
                "reason": self._state_reason,
                "room_id": self._room_id,
                "ws_connected": self._ws_connected,
            }

    def start(self, room_id: str) -> None:
        """
        WebRTC 송출 시작
        1. WebSocket 연결
        2. GStreamer 파이프라인 시작
        3. offer 생성 및 전송
        """
        with self._lock:
            if self._state in (WebRTCState.STARTING, WebRTCState.RUNNING):
                logger.info("webrtc already started: %s", self._state.value)
                return

            self._room_id = room_id
            self._negotiating = False  # 협상 플래그 리셋
            
            # 재연결 설정
            self._should_reconnect = True
            self._reconnect_attempts = 0
            
            self._set_state(WebRTCState.STARTING, "connecting to signaling server")

            # 1. WebSocket 연결 (별도 스레드)
            self._start_websocket()

    def stop(self) -> None:
        """WebRTC 송출 중지"""
        with self._lock:
            if self._state == WebRTCState.STOPPED:
                logger.info("webrtc already stopped")
                return

            # 재연결 비활성화
            self._should_reconnect = False
            if self._reconnect_timer:
                self._reconnect_timer.cancel()
                self._reconnect_timer = None

            # WebSocket 종료
            self._stop_websocket()
            
            # 협상 플래그 리셋
            self._negotiating = False

            # 파이프라인 정리
            if self._loop is not None:
                GLib.idle_add(self._stop_pipeline_and_quit_loop)
            else:
                self._cleanup_pipeline()
                self._set_state(WebRTCState.STOPPED, "stopped")

    # ==================== WebSocket 관련 ====================

    def _start_websocket(self) -> None:
        """WebSocket 연결 시작"""
        def on_open(ws):
            logger.info("WebSocket connected to %s", self.signaling_url)
            self._ws_connected = True
            
            # join 메시지 전송
            join_msg = {
                "type": "join",
                "roomId": self._room_id
            }
            ws.send(json.dumps(join_msg))
            logger.info("Sent join message for room: %s", self._room_id)
            
            # GLib MainLoop 시작 + 파이프라인 생성
            self._loop = GLib.MainLoop()
            self._loop_thread = threading.Thread(target=self._run_loop, daemon=True)
            self._loop_thread.start()
            GLib.idle_add(self._build_and_play_pipeline)

        def on_message(ws, message):
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "answer":
                    self._handle_answer(data.get("data", {}))
                elif msg_type == "candidate":
                    self._handle_candidate(data.get("data", {}))
                elif msg_type == "ready":
                    # Viewer가 준비됨 → 새 offer 생성
                    self._handle_ready()
                else:
                    logger.debug("Received unknown message type: %s", msg_type)
            except Exception as e:
                logger.error("Error handling WS message: %s", e)

        def on_error(ws, error):
            logger.error("WebSocket error: %s", error)
            self._ws_connected = False
            self._set_state(WebRTCState.ERROR, f"WebSocket error: {error}")
            self._notify_error(str(error))

        def on_close(ws, close_status_code, close_msg):
            logger.warning("WebSocket closed: %s %s", close_status_code, close_msg)
            self._ws_connected = False
            
            # 자동 재연결 시도
            if self._should_reconnect and self.config.reconnect_enabled:
                self._schedule_reconnect()

        self._ws = websocket.WebSocketApp(
            self.signaling_url,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
        )
        
        self._ws_thread = threading.Thread(target=self._ws.run_forever, daemon=True)
        self._ws_thread.start()

    def _schedule_reconnect(self) -> None:
        """재연결 스케줄링"""
        if self._reconnect_attempts >= self.config.max_reconnect_attempts:
            logger.error("Max reconnect attempts (%d) reached, giving up", 
                        self.config.max_reconnect_attempts)
            self._set_state(WebRTCState.ERROR, "reconnect failed - max attempts reached")
            self._should_reconnect = False
            return
        
        self._reconnect_attempts += 1
        delay = self.config.reconnect_delay_sec
        logger.info("Scheduling reconnect in %.1fs (attempt %d/%d)", 
                   delay, self._reconnect_attempts, self.config.max_reconnect_attempts)
        
        self._set_state(WebRTCState.STARTING, f"reconnecting (attempt {self._reconnect_attempts})")
        
        self._reconnect_timer = threading.Timer(delay, self._do_reconnect)
        self._reconnect_timer.daemon = True
        self._reconnect_timer.start()

    def _do_reconnect(self) -> None:
        """재연결 수행"""
        if not self._should_reconnect:
            logger.debug("Reconnect cancelled")
            return
        
        logger.info("Attempting reconnect...")
        
        # 기존 리소스 정리 (stop 호출 안 하고 직접 정리)
        self._cleanup_for_reconnect()
        
        # 다시 시작
        self._start_websocket()

    def _cleanup_for_reconnect(self) -> None:
        """재연결을 위한 정리 (stop과 달리 reconnect 플래그 유지)"""
        # WebSocket 정리
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None
        self._ws_connected = False
        
        # 파이프라인 정리
        self._cleanup_pipeline()
        
        # 협상 플래그 리셋
        self._negotiating = False
        
        # MainLoop 정리
        if self._loop is not None and self._loop.is_running():
            self._loop.quit()
        self._loop = None

    def _stop_websocket(self) -> None:
        """WebSocket 연결 종료"""
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None
        self._ws_connected = False

    def _send_signaling(self, msg_type: str, data: dict) -> None:
        """시그널링 메시지 전송"""
        if self._ws is None or not self._ws_connected:
            logger.warning("WebSocket not connected, cannot send %s", msg_type)
            return
        
        message = {
            "type": msg_type,
            "roomId": self._room_id,
            "data": data,
        }
        try:
            self._ws.send(json.dumps(message))
            logger.debug("Sent %s message", msg_type)
        except Exception as e:
            logger.error("Failed to send %s: %s", msg_type, e)

    # ==================== WebRTC 시그널링 핸들러 ====================

    def _on_negotiation_needed(self, element) -> None:
        # Viewer의 ready 메시지로만 offer를 생성하도록 통일 (Race Condition 방지)
        logger.debug("on-negotiation-needed emitted, but waiting for viewer 'ready'")
        return

    def _create_offer(self) -> bool:
        """새 offer 생성 (ready 메시지 수신 시 호출)"""
        if self._webrtc is None:
            logger.warning("webrtcbin not available")
            return False
            
        if self._negotiating:
            logger.info("Already negotiating - skip create_offer")
            return False
        
        self._negotiating = True
        logger.info("Creating new offer for viewer...")
        promise = Gst.Promise.new_with_change_func(self._on_offer_created, self._webrtc, None)
        self._webrtc.emit("create-offer", None, promise)
        return False  # GLib.idle_add 콜백은 False 반환

    def _on_offer_created(self, promise, element, _) -> None:
        """offer 생성 완료 콜백"""
        promise.wait()
        reply = promise.get_reply()
        offer = reply.get_value("offer")
        
        if offer is None:
            logger.error("Failed to create offer")
            self._negotiating = False
            return
        
        # local description 설정
        promise_local = Gst.Promise.new()
        element.emit("set-local-description", offer, promise_local)
        promise_local.interrupt()
        
        # offer SDP를 시그널링 서버로 전송
        sdp_text = offer.sdp.as_text()
        self._send_signaling("offer", {"sdp": sdp_text, "type": "offer"})
        logger.info("Sent offer SDP")

    def _on_ice_candidate(self, element, mlineindex: int, candidate: str) -> None:
        """ICE candidate 발생 시 시그널링 서버로 전송"""
        self._send_signaling("candidate", {
            "candidate": candidate,
            "sdpMLineIndex": mlineindex,
        })
        logger.info("Sent ICE candidate: %s", candidate[:80] if candidate else "(empty)")

    def _on_ice_connection_state_change(self, element, prop) -> None:
        """ICE 연결 상태 변경 핸들러"""
        state = element.get_property("ice-connection-state")
        state_map = {
            0: "new",
            1: "checking",
            2: "connected",
            3: "completed",
            4: "failed",
            5: "disconnected",
            6: "closed",
        }
        state_name = state_map.get(state, f"unknown({state})")
        logger.info("🧊 ICE connection state: %s", state_name)
        
        if state == 4:  # failed
            logger.error("❌ ICE connection failed!")
            self._set_state(WebRTCState.ERROR, "ICE connection failed")
        elif state in (2, 3):  # connected or completed
            logger.info("✅ ICE connection established!")

    def _handle_answer(self, data: dict) -> None:
        """answer SDP 수신 처리"""
        sdp_text = data.get("sdp")
        if not sdp_text:
            logger.error("No SDP in answer")
            return
        
        logger.info("Received answer SDP")
        
        # SDP 파싱
        res, sdpmsg = GstSdp.SDPMessage.new()
        GstSdp.sdp_message_parse_buffer(bytes(sdp_text, "utf-8"), sdpmsg)
        answer = GstWebRTC.WebRTCSessionDescription.new(
            GstWebRTC.WebRTCSDPType.ANSWER, sdpmsg
        )
        
        # remote description 설정
        if self._webrtc:
            promise = Gst.Promise.new()
            self._webrtc.emit("set-remote-description", answer, promise)
            promise.interrupt()
            logger.info("Set remote description (answer)")
            
            # 협상 완료 - False로 변경하여 재시도/Renegotiation 허용
            self._negotiating = False

    def _handle_candidate(self, data: dict) -> None:
        """ICE candidate 수신 처리"""
        candidate = data.get("candidate")
        sdp_mline_index = data.get("sdpMLineIndex", 0)
        
        if candidate and self._webrtc:
            self._webrtc.emit("add-ice-candidate", sdp_mline_index, candidate)
            logger.info("Added remote ICE candidate: %s", candidate[:80] if candidate else "(empty)")

    def _handle_ready(self) -> None:
        """Viewer ready 메시지 처리 - 파이프라인 재시작 및 새 offer 생성"""
        logger.info("Received ready from viewer")
        self._viewer_ready = True
        
        if self._loop is None:
            logger.warning("MainLoop not running yet")
            return
            
        # ✅ ready가 오면 파이프라인을 fresh하게 재시작하고 offer를 새로 만든다
        GLib.idle_add(self._restart_pipeline_and_offer)

    # ==================== GStreamer 파이프라인 ====================

    def _restart_pipeline_and_offer(self) -> bool:
        """파이프라인 재시작 및 offer 생성 (GLib 스레드)"""
        now = time.time()
        if self._restart_in_progress:
            logger.info("Restart already in progress - skip")
            return False
        if now - self._last_restart_ts < self._restart_cooldown_sec:
            logger.info("Restart cooldown active - skip")
            return False

        self._restart_in_progress = True
        self._last_restart_ts = now
        # 이미 처리 중이므로 플래그 리셋 (중복 offer 방지)
        self._viewer_ready = False

        try:
            logger.info("Restarting WebRTC pipeline for fresh viewer session...")

            # 1) 기존 파이프라인 정리
            self._cleanup_pipeline()

            # 2) 새 파이프라인 생성
            self._pipeline, self._webrtc = self._build_pipeline()

            # 3) 시그널 연결
            self._webrtc.connect("on-negotiation-needed", self._on_negotiation_needed)
            self._webrtc.connect("on-ice-candidate", self._on_ice_candidate)
            self._webrtc.connect("notify::ice-connection-state", self._on_ice_connection_state_change)

            # 4) bus watch
            bus = self._pipeline.get_bus()
            bus.add_signal_watch()
            self._bus_watch_id = bus.connect("message", self._on_bus_message)

            # 5) PLAYING
            ret = self._pipeline.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                raise RuntimeError("failed to set pipeline PLAYING (restart)")

            self._set_state(WebRTCState.RUNNING, "playing")
            logger.info("Pipeline restarted and PLAYING - creating offer")

            # 6) 새 offer 생성
            self._negotiating = False
            GLib.idle_add(self._create_offer)

        except Exception as e:
            msg = f"restart failed: {e}"
            logger.error(msg)
            self._set_state(WebRTCState.ERROR, msg)
            self._notify_error(msg)
        finally:
            self._restart_in_progress = False

        return False

    def _run_loop(self) -> None:
        """GLib MainLoop 실행 (별도 스레드)"""
        try:
            assert self._loop is not None
            self._loop.run()
        except Exception as e:
            self._set_state(WebRTCState.ERROR, f"mainloop error: {e}")
        finally:
            self._cleanup_pipeline()
            # 재연결 중이 아닐 때만 room_id 초기화
            if not self._should_reconnect:
                self._room_id = None
            if self._state != WebRTCState.ERROR:
                self._set_state(WebRTCState.STOPPED, "stopped")

    def _build_and_play_pipeline(self) -> bool:
        """파이프라인 생성 및 PLAYING 상태로 전환"""
        try:
            self._pipeline, self._webrtc = self._build_pipeline()
            
            # webrtcbin 시그널 연결
            self._webrtc.connect("on-negotiation-needed", self._on_negotiation_needed)
            self._webrtc.connect("on-ice-candidate", self._on_ice_candidate)
            self._webrtc.connect("notify::ice-connection-state", self._on_ice_connection_state_change)
            
            bus = self._pipeline.get_bus()
            bus.add_signal_watch()
            self._bus_watch_id = bus.connect("message", self._on_bus_message)

            ret = self._pipeline.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                raise RuntimeError("failed to set pipeline PLAYING")

            self._set_state(WebRTCState.RUNNING, "playing")
            logger.info("webrtc pipeline PLAYING for room: %s", self._room_id)
            
            # 파이프라인이 준비되면 초기 Offer를 무조건 생성 (Viewer-First 상황 대응)
            logger.info("Pipeline ready -> creating initial offer")
            self._negotiating = False
            GLib.idle_add(self._create_offer)
        except Exception as e:
            self._set_state(WebRTCState.ERROR, str(e))
            self._notify_error(str(e))
            self._stop_pipeline_and_quit_loop()
        return False

    def _stop_pipeline_and_quit_loop(self) -> bool:
        """파이프라인 정리 및 MainLoop 종료"""
        try:
            self._cleanup_pipeline()
        finally:
            if self._loop is not None and self._loop.is_running():
                self._loop.quit()
        return False

    def _cleanup_pipeline(self) -> None:
        """파이프라인 자원 정리"""
        with self._lock:
            # CameraService 콜백 해제
            try:
                camera_service.unregister_callback(self._push_frame)
            except Exception:
                pass
            
            if self._pipeline is not None:
                try:
                    self._pipeline.set_state(Gst.State.NULL)
                except Exception:
                    pass

                try:
                    bus = self._pipeline.get_bus()
                    if bus is not None:
                        bus.remove_signal_watch()
                except Exception:
                    pass

                self._pipeline = None
                self._webrtc = None
                self._appsrc = None
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
            
            # 재연결 활성화 시 재시도, 아니면 완전 중지
            if self._should_reconnect and self.config.reconnect_enabled:
                self._schedule_reconnect()
            else:
                self.stop()

        elif t == Gst.MessageType.STATE_CHANGED:
            if message.src == self._pipeline:
                old, new, pending = message.parse_state_changed()
                logger.debug("Pipeline state: %s -> %s", old.value_nick, new.value_nick)

        elif t == Gst.MessageType.EOS:
            logger.warning("Gst EOS received")
            self.stop()

    def _build_pipeline(self) -> tuple:
        """
        GStreamer 파이프라인 구성 (appsrc 기반 - CameraService 연동)
        Returns: (pipeline, webrtcbin)
        """
        cfg = self.config

        pipeline = Gst.Pipeline.new("webrtc-pipeline")

        # 요소 생성
        appsrc = Gst.ElementFactory.make("appsrc", "src")
        conv = Gst.ElementFactory.make("videoconvert", "conv")
        i420caps = Gst.ElementFactory.make("capsfilter", "i420caps")
        encoder = Gst.ElementFactory.make("x264enc", "enc")
        pay = Gst.ElementFactory.make("rtph264pay", "pay")
        rtpcaps = Gst.ElementFactory.make("capsfilter", "rtpcaps")
        q = Gst.ElementFactory.make("queue", "q")
        webrtc = Gst.ElementFactory.make("webrtcbin", "webrtc")

        if not all([appsrc, conv, i420caps, encoder, pay, rtpcaps, q, webrtc]):
            raise RuntimeError("missing gstreamer elements (check plugins)")

        # appsrc 설정
        width = camera_service.width if camera_service.is_running else cfg.width
        height = camera_service.height if camera_service.is_running else cfg.height
        fps = camera_service.fps if camera_service.is_running else cfg.fps
        
        appsrc.set_property("caps", Gst.Caps.from_string(
            f"video/x-raw,format=BGR,width={width},height={height},framerate={fps}/1"
        ))
        appsrc.set_property("is-live", True)
        appsrc.set_property("format", 3)  # GST_FORMAT_TIME
        appsrc.set_property("do-timestamp", True)
        
        # appsrc 참조 저장
        self._appsrc = appsrc

        # I420 변환용 capsfilter
        i420caps.set_property(
            "caps",
            Gst.Caps.from_string("video/x-raw,format=I420"),
        )

        # x264enc 설정 (저지연)
        encoder.set_property("tune", "zerolatency")
        encoder.set_property("speed-preset", "ultrafast")
        encoder.set_property("bitrate", cfg.bitrate_kbps)
        encoder.set_property("key-int-max", cfg.keyint)

        # RTP 페이로더 설정
        pay.set_property("config-interval", 1)
        pay.set_property("pt", 96)
        pay.set_property("aggregate-mode", 1)  # zero-latency

        # RTP caps
        rtpcaps.set_property(
            "caps",
            Gst.Caps.from_string("application/x-rtp,media=video,encoding-name=H264,payload=96"),
        )

        # STUN 서버 설정
        webrtc.set_property("stun-server", cfg.stun_server)
        
        # TURN 서버 설정 (NAT/방화벽 통과를 위해 필요)
        # turn://username:password@host:port 형식도 가능하지만
        # GStreamer webrtcbin은 별도 property로 설정
        turn_uri = f"turn://{cfg.turn_username}:{cfg.turn_password}@openrelay.metered.ca:80"
        webrtc.set_property("turn-server", turn_uri)
        logger.info(f"ICE servers configured: STUN={cfg.stun_server}, TURN=openrelay.metered.ca:80")
        
        webrtc.set_property("bundle-policy", 3)  # max-bundle

        # 파이프라인에 요소 추가
        for e in [appsrc, conv, i420caps, encoder, pay, rtpcaps, q, webrtc]:
            pipeline.add(e)

        # 요소 연결
        elements = [appsrc, conv, i420caps, encoder, pay, rtpcaps, q]
        for i in range(len(elements) - 1):
            if not elements[i].link(elements[i + 1]):
                raise RuntimeError(f"failed to link {elements[i].get_name()} -> {elements[i+1].get_name()}")

        # queue -> webrtcbin 연결
        q_src = q.get_static_pad("src")
        if q_src is None:
            raise RuntimeError("queue src pad not found")

        sinkpad = webrtc.request_pad_simple("sink_%u")
        if sinkpad is None:
            raise RuntimeError("failed to request webrtcbin sink pad")

        if q_src.link(sinkpad) != Gst.PadLinkReturn.OK:
            raise RuntimeError("failed to link queue -> webrtcbin")

        # CameraService 콜백 등록
        camera_service.register_callback(self._push_frame)
        logger.info("webrtc pipeline built with appsrc (CameraService integration)")
        
        return pipeline, webrtc

    def _push_frame(self, frame: np.ndarray) -> None:
        """CameraService로부터 프레임을 받아 appsrc에 push"""
        if self._appsrc is None or self._state != WebRTCState.RUNNING:
            return
        
        try:
            # numpy array를 GStreamer buffer로 변환
            data = frame.tobytes()
            buf = Gst.Buffer.new_allocate(None, len(data), None)
            buf.fill(0, data)
            
            # appsrc에 push
            ret = self._appsrc.emit("push-buffer", buf)
            if ret != Gst.FlowReturn.OK:
                logger.warning("appsrc push-buffer returned: %s", ret)
        except Exception as e:
            logger.error("Failed to push frame to appsrc: %s", e)

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


# 싱글톤 인스턴스
webrtc_service = WebRTCService()
