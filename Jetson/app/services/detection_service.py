import logging
import json
from datetime import datetime
import time
import threading
import os
import cv2
from app.services.mqtt_service import mqtt_service
from app.services.storage_service import storage_service
from app.services.yolo_service import yolo_service
from app.services.detection_ws_service import detection_ws_service
from app.services.camera_service import camera_service
from app.core.config import settings

# ffmpeg는 선택적 의존성 (없으면 영상 변환 스킵)
try:
    import ffmpeg
except ImportError:
    ffmpeg = None
    logging.warning("ffmpeg-python 모듈이 없습니다. 영상 변환이 스킵됩니다. 'pip install ffmpeg-python'으로 설치하세요.")

logger = logging.getLogger(__name__)

class DetectionService:
    def __init__(self):
        self.is_monitoring = False
        self.is_recording = False
        self.record_start_time = None
        self.current_video_path = None
        
        # Detection 쿨다운 (연속 이벤트 방지)
        self._last_detection_time = 0
        self._detection_cooldown = 20.0  # 20초 쿨다운
        
        # bbox persistence (탐지 없을 때도 잠시 유지)
        self._last_detections = []
        self._last_detections_time = 0
        self._bbox_persistence_sec = 1.0  # 1초간 유지

        # 프레임 설정 (CameraService에서 검색)
        self.writer = None
        
        # 저장 경로 설정
        self.base_dir = "data"
        self.screenshot_dir = os.path.join(self.base_dir, "screenshots")
        self.video_dir = os.path.join(self.base_dir, "videos")
        
        for d in [self.screenshot_dir, self.video_dir]:
            if not os.path.exists(d):
                os.makedirs(d)

    def start_monitoring(self):
        """Detection 모니터링 시작 (CameraService가 이미 시작되어 있어야 함)"""
        if not camera_service.is_running:
            logger.error("❌ CameraService가 실행 중이 아닙니다. 먼저 camera_service.start() 호출 필요.")
            return
        
        self.is_monitoring = True
        logger.info("🐛 Detection monitoring started (using CameraService)")

    def stop_monitoring(self):
        """모니터링 중지"""
        self.is_monitoring = False
        if self.is_recording:
            self._stop_recording()
        logger.info("🛑 Detection monitoring stopped.")

    def process_frame(self):
        """CameraService에서 프레임을 가져와 YOLO 탐지 수행. bbox는 WebSocket으로 스트리밍."""
        if not self.is_monitoring:
            return None

        frame = camera_service.get_frame()
        if frame is None:
            return None

        # 1. YOLO 추론 (매 프레임)
        detections = yolo_service.detect(frame)
        current_time = time.time()
        
        # 2. bbox persistence: 탐지가 있으면 저장, 없으면 마지막 결과를 잠시 유지
        if detections:
            self._last_detections = detections
            self._last_detections_time = current_time
        elif current_time - self._last_detections_time < self._bbox_persistence_sec:
            # 마지막 탐지 후 1초 이내면 이전 결과 유지
            detections = self._last_detections
        else:
            # 1초 지나면 빈 배열
            self._last_detections = []
        
        # 3. WebSocket으로 bbox 실시간 스트리밍
        detection_ws_service.send_detections(
            detections,
            frame_width=camera_service.width,
            frame_height=camera_service.height
        )
        
        # 4. 추적 모드일 때 cmd_vel 계산 및 Pi로 전송 (tracking_service 연동)
        # import를 여기서 하는 이유: circular import 방지
        from app.services.tracking_service import tracking_service
        
        if tracking_service.is_tracking() and detections:
            tracking_service.process_detection(
                detections,
                frame_width=camera_service.width,
                frame_height=camera_service.height
            )
        
        # 5. 탐지가 있고, 녹화 중이 아니며, 쿨다운이 지났을 때만 이벤트 발생
        if detections and not self.is_recording:
            if current_time - self._last_detection_time > self._detection_cooldown:
                self._last_detection_time = current_time
                return self._handle_detection_event(frame, detections)

        return None
    
    def _handle_detection_event(self, frame, detections: list[dict]):
        """탐지 이벤트 처리: 스크린샷, 녹화, MQTT 발행 (백그라운드에서 실행)"""
        
        if self.is_recording:
            logger.warning("⚠️ 녹화 중이므로 이벤트를 처리하지 않습니다.")
            return

        self.is_recording = True

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # 가장 높은 신뢰도의 탐지 결과 사용
        top_detection = max(detections, key=lambda x: x['confidence'])

        # 스크린샷 저장 (빠르게 완료)
        screenshot_path = os.path.join(self.screenshot_dir, f"detect_{timestamp}.jpg")
        cv2.imwrite(screenshot_path, frame)
        logger.info(f"📸 [SCREENSHOT] Saved: {screenshot_path}")
        
        # 녹화+업로드+MQTT발행은 별도 스레드에서 처리 (detection 루프 blocking 방지)

        thread = threading.Thread(
            target=self._background_recording_task,
            args=(timestamp, screenshot_path, top_detection, len(detections)),
            daemon=True
        )
        thread.start()
        
        return {"status": "recording_started", "label": top_detection['label']}
    
    def _background_recording_task(self, timestamp: str, screenshot_path: str, top_detection: dict, detection_count: int):
        """백그라운드에서 녹화, 업로드, MQTT 발행 수행"""
        try:
            # 녹화 (5초)
            video_url = self._start_recording(timestamp)
            
            # 클라우드 업로드
            screenshot_url = storage_service.upload_file(screenshot_path)

            detection_data = {
                "timestamp": datetime.now().isoformat(),
                "object_type": top_detection['label'],
                "confidence": top_detection['confidence'],
                "bbox": top_detection['bbox'],
                "status": "detected",
                "robot_id": settings.ROBOT_ID,
                "screenshot_url": screenshot_url,
                "video_url": video_url,
                "detection_count": detection_count,
                "note": "YOLO real-time detection"
            }
            
            self._publish_detection(detection_data)
            logger.info(f"🐛 [DETECTION EVENT] {top_detection['label']} (conf: {top_detection['confidence']})")
        except Exception as e:
            logger.error(f"❌ 백그라운드 녹화 태스크 에러: {e}")
        finally:
            self.is_recording = False

    def _start_recording(self, timestamp):
        """녹화 시작: CameraService에서 프레임을 가져와 5초간 기록"""
        file_path = os.path.join(self.video_dir, f"record_{timestamp}.mp4")
        self.current_video_path = file_path
        
        fps = 20.0
        frame_duration = 1.0 / fps
        frame_width = camera_service.width
        frame_height = camera_service.height
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(file_path, fourcc, fps, (frame_width, frame_height))
        logger.info(f"🎥 [RECORDING] 5초간 시작됨: {file_path}")
        
        frames_to_record = int(fps * 5)  # 5초 동안 필요한 총 프레임 수
        
        try:
            for _ in range(frames_to_record):
                loop_start = time.time()
                
                # CameraService에서 프레임 가져오기
                frame = camera_service.get_frame()
                if frame is None:
                    break
                
                # 크기 맞추기
                if frame.shape[1] != frame_width or frame.shape[0] != frame_height:
                    frame = cv2.resize(frame, (frame_width, frame_height))
                
                self.writer.write(frame)
                
                # FPS 유지
                elapsed = time.time() - loop_start
                wait_time = max(0, frame_duration - elapsed)
                time.sleep(wait_time)
            
            logger.info(f"✅ 5초 녹화 완료.")
        
        except Exception as e:
            logger.error(f"🔥 녹화 중 에러: {e}")
        finally:
            video_url = self._stop_recording()
        
        return video_url


    def _stop_recording(self):
        """녹화 중지 -> H.264 변환 -> 클라우드 업로드"""
        if self.writer:
            self.writer.release()
            self.writer = None
        
        time.sleep(1.0) # 파일 쓰기 완료 대기
        
        raw_path = self.current_video_path # mp4v로 저장된 원본 경로
        video_url = None

        if raw_path and os.path.exists(raw_path):
            # ffmpeg가 없으면 원본 파일을 바로 업로드
            if ffmpeg is None:
                logger.warning("ffmpeg 모듈이 없어 원본 파일을 업로드합니다.")
                video_url = storage_service.upload_file(raw_path)
                os.remove(raw_path)
            else:
                web_path = raw_path.replace(".mp4", "_web.mp4")
                retry_count = 3
                
                for attempt in range(retry_count + 1):
                    try:
                        logger.info(f"🔄 웹 재생용으로 변환 시작 (H.264), 시도 {attempt+1}/{retry_count+1}: {raw_path}")
                        
                        # FFmpeg를 이용한 H.264 변환
                        (
                            ffmpeg
                            .input(raw_path)
                            .output(web_path, vcodec='libx264', crf=28, preset='ultrafast')
                            .overwrite_output()
                            .run(capture_stdout=True, capture_stderr=True)
                        )

                        # 변환된 파일 확인 및 업로드
                        if os.path.exists(web_path) and os.path.getsize(web_path) > 0:
                            logger.info(f"✅ 변환 완료. 업로드 시도: {web_path}")
                            video_url = storage_service.upload_file(web_path)
                            
                            # 업로드 성공 시 원본 및 변환 파일 삭제 후 루프 종료
                            if video_url:
                                os.remove(raw_path)
                                os.remove(web_path)
                                break
                        else:
                            logger.error("변환된 파일이 생성되지 않았거나 비어있습니다.")

                    except Exception as e:
                        logger.error(f"❌ 시도 {attempt+1} 실패: {e}")
                        if attempt < retry_count:
                            logger.info("1초 후 재시도합니다...")
                            time.sleep(1)
                        else:
                            logger.error("❌ 모든 재시도 실패. 원본 업로드를 건너뜁니다.")

        self.current_video_path = None
        return video_url

    def _publish_detection(self, data):
        """탐지 결과를 MQTT로 발행"""
        topic = settings.TOPIC_DETECTION
        payload = json.dumps(data)
        mqtt_service.publish(topic, payload)

detection_service = DetectionService()
