"""
Odometry Service for Raspberry Pi (MQTT Version)
엔코더 데이터를 읽어 위치(x, y, theta)를 계산하고 MQTT로 발행합니다.
"""
import math
import time
import json
import logging
from typing import Optional, Any, Callable

from app.controllers.encoder_controller import EncoderController
from app.core.config import settings

logger = logging.getLogger(__name__)


class OdomService:
    """
    엔코더 및 조향 각도를 기반으로 Odometry를 계산하고
    MQTT로 발행하는 서비스.
    """
    
    def __init__(self):
        self._encoder: Optional[EncoderController] = None
        self._steering = None  # SteeringServoController instance
        self._publisher: Optional[Callable[[str, Any], None]] = None
        self._topic: str = ""
        
        # 차량 파라미터
        self._wheelbase = settings.WHEELBASE_M
        
        # 상태 변수 (global frame)
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        
        # 시간 추적
        self._last_time = time.time()
        
        logger.info("OdomService initialized")

    def set_encoder(self, encoder: EncoderController) -> None:
        self._encoder = encoder

    def set_steering(self, steering) -> None:
        self._steering = steering

    def set_publisher(self, publish_func: Callable[[str, Any], None], topic: str) -> None:
        self._publisher = publish_func
        self._topic = topic

    def reset(self) -> None:
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        if self._encoder:
            self._encoder.reset()
        logger.info("Odom reset")

    def _normalize_angle(self, angle: float) -> float:
        """각도를 -pi ~ pi로 정규화"""
        while angle > math.pi:
            angle -= 2 * math.pi
        while angle < -math.pi:
            angle += 2 * math.pi
        return angle

    def tick(self) -> None:
        """주기적 실행: 속도/조향각 MQTT 발행"""
        current_time = time.time()
        dt = current_time - self._last_time
        
        if dt <= 0:
            return

        self._last_time = current_time
        
        # 1. 속도(v) 가져오기
        v = 0.0
        if self._encoder:
            self._encoder.update()
            v = self._encoder.speed
            
        # 2. 조향각(delta) 가져오기
        steer_rad = 0.0
        if self._steering:
            # SteeringServoController의 last_angle은 degree 단위 (center=115)
            # 115도가 직진(0도)이라고 가정하고 변환
            steer_deg = self._steering.last_angle - 115.0
            steer_rad = math.radians(steer_deg)

        # 3. 데이터 발행 (MQTT)
        # Jetson의 mqtt_odom_bridge.py가 v_mps, steer_rad를 기대함
        if self._publisher and self._topic:
            payload = {
                "timestamp": current_time,
                "v_mps": round(v, 4),
                "steer_rad": round(steer_rad, 4),
                # 디버깅용 추가 정보
                "steer_deg": round(math.degrees(steer_rad), 2)
            }
            # JSON 직렬화 후 발행
            self._publisher(self._topic, json.dumps(payload))


odom_service = OdomService()