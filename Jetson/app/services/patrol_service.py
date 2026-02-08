"""
Patrol Service for Jetson

단순 왕복 패턴: 직진 → 180도 회전 (자연스럽게 다음줄로) → 직진 → 반복
LiDAR 데이터로 장애물/벽 감지 후 회전.
"""

import logging
import json
import time
import math
import numpy as np
from typing import Optional
from dataclasses import dataclass
from enum import Enum
import threading

from app.services.mqtt_service import mqtt_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class PatrolState(str, Enum):
    """패트롤 상태"""
    IDLE = "IDLE"           # 대기
    ADVANCE = "ADVANCE"     # 직진
    TURN = "TURN"           # 180도 회전 중


@dataclass
class CmdVel:
    """속도 명령"""
    v: float  # 전진/후진
    w: float  # 조향


class PatrolService:
    """
    단순 왕복 패트롤 서비스
    
    패턴:
    1. 직진 (ADVANCE) → 벽/장애물 감지 (1.0m)
    2. 180도 회전 (TURN) - 전진하면서 회전하므로 자연스럽게 다음줄로 이동
    3. 직진 (ADVANCE) → 반대쪽 벽 감지
    4. 180도 반대 방향 회전 (TURN)
    5. 반복
    """
    
    def __init__(self):
        self._is_running = False
        self._state = PatrolState.IDLE
        self._turn_count = 0
        
        # 주행 파라미터 (v 음수 = 전진)
        self._cruise_speed = -1.0     # 순항 속도 (음수=전진)
        self._turn_speed = -1.0       # 회전 시 속도 (음수=전진)
        self._turn_angular = 1.0      # 회전 각속도
        
        # 장애물 감지 파라미터
        self._front_obstacle_dist = 1.0   # 전방 장애물 감지 거리 (m)
        self._scan_front_angle = 30       # 전방 감지 각도 (±도)
        
        # 상태 제어
        self._state_lock = threading.Lock()
        self._last_cmd_time = 0
        self._cmd_interval = 0.1  # 100ms
        
        # 회전 상태 추적
        self._turn_start_time = 0
        self._turn_duration = 8.5   # 180도 회전 시간
        
        # 회전 방향 (번갈아 교체)
        self._turn_direction = 1  # 1: 왼쪽, -1: 오른쪽
        
        # 후진 히스테리시스
        self._is_reversing = False
        self._reverse_safe_dist = 0.5  # 후진 해제 거리 (m)
        
        logger.info("PatrolService initialized (Simple back-and-forth pattern)")

    def start_patrol(self) -> None:
        """패트롤 시작"""
        with self._state_lock:
            if self._is_running:
                logger.info("Already patrolling")
                return
            
            self._is_running = True
            self._state = PatrolState.ADVANCE
            self._turn_count = 0
            self._turn_direction = 1
            self._is_reversing = False
            
        logger.info("🚗 Patrol STARTED (back-and-forth pattern)")
        print("[PATROL] 왕복 패트롤 시작")

    def stop_patrol(self) -> None:
        """패트롤 중지"""
        with self._state_lock:
            if not self._is_running:
                return
            
            self._is_running = False
            self._state = PatrolState.IDLE
        
        self._send_cmd_vel(CmdVel(v=0.0, w=0.0))
        logger.info("🛑 Patrol STOPPED")
        print("[PATROL] 패트롤 중지")

    def pause_patrol(self) -> None:
        """패트롤 일시 정지"""
        with self._state_lock:
            if self._is_running:
                self._is_running = False
        
        self._send_cmd_vel(CmdVel(v=0.0, w=0.0))
        logger.info("⏸️ Patrol PAUSED")
        print("[PATROL] 일시 정지")

    def resume_patrol(self) -> None:
        """패트롤 재개"""
        with self._state_lock:
            if not self._is_running:
                self._is_running = True
        
        logger.info("▶️ Patrol RESUMED")
        print("[PATROL] 패트롤 재개")

    def is_patrolling(self) -> bool:
        """패트롤 중 여부"""
        return self._is_running

    def process_lidar_scan(self, ranges: list, angle_min: float, angle_increment: float) -> Optional[CmdVel]:
        """LiDAR 스캔 데이터 처리"""
        if not self._is_running:
            return None
        
        current_time = time.time()
        if current_time - self._last_cmd_time < self._cmd_interval:
            return None
        
        obstacle_info = self._analyze_obstacles(ranges, angle_min, angle_increment)
        cmd = self._process_state(obstacle_info, current_time)
        
        if cmd:
            self._send_cmd_vel(cmd)
            self._last_cmd_time = current_time
        
        return cmd

    def _analyze_obstacles(self, ranges: list, angle_min: float, angle_increment: float) -> dict:
        """장애물 정보 분석"""
        ranges = np.array(ranges)
        num_points = len(ranges)
        
        if num_points == 0:
            return {"front_blocked": True, "min_front": 0.0}
        
        angles = angle_min + np.arange(num_points) * angle_increment
        angles_deg = np.degrees(angles)
        
        valid_mask = np.isfinite(ranges) & (ranges > 0.05)
        ranges_valid = np.where(valid_mask, ranges, np.inf)
        
        front_mask = np.abs(angles_deg) < self._scan_front_angle
        front_ranges = ranges_valid[front_mask]
        min_front = np.min(front_ranges) if len(front_ranges) > 0 else np.inf
        
        return {
            "front_blocked": min_front < self._front_obstacle_dist,
            "min_front": min_front
        }

    def _process_state(self, obstacle_info: dict, current_time: float) -> Optional[CmdVel]:
        """상태 머신 처리"""
        with self._state_lock:
            state = self._state
        
        if state == PatrolState.ADVANCE:
            return self._handle_advance(obstacle_info, current_time)
        elif state == PatrolState.TURN:
            return self._handle_turn(obstacle_info, current_time)
        
        return None

    def _handle_advance(self, obstacle_info: dict, current_time: float) -> CmdVel:
        """직진 상태 처리"""
        
        print(f"[PATROL] ADVANCE: dist={obstacle_info['min_front']:.2f}m, blocked={obstacle_info['front_blocked']}")
        
        # 🚧 장애물 감지 (1.0m 이내) → 180도 회전 시작
        if obstacle_info["front_blocked"]:
            logger.info(f"🚧 Obstacle (dist={obstacle_info['min_front']:.2f}m), starting 180° turn")
            print(f"[PATROL] 🚧 장애물! 180도 회전 시작")
            
            with self._state_lock:
                self._state = PatrolState.TURN
                self._turn_start_time = current_time
                self._is_reversing = False
            
            return CmdVel(v=self._turn_speed, w=self._turn_angular * self._turn_direction)
        
        # 전방 clear → 직진
        return CmdVel(v=self._cruise_speed, w=0.0)

    def _handle_turn(self, obstacle_info: dict, current_time: float) -> CmdVel:
        """180도 회전 상태 처리"""
        
        # 🚨 후진 중이면 안전거리까지 계속 후진
        if self._is_reversing:
            if obstacle_info["min_front"] < self._reverse_safe_dist:
                self._turn_start_time = current_time  # 타이머 리셋
                print(f"[PATROL] 후진 중... 거리={obstacle_info['min_front']:.2f}m")
                return CmdVel(v=0.5, w=0.0)
            else:
                self._is_reversing = False
                logger.info(f"✅ Safe distance ({obstacle_info['min_front']:.2f}m), resuming turn")
                print(f"[PATROL] ✅ 안전거리 확보! 회전 재개")
        
        # 🚨 너무 가까우면 후진
        if obstacle_info["min_front"] < 0.3:
            logger.warning(f"⚠️ Too close! dist={obstacle_info['min_front']:.2f}m, reversing")
            print(f"[PATROL] ⚠️ 후진! 거리={obstacle_info['min_front']:.2f}m")
            self._is_reversing = True
            self._turn_start_time = current_time
            return CmdVel(v=0.5, w=0.0)
        
        elapsed = current_time - self._turn_start_time
        
        if elapsed < self._turn_duration:
            # 아직 회전 중 - 전진하면서 180도 회전
            return CmdVel(v=self._turn_speed, w=self._turn_angular * self._turn_direction)
        
        # 회전 완료 → 다시 직진
        logger.info("✅ 180° turn done, resuming advance")
        print("[PATROL] ✅ 180도 회전 완료! 직진 재개")
        with self._state_lock:
            self._state = PatrolState.ADVANCE
            self._turn_count += 1
            # 다음 회전 방향 반전
            self._turn_direction *= -1
        
        return CmdVel(v=self._cruise_speed, w=0.0)

    def _send_cmd_vel(self, cmd: CmdVel) -> bool:
        """MQTT로 cmd_vel 전송"""
        try:
            payload = {
                "v": round(cmd.v, 4),
                "w": round(cmd.w, 4),
                "source": "jetson_patrol"
            }
            
            topic = settings.TOPIC_CMD_VEL
            mqtt_service.publish(topic, json.dumps(payload))
            
            print(f"[CMD SENT] v={cmd.v:.2f}, w={cmd.w:.2f}")
            logger.debug(f"[PATROL] cmd_vel: v={cmd.v:.2f}, w={cmd.w:.2f}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send cmd_vel: {e}")
            return False

    def get_state(self) -> dict:
        """현재 상태 반환"""
        with self._state_lock:
            return {
                "is_running": self._is_running,
                "state": self._state.value,
                "turn_count": self._turn_count,
                "turn_direction": "LEFT" if self._turn_direction > 0 else "RIGHT"
            }


# 싱글톤 인스턴스
patrol_service = PatrolService()
