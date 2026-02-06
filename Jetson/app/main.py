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

# WebRTC 서비스는 Linux(Jetson) 환경에서만 로드
webrtc_service = None
if platform.system() == 'Linux':
    try:
        from app.services.webrtc_service import webrtc_service
    except ImportError:
        logging.warning("WebRTC service load failed")

from app.core.logger import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


async def system_status_publisher():
    print("[*] Smart System Status Publisher Started")

    last_stats = None
    last_publish_time = 0
    heartbeat_interval = 60

    while True:
        try:
            current_stats = monitoring_service.get_system_stats()
            current_time = asyncio.get_event_loop().time()

            should_publish = False

            if last_stats is None:
                should_publish = True
            elif current_time - last_publish_time > heartbeat_interval:
                should_publish = True
            else:
                if abs(current_stats['cpu_usage'] - last_stats['cpu_usage']) >= 5:
                    should_publish = True
                elif abs(current_stats['temperature'] - last_stats['temperature']) >= 1:
                    should_publish = True
                elif current_stats['battery']['percent'] != last_stats['battery']['percent']:
                    should_publish = True
                elif current_stats['battery']['power_plugged'] != last_stats['battery']['power_plugged']:
                    should_publish = True
                elif abs(current_stats['memory']['percent'] - last_stats['memory']['percent']) >= 3:
                    should_publish = True

            if should_publish:
                mqtt_service.publish(
                    settings.TOPIC_STATUS,
                    json.dumps(current_stats)
                )
                last_stats = current_stats
                last_publish_time = current_time

        except Exception as e:
            logger.error(f"Status publisher error: {e}")

        await asyncio.sleep(2)


async def detection_publisher():
    print("[*] YOLO Detection Monitor Started")

    detection_service.start_monitoring()

    while True:
        try:
            detection_service.process_frame()
        except Exception as e:
            logger.error(f"Detection error: {e}")

        await asyncio.sleep(0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):

    print("\n[*] Starting MQTT Service...")
    mqtt_service.connect()

    # ✅ YOLO 모델 로드 대기
    print("[*] Waiting for YOLO model to load...")
    while not yolo_service.is_loaded():
        try:
            yolo_service.load_model()
            if yolo_service.is_loaded():
                print(f"[*] YOLO model loaded successfully on {yolo_service.device}")
                break
        except Exception as e:
            logger.error(f"YOLO load error: {e}")

        print("[*] YOLO not ready. Retrying in 5 seconds...")
        await asyncio.sleep(5)

    print("[*] Connecting Detection WebSocket...")

    while True:
        if detection_ws_service.connect(settings.ROBOT_ID):
            print("[*] Detection WebSocket connected")
            break

        print("[!] Detection WebSocket connection failed. Retrying in 5 seconds...")
        await asyncio.sleep(5)

    # Camera
    print("[*] Starting CameraService...")
    if camera_service.start():
        print("[*] CameraService started")
    else:
        print("[!] CameraService start failed")

    # WebRTC
    if webrtc_service:
        print("[*] Starting WebRTC Service...")
        webrtc_service.start(settings.ROBOT_ID)

    # Background Tasks
    status_task = asyncio.create_task(system_status_publisher())
    detection_task = asyncio.create_task(detection_publisher())


    yield

    # Shutdown
    status_task.cancel()
    detection_task.cancel()

    detection_service.stop_monitoring()

    await asyncio.gather(
        status_task,
        detection_task,
        return_exceptions=True
    )

    print("[*] Shutting down services...")

    detection_ws_service.disconnect()

    if webrtc_service:
        webrtc_service.stop()

    camera_service.stop()
    mqtt_service.disconnect()


app = FastAPI(
    title="Robot Control API",
    lifespan=lifespan
)

app.include_router(
    control.router,
    prefix="/api/v1",
    tags=["Control"]
)


@app.get("/")
async def read_root():
    return {
        "system_status": "online",
        "robot_id": settings.ROBOT_ID,
        "service": "Robot Control API",
        "mqtt_broker": settings.MQTT_BROKER
    }
