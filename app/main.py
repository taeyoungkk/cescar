
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.v1 import control
import asyncio
import json
import logging
from app.services.mqtt_service import mqtt_service
from app.services.monitoring_service import monitoring_service
from app.core.config import settings

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(message)s')
logger = logging.getLogger(__name__)

async def system_status_publisher():
    """
    주기적으로 시스템 상태를 읽어 MQTT로 발행하는 백그라운드 태스크
    """
    print("[*] System Status Publisher Task Started")
    while True:
        try:
            stats = monitoring_service.get_system_stats()
            # JSON 문자열로 변환하여 발행
            mqtt_service.publish(settings.TOPIC_STATUS, json.dumps(stats))
            # logger.info(f"Published status to {settings.TOPIC_STATUS}")
        except Exception as e:
            logger.error(f"Error in status publisher: {e}")
        
        await asyncio.sleep(5)  # 5초 간격으로 발행

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: MQTT 연결
    print("\n[*] Starting MQTT Service...")
    mqtt_service.connect()
    
    # 시스템 상태 발행 백그라운드 태스크 시작
    status_task = asyncio.create_task(system_status_publisher())
    
    yield
    
    # Shutdown: 태스크 취소 및 MQTT 연결 해제
    status_task.cancel()
    try:
        await status_task
    except asyncio.CancelledError:
        print("[*] System Status Publisher Task Stopped")
    
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
