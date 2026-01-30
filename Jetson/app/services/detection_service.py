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

logging.basicConfig(
    level=logging.INFO, # INFO 레벨 이상의 모든 로그를 표시 (DEBUG < INFO < WARNING < ERROR)
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
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
            video_url = self._start_recording(timestamp)
            
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

    def _start_recording(self, timestamp): # frame 인자 대신 함수 내에서 읽기
        """녹화 시작: 실제 카메라 프레임을 FPS에 맞춰 10초간 기록"""
        file_path = os.path.join(self.video_dir, f"record_{timestamp}.mp4")
        self.current_video_path = file_path
        
        fps = 20.0
        frame_duration = 1.0 / fps # 프레임당 필요한 시간 (0.05초)
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(file_path, fourcc, fps, (self.frame_width, self.frame_height))
        logger.info(f"🎥 [RECORDING] 5초간 시작됨: {file_path}")
        
        frames_to_record = int(fps * 5) # 5초 동안 필요한 총 프레임 수 (100개)
        try:
            for _ in range(frames_to_record):
                loop_start = time.time()
                
                # 1. 카메라에서 새로운 프레임 읽기 (실시간 기록)
                ret, frame = self.cap.read()
                if not ret:
                    break
                
                # 2. 크기 맞추기
                if frame.shape[1] != self.frame_width or frame.shape[0] != self.frame_height:
                    frame = cv2.resize(frame, (self.frame_width, self.frame_height))
                # 3. 프레임 쓰기
                self.writer.write(frame)
                
                # 4. FPS 유지를 위한 정밀한 지연 시간 계산
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
        import ffmpeg
        """녹화 중지 -> H.264 변환 -> 클라우드 업로드"""
        if self.writer:
            self.writer.release()
            self.writer = None
        
        time.sleep(1.0) # 파일 쓰기 완료 대기
        
        raw_path = self.current_video_path # mp4v로 저장된 원본 경로
        web_path = raw_path.replace(".mp4", "_web.mp4") # 변환될 파일 경로
        video_url = None

        if raw_path and os.path.exists(raw_path):
            try:
                logger.info(f"🔄 웹 재생용으로 변환 시작 (H.264): {raw_path}")
                
                # FFmpeg를 이용한 H.264 변환 (소프트웨어 인코딩)
                # 젯슨 나노의 CPU를 사용하여 크롬 표준 코덱으로 변환합니다.
                (
                    ffmpeg
                    .input(raw_path)
                    .output(web_path, vcodec='libx264', crf=28, preset='ultrafast')
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )

                # 변환된 파일이 정상적이라면 변환된 파일을 업로드
                if os.path.exists(web_path) and os.path.getsize(web_path) > 0:
                    logger.info(f"✅ 변환 완료. 업로드 시도: {web_path}")
                    video_url = storage_service.upload_file(web_path)
                    
                    # 업로드 후 임시 파일들 삭제 (로컬 용량 관리)
                    os.remove(raw_path)
                    os.remove(web_path)
                else:
                    logger.error("❌ 변환된 파일이 생성되지 않았습니다.")
            
            except ffmpeg.Error as e:
                logger.error(f"❌ FFmpeg 변환 에러: {e.stderr.decode()}")
                # 변환 실패 시 아쉬운 대로 원본이라도 업로드 시도
                video_url = storage_service.upload_file(raw_path)

        self.current_video_path = None
        return video_url

    def _publish_detection(self, data):
        """탐지 결과를 MQTT로 발행"""
        topic = settings.TOPIC_DETECTION
        payload = json.dumps(data)
        mqtt_service.publish(topic, payload)

detection_service = DetectionService()
