
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.v1 import control
from app.services.mqtt_service import mqtt_service
from app.core.config import settings

import logging

# 로깅 설정 (INFO 레벨 이상의 로그를 터미널에 출력)
logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(message)s')
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: MQTT 연결
    print("\n[*] Starting MQTT Service...")
    mqtt_service.connect()
    yield
    # Shutdown: MQTT 연결 해제
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
