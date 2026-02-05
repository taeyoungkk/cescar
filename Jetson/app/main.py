import platform
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.v1 import control
import asyncio
import json
import logging
from app.services.mqtt_service import mqtt_service
from app.services.monitoring_service import monitoring_service
from app.services.detection_service import detection_service
from app.services.yolo_service import yolo_service
from app.services.detection_ws_service import detection_ws_service
from app.services.camera_service import camera_service
from app.core.config import settings

# WebRTC 서비스는 Linux(Jetson) 환경에서만 로드 (gi 모듈 의존성 때문)
webrtc_service = None
if platform.system() == 'Linux':
    try:
        from app.services.webrtc_service import webrtc_service
    except ImportError:
        logging.warning("Linux 환경이지만 gi 또는 관련 모듈을 찾을 수 없어 WebRTC 서비스를 로드하지 못했습니다.")

from app.core.logger import setup_logging

# 전역 로깅 설정 적용
setup_logging()
logger = logging.getLogger(__name__)

async def system_status_publisher():
    """
    시스템 상태를 감시하고, 유의미한 변화가 있을 때만 MQTT로 발행합니다.
    """
    print("[*] Smart System Status Publisher Started")
    last_stats = None
    last_publish_time = 0
    heartbeat_interval = 60  # 변화가 없어도 60초마다 한 번은 발행
    
    while True:
        try:
            current_stats = monitoring_service.get_system_stats()
            current_time = asyncio.get_event_loop().time()
            
            should_publish = False
            
            # 1. 처음 발행하는 경우
            if last_stats is None:
                should_publish = True
            
            # 2. 마지막 발행 후 일정 시간(Heartbeat)이 지난 경우
            elif current_time - last_publish_time > heartbeat_interval:
                should_publish = True
            
            # 3. 유의미한 변화가 포착된 경우 (Deadband 로직)
            else:
                # CPU 5% 이상 변화
                if abs(current_stats['cpu_usage'] - last_stats['cpu_usage']) >= 5:
                    should_publish = True
                # 온도 1도 이상 변화
                elif abs(current_stats['temperature'] - last_stats['temperature']) >= 1:
                    should_publish = True
                # 배터리 잔량 변화
                elif current_stats['battery']['percent'] != last_stats['battery']['percent']:
                    should_publish = True
                # 배터리 충전 상태 변화
                elif current_stats['battery']['power_plugged'] != last_stats['battery']['power_plugged']:
                    should_publish = True
                # 메모리 사용률 3% 이상 변화
                elif abs(current_stats['memory']['percent'] - last_stats['memory']['percent']) >= 3:
                    should_publish = True

            if should_publish:
                mqtt_service.publish(settings.TOPIC_STATUS, json.dumps(current_stats))
                last_stats = current_stats
                last_publish_time = current_time
                # logger.info(f"Published status due to change or heartbeat")

        except Exception as e:
            logger.error(f"Error in status publisher: {e}")

        await asyncio.sleep(2)  # 2초마다 변화 체크 (발행은 위 조건에 해당할 때만)

async def detection_publisher():
    """
    YOLO 모델을 사용하여 실시간 객체 탐지 수행.
    탐지된 bbox는 WebSocket으로 스트리밍, 이벤트는 MQTT로 발행.
    """
    print("[*] YOLO Detection Monitor Started")
    detection_service.start_monitoring()
    
    while True:
        try:
            # 10 FPS로 카메라 프레임 처리 및 탐지 수행
            detection_service.process_frame()
        except Exception as e:
            logger.error(f"Error in detection monitor: {e}")
        
        await asyncio.sleep(0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # Startup: MQTT 연결
    print("\n[*] Starting MQTT Service...")
    mqtt_service.connect()
    
    # Startup: YOLO 모델 로드
    print("[*] Loading YOLO model...")
    if yolo_service.load_model():
        print(f"[*] YOLO model loaded successfully on {yolo_service.device}")
    else:
        print("[!] YOLO model loading failed - detection will not work")
    
    # Startup: Detection WebSocket 연결
    print("[*] Connecting to Detection WebSocket...")
    if detection_ws_service.connect(settings.ROBOT_ID):
        print("[*] Detection WebSocket connected")
    else:
        print("[!] Detection WebSocket connection failed - bbox streaming disabled")
    
    # Startup: CameraService 시작 (WebRTC와 Detection에서 공유)
    print("[*] Starting CameraService...")
    if camera_service.start():
        print("[*] CameraService started successfully")
    else:
        print("[!] CameraService failed to start - video streaming disabled")
    
    # Startup: WebRTC 송출 시작 (CameraService에서 프레임 수신)
    if webrtc_service:
        print("[*] Starting WebRTC Service...")
        webrtc_service.start(settings.ROBOT_ID)
    else:
        print(f"[*] {platform.system()} 환경이거나 WebRTC 서비스를 로드할 수 없어 건너뜁니다.")
    
    # 시스템 상태 발행 백그라운드 태스크 시작
    status_task = asyncio.create_task(system_status_publisher())
    # YOLO 탐지 태스크 시작
    detection_task = asyncio.create_task(detection_publisher())
    
    yield
    
    # Shutdown: 태스크 취소 및 MQTT 연결 해제
    status_task.cancel()
    detection_task.cancel()
    detection_service.stop_monitoring()
    
    try:
        await asyncio.gather(status_task, detection_task, return_exceptions=True)
    except Exception as e:
        print(f"[*] Error during shutdown: {e}")
    
    print("[*] Background Tasks Stopped")
    
    # Shutdown: Detection WebSocket 종료
    print("[*] Disconnecting Detection WebSocket...")
    detection_ws_service.disconnect()
    
    # Shutdown: WebRTC 중지
    if webrtc_service:
        print("[*] Stopping WebRTC Service...")
        webrtc_service.stop()
    
    # Shutdown: CameraService 종료
    print("[*] Stopping CameraService...")
    camera_service.stop()
    
    mqtt_service.disconnect()

app = FastAPI(title="Robot Control API", lifespan=lifespan)

# API 라우터 등록
app.include_router(control.router, prefix="/api/v1", tags=["Control"])

@app.get("/")
async def read_root():
    """
    서버 상태 확인 (Health Check)
    """
    return {
        "system_status": "online",
        "robot_id": settings.ROBOT_ID,
        "service": "Robot Control API",
        "mqtt_broker": settings.MQTT_BROKER
    }
