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
        actual_h, actual_w = frame.shape[:2]
    
    # 2. 현재 설정되어 있는 VideoWriter의 크기 확인
        logger.info(f"📊 [SIZE CHECK] 실제 프레임: {actual_w}x{actual_h} | 설정된 크기: {self.frame_width}x{self.frame_height}")

        # 만약 두 값이 다르다면 강제로 맞춰줘야 합니다.
        if actual_w != self.frame_width or actual_h != self.frame_height:
            logger.warning(f"⚠️ 크기 불일치 발생! {actual_w}x{actual_h} -> {self.frame_width}x{self.frame_height}로 리사이즈합니다.")
            
        """녹화 시작 및 디버깅"""
        file_path = os.path.join(self.video_dir, f"record_{timestamp}.mp4")
        self.current_video_path = file_path
        
        # [디버깅] 현재 프레임 정보 확인
        h, w = frame.shape[:2]
        logger.info(f"🔍 디버깅: 입력 프레임 크기 ({w}x{h}), 설정된 크기 ({self.frame_width}x{self.frame_height})")
        
        # FFMPEG는 GStreamer 파이프라인 문자열을 이해 못하므로 file_path만 넣어야 합니다.
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(file_path, fourcc, 20.0, (self.frame_width, self.frame_height))

        # [디버깅] 최종 Writer 상태 확인
        if not self.writer.isOpened():
            logger.error(f"❌ 최종 실패: VideoWriter를 초기화할 수 없습니다. 경로: {file_path}")
            return None

        logger.info(f"🎥 [RECORDING] 시작됨: {file_path}")
        
        start_time = time.time()
        frames_written = 0

        try:
            while time.time() - start_time < 10:
                if frame.shape[1] != self.frame_width or frame.shape[0] != self.frame_height:
                    frame = cv2.resize(frame, (self.frame_width, self.frame_height))

                self.writer.write(frame)
                frames_written += 1

            logger.info(f"✅ 녹화 종료. 총 {frames_written} 프레임 기록됨.")
        
        except Exception as e:
            logger.error(f"🔥 녹화 루프 중 에러 발생: {e}")
        
        finally:
            # 반드시 정지 로직 호출
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
