import random
import logging
import json
from datetime import datetime
import os
import time
import cv2
from app.services.mqtt_service import mqtt_service
from app.services.storage_service import storage_service
from app.core.config import settings

logger = logging.getLogger(__name__)

class DetectionService:
    def __init__(self):
        # 1% 확률로 벌레가 탐지되도록 설정 (10FPS 기준 10초에 한 번 꼴)
        self.detection_probability = 0.01
        self.is_monitoring = False
        self.is_recording = False
        self.record_start_time = None
        self.current_video_path = None

        # OpenCV 관련
        self.cap = None
        self.writer = None
        self.frame_width = 640
        self.frame_height = 480
        
        # 저장 경로 설정
        self.base_dir = "data"
        self.screenshot_dir = os.path.join(self.base_dir, "screenshots")
        self.video_dir = os.path.join(self.base_dir, "videos")
        
        for d in [self.screenshot_dir, self.video_dir]:
            if not os.path.exists(d):
                os.makedirs(d)

    def start_monitoring(self):
        """카메라 스트림 모니터링을 시작합니다."""
        self.cap = cv2.VideoCapture(0)  # 기본 카메라 연결
        if not self.cap.isOpened():
            logger.error("❌ 카메라를 열 수 없습니다.")
            return

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
        
        self.is_monitoring = True
        logger.info("📸 Camera monitoring started using OpenCV.")

    def stop_monitoring(self):
        """모니터링 중지 및 자원 해제"""
        self.is_monitoring = False
        if self.is_recording:
            self._stop_recording()
            
        if self.cap:
            self.cap.release()
            self.cap = None
        logger.info("🛑 Camera monitoring stopped.")

    def process_frame(self):
        """카메라에서 프레임을 읽고 탐지 여부를 판단합니다."""
        if not self.is_monitoring or self.cap is None:
            return None

        ret, frame = self.cap.read()
        if not ret:
            logger.warning("⚠️ 프레임을 읽어오지 못했습니다.")
            return None

        # 2. 녹화 중이 아닐 때만 탐지 시뮬레이션 수행
        if random.random() < self.detection_probability:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # 스크린샷 저장
            screenshot_path = os.path.join(self.screenshot_dir, f"detect_{timestamp}.jpg")
            cv2.imwrite(screenshot_path, frame)
            logger.info(f"📸 [SCREENSHOT] Saved: {screenshot_path}")
            
            # 녹화 시작 의도적 blocking 시작 (10초)
            video_url = self._start_recording(frame, timestamp)
            
            # 클라우드 업로드
            screenshot_url = storage_service.upload_file(screenshot_path)

            detection_data = {
                "timestamp": datetime.now().isoformat(),
                "object_type": "insect",
                "confidence": round(random.uniform(0.85, 0.99), 2),
                "status": "detected",
                "robot_id": settings.ROBOT_ID,
                "screenshot_url": screenshot_url,
                "video_url": video_url,
                "note": "Real-time CV2 detection simulation"
            }
            
            self._publish_detection(detection_data)
            return detection_data

        return None

    def _start_recording(self, frame, timestamp):
        """녹화 시작"""
        file_path = os.path.join(self.video_dir, f"record_{timestamp}.mp4")
        self.current_video_path = file_path
        
        # VideoWriter 설정 (브라우저 호환성을 위해 H.264 계열 순차적 시도)
        success = False
        for codec in ['avc1', 'H264', 'X264']:
            fourcc = cv2.VideoWriter_fourcc(*codec)
            self.writer = cv2.VideoWriter(file_path, fourcc, 20.0, (self.frame_width, self.frame_height))
            if self.writer.isOpened():
                logger.info(f"✅ VideoWriter initialized with codec: {codec}")
                success = True
                break
        
        if not success:
            logger.warning("⚠️ H.264 코덱을 사용할 수 없어 mp4v로 대체합니다. (브라우저 재생이 안 될 수 있음)")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self.writer = cv2.VideoWriter(file_path, fourcc, 20.0, (self.frame_width, self.frame_height))
        start_time = time.time()
        logger.info(f"🎥 [RECORDING] Started: {file_path}")

        while time.time() - start_time < 10:
            ret, frame = self.cap.read()
            if not ret:
                break
            self.writer.write(frame)
        video_url = self._stop_recording()

        return video_url

    def _stop_recording(self):
        """녹화 중지 및 파일 업로드"""
        if self.writer:
            self.writer.release()
            self.writer = None
        
        # 파일이 물리적으로 디스크에 모두 쓰여질 때까지 아주 짧게 대기
        time.sleep(1.0)
        
        video_url = None

        logger.info(f"🛑 [RECORDING] Stopped: {self.current_video_path}")
        print("current_video_path", self.current_video_path)
        # 녹화 본 클라우드 업로드
        if self.current_video_path and os.path.exists(self.current_video_path) and os.path.getsize(self.current_video_path) > 0:
            video_url = storage_service.upload_file(self.current_video_path)
            if video_url:
                logger.info(f"✅ [CLOUD] Video upload confirmed: {video_url}")
        else:
            logger.error(f"❌ Video file is missing or empty: {self.current_video_path or 'Unknown path'}")

        self.current_video_path = None
        return video_url

    def _publish_detection(self, data):
        """탐지 결과를 MQTT로 발행"""
        topic = settings.TOPIC_DETECTION
        payload = json.dumps(data)
        mqtt_service.publish(topic, payload)

detection_service = DetectionService()
