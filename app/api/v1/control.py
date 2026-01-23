
from fastapi import APIRouter, HTTPException
from app.models.schemas import MovementCommand, RobotStatus
from app.services.hardware import hardware_service
from app.services.mqtt_service import mqtt_service
from app.core.config import settings

from app.services.monitoring_service import monitoring_service

router = APIRouter()

@router.get("/system-stats")
async def get_system_stats():
    """
    Jetson Nano의 시스템 상태(CPU, GPU, RAM, 온도 등)를 반환합니다.
    """
    return monitoring_service.get_system_stats()

@router.post("/move")
async def move_robot(command: MovementCommand):
    """
    로봇 이동 제어 API
    """
    hardware_service.move_robot(command.direction, command.speed)
    
    # 상태 업데이트를 MQTT로 발행 (옵션)
    mqtt_service.publish(settings.TOPIC_STATUS, f"Moving {command.direction} at {command.speed}")
    
    return {"status": "success", "command": command}

@router.get("/status", response_model=RobotStatus)
async def get_status():
    """
    로봇 상태 조회 API
    """
    battery = hardware_service.get_battery_level()
    return RobotStatus(
        robot_id=settings.ROBOT_ID,
        status="active",
        battery_level=battery,
        connected=True
    )
