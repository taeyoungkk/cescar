"""
Autonomous Mapping Service for Jetson

라이다 데이터를 분석하여 장애물을 회피하며 자율 주행하고
SLAM으로 맵을 자동 생성하는 서비스
"""

import logging
import json
import time
import numpy as np
from typing import Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum

from app.services.mqtt_service import mqtt_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class MappingMode(str, Enum):
    """맵핑 모드"""
    OFF = "OFF"
    MAPPING = "MAPPING"
    PAUSED = "PAUSED"


@dataclass
class CmdVel:
    """속도 명령"""
    v: float  # 전진/후진 (-1.0 ~ 1.0)
    w: float  # 조향 (-1.0 ~ 1.0)


class AutonomousMappingService:
    """
    자율 주행 맵핑 서비스
    
    라이다 스캔을 분석하여 장애물을 회피하며 자율 주행
    SLAM이 백그라운드에서 맵을 생성
    """
    
    def __init__(self):
        self.mode: MappingMode = MappingMode.OFF
        
        # 주행 파라미터
        self._cruise_speed = 0.3  # 순항 속도 (m/s)
        self._turn_speed = 0.15   # 회전 시 속도
        self._obstacle_threshold = 0.5  # 장애물 감지 거리 (m)
        self._safe_distance = 0.8  # 안전 거리 (m)
        
        # 라이다 파라미터
        self._scan_angle_front = 60  # 전방 감지 각도 (±30도)
        self._scan_angle_side = 90   # 측면 감지 각도
        
        # 상태 추적
        self._last_cmd_time: float = 0.0
        self._cmd_interval: float = 0.1  # 100ms마다 명령
        self._stuck_counter: int = 0
        self._stuck_threshold: int = 30  # 3초간 같은 상태면 stuck
        
        # 탐색 전략
        self._exploration_mode = "frontier"  # "frontier" or "random"
        self._last_turn_direction = 1.0  # 1=right, -1=left
        
        logger.info("AutonomousMappingService initialized")
    
    def start_mapping(self) -> None:
        """자율 맵핑 시작"""
        if self.mode == MappingMode.MAPPING:
            logger.info("Already in MAPPING mode")
            return
        
        self.mode = MappingMode.MAPPING
        self._stuck_counter = 0
        logger.info("🗺️ Autonomous Mapping STARTED")
        print("[MAPPING] 자율 맵핑 시작 - 장애물 회피하며 주행")
    
    def stop_mapping(self) -> None:
        """맵핑 중지"""
        if self.mode == MappingMode.OFF:
            return
        
        self.mode = MappingMode.OFF
        self._send_cmd_vel(CmdVel(v=0.0, w=0.0))
        logger.info("🛑 Autonomous Mapping STOPPED")
        print("[MAPPING] 맵핑 중지")
    
    def pause_mapping(self) -> None:
        """일시 정지"""
        self.mode = MappingMode.PAUSED
        self._send_cmd_vel(CmdVel(v=0.0, w=0.0))
        logger.info("⏸️ Mapping PAUSED")
    
    def resume_mapping(self) -> None:
        """재개"""
        if self.mode == MappingMode.PAUSED:
            self.mode = MappingMode.MAPPING
            logger.info("▶️ Mapping RESUMED")
    
    def is_mapping(self) -> bool:
        """맵핑 중 여부"""
        return self.mode == MappingMode.MAPPING
    
    def process_lidar_scan(self, scan_data: dict) -> Optional[CmdVel]:
        """
        라이다 스캔 데이터를 처리하여 자율 주행
        
        Args:
            scan_data: {
                "ranges": [float],  # 거리 측정값 배열
                "angle_min": float,  # 시작 각도 (rad)
                "angle_max": float,  # 끝 각도 (rad)
                "angle_increment": float  # 각도 증분
            }
        
        Returns:
            계산된 CmdVel
        """
        if not self.is_mapping():
            return None
        
        # 명령 전송 간격 체크
        current_time = time.time()
        if current_time - self._last_cmd_time < self._cmd_interval:
            return None
        
        ranges = scan_data.get("ranges", [])
        if not ranges:
            logger.warning("No lidar data received")
            return None
        
        # 장애물 분석
        obstacle_info = self._analyze_obstacles(scan_data)
        
        # 주행 명령 계산
        cmd = self._calculate_navigation_cmd(obstacle_info)
        
        # 전송
        self._send_cmd_vel(cmd)
        self._last_cmd_time = current_time
        
        return cmd
    
    def _analyze_obstacles(self, scan_data: dict) -> dict:
        """
        라이다 스캔에서 장애물 정보 추출
        
        Returns:
            {
                "front_clear": bool,
                "left_clear": bool,
                "right_clear": bool,
                "min_front_dist": float,
                "min_left_dist": float,
                "min_right_dist": float
            }
        """
        ranges = np.array(scan_data["ranges"])
        angle_min = scan_data.get("angle_min", -np.pi)
        angle_increment = scan_data.get("angle_increment", np.pi / 180)
        
        # 각도 배열 생성
        angles = angle_min + np.arange(len(ranges)) * angle_increment
        
        # inf, nan 제거
        valid_mask = np.isfinite(ranges)
        ranges = ranges[valid_mask]
        angles = angles[valid_mask]
        
        if len(ranges) == 0:
            return {
                "front_clear": False,
                "left_clear": False,
                "right_clear": False,
                "min_front_dist": 0.0,
                "min_left_dist": 0.0,
                "min_right_dist": 0.0
            }
        
        # 섹터별 최소 거리 계산
        front_mask = np.abs(angles) < np.radians(self._scan_angle_front / 2)
        left_mask = (angles > np.radians(30)) & (angles < np.radians(self._scan_angle_side))
        right_mask = (angles < np.radians(-30)) & (angles > np.radians(-self._scan_angle_side))
        
        min_front = np.min(ranges[front_mask]) if np.any(front_mask) else float('inf')
        min_left = np.min(ranges[left_mask]) if np.any(left_mask) else float('inf')
        min_right = np.min(ranges[right_mask]) if np.any(right_mask) else float('inf')
        
        return {
            "front_clear": min_front > self._safe_distance,
            "left_clear": min_left > self._obstacle_threshold,
            "right_clear": min_right > self._obstacle_threshold,
            "min_front_dist": min_front,
            "min_left_dist": min_left,
            "min_right_dist": min_right
        }
    
    def _calculate_navigation_cmd(self, obstacle_info: dict) -> CmdVel:
        """
        장애물 정보를 기반으로 주행 명령 계산
        
        전략:
        1. 전방 clear → 직진
        2. 전방 막힘 + 좌측 clear → 좌회전
        3. 전방 막힘 + 우측 clear → 우회전
        4. 모두 막힘 → 제자리 회전
        """
        front_clear = obstacle_info["front_clear"]
        left_clear = obstacle_info["left_clear"]
        right_clear = obstacle_info["right_clear"]
        min_front = obstacle_info["min_front_dist"]
        
        # Case 1: 전방 clear → 직진
        if front_clear:
            self._stuck_counter = 0
            return CmdVel(v=self._cruise_speed, w=0.0)
        
        # Case 2: 전방 막힘 → 회피 기동
        self._stuck_counter += 1
        
        # 좌우 중 더 넓은 쪽으로 회전
        if left_clear and right_clear:
            # 둘 다 clear면 이전 방향 반대로
            turn_dir = -self._last_turn_direction
        elif left_clear:
            turn_dir = 1.0  # 좌회전 (반시계)
        elif right_clear:
            turn_dir = -1.0  # 우회전 (시계)
        else:
            # 모두 막혔으면 제자리 회전
            turn_dir = self._last_turn_direction
        
        self._last_turn_direction = turn_dir
        
        # 회전 속도 계산 (전방 거리에 비례)
        if min_front < self._obstacle_threshold:
            # 매우 가까우면 후진하며 회전
            v = -0.1
            w = turn_dir * 0.5
        else:
            # 천천히 전진하며 회전
            v = self._turn_speed
            w = turn_dir * 0.4
        
        # Stuck 감지 → 더 강한 회전
        if self._stuck_counter > self._stuck_threshold:
            logger.warning("⚠️ Robot seems stuck, executing recovery")
            v = -0.15  # 후진
            w = turn_dir * 0.6  # 강한 회전
            self._stuck_counter = 0  # 리셋
        
        return CmdVel(v=v, w=w)
    
    def _send_cmd_vel(self, cmd: CmdVel) -> bool:
        """MQTT로 cmd_vel 전송"""
        try:
            payload = {
                "v": round(cmd.v, 3),
                "w": round(cmd.w, 3),
                "source": "jetson_mapping"
            }
            
            topic = settings.TOPIC_CMD_VEL
            mqtt_service.publish(topic, json.dumps(payload))
            
            logger.debug(f"[MAPPING] cmd_vel: v={cmd.v:.2f}, w={cmd.w:.2f}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send cmd_vel: {e}")
            return False


# 싱글톤 인스턴스
autonomous_mapping_service = AutonomousMappingService()
