"""
Odometry Service for Raspberry Pi
엔코더 + 조향각을 사용하여 위치를 계산하고 MQTT로 발행.
"""
import json
import logging
import math
import time
from dataclasses import dataclass, asdict
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class OdomData:
    """Odometry 데이터."""
    timestamp: float
    x: float        # 위치 x (m)
    y: float        # 위치 y (m)
    theta: float    # 방향 (rad)
    v: float        # 선속도 (m/s)
    w: float        # 각속도 (rad/s)


class OdomService:
    """
    Odometry 계산 및 MQTT 발행 서비스.
    Ackermann 방식 (1모터 + 스티어링 서보) 기반.
    """
    
    def __init__(
        self,
        wheelbase: float = 0.16,  # 축간 거리 (m) - 조정 필요
        publish_hz: float = 20.0,
    ) -> None:
        self._wheelbase = wheelbase
        self._publish_interval = 1.0 / publish_hz
        
        # 현재 상태
        self._x: float = 0.0
        self._y: float = 0.0
        self._theta: float = 0.0
        
        # 마지막 값들
        self._last_time: float = time.time()
        self._last_publish_time: float = 0.0
        
        # 외부 주입
        self._encoder = None
        self._steering = None
        self._publisher: Optional[Callable[[str], None]] = None
        self._topic: str = ""
        
        logger.info("OdomService initialized")
    
    def set_encoder(self, encoder) -> None:
        """엔코더 컨트롤러 연결."""
        self._encoder = encoder
    
    def set_steering(self, steering) -> None:
        """조향 컨트롤러 연결."""
        self._steering = steering
    
    def set_publisher(self, publisher: Callable[[str, str], None], topic: str) -> None:
        """MQTT 발행 함수 연결."""
        self._publisher = publisher
        self._topic = topic
    
    def tick(self) -> None:
        """
        주기적 호출 (20Hz 권장).
        - 엔코더 업데이트
        - 위치 계산
        - MQTT 발행
        """
        now = time.time()
        dt = now - self._last_time
        
        if dt <= 0:
            return
        
        self._last_time = now
        
        # 엔코더 업데이트
        if self._encoder:
            self._encoder.update()
            v = self._encoder.speed
        else:
            v = 0.0
        
        # 조향각 가져오기 (normalized -1 ~ 1을 rad로 변환)
        if self._steering:
            # 조향 서보의 마지막 각도를 사용
            # center=115도 기준, ±25도 → ±0.43 rad
            steer_deg = self._steering.last_angle - 115.0  # center 기준 오프셋
            steer_rad = math.radians(steer_deg)
        else:
            steer_rad = 0.0
        
        # Ackermann 모델로 각속도 계산
        if abs(steer_rad) > 0.001 and abs(v) > 0.001:
            # 회전 반경 = wheelbase / tan(조향각)
            turning_radius = self._wheelbase / math.tan(steer_rad)
            w = v / turning_radius
        else:
            w = 0.0
        
        # 위치 업데이트 (오일러 적분)
        self._theta += w * dt
        self._theta = self._normalize_angle(self._theta)
        
        self._x += v * math.cos(self._theta) * dt
        self._y += v * math.sin(self._theta) * dt
        
        # 발행 주기 체크
        if now - self._last_publish_time >= self._publish_interval:
            self._publish(v, w)
            self._last_publish_time = now
    
    def _publish(self, v: float, w: float) -> None:
        """MQTT로 odom 발행."""
        if not self._publisher or not self._topic:
            return
        
        odom = OdomData(
            timestamp=time.time(),
            x=round(self._x, 4),
            y=round(self._y, 4),
            theta=round(self._theta, 4),
            v=round(v, 4),
            w=round(w, 4),
        )
        
        message = json.dumps(asdict(odom))
        self._publisher(self._topic, message)
        
        logger.debug(f"Odom published: v={v:.3f}, w={w:.3f}")
    
    @staticmethod
    def _normalize_angle(angle: float) -> float:
        """각도를 -π ~ π 범위로 정규화."""
        while angle > math.pi:
            angle -= 2 * math.pi
        while angle < -math.pi:
            angle += 2 * math.pi
        return angle
    
    def reset(self) -> None:
        """위치 리셋."""
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        if self._encoder:
            self._encoder.reset()
        logger.info("Odom reset")
    
    def get_odom(self) -> OdomData:
        """현재 odom 데이터 반환."""
        v = self._encoder.speed if self._encoder else 0.0
        return OdomData(
            timestamp=time.time(),
            x=self._x,
            y=self._y,
            theta=self._theta,
            v=v,
            w=0.0,  # 마지막 계산값 저장 필요시 추가
        )


# 싱글톤 인스턴스
odom_service = OdomService()
