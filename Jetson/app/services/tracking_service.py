"""
Tracking Service for Jetson

바퀴벌레 탐지 시 bbox 위치를 분석하여 cmd_vel을 계산하고
MQTT를 통해 Pi로 전송하는 서비스
"""

import logging
import json
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from app.services.mqtt_service import mqtt_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class TrackingMode(str, Enum):
    """추적 모드"""
    OFF = "OFF"
    TRACK = "TRACK"


@dataclass
class CmdVel:
    """속도 명령"""
    v: float  # 전진/후진 (-1.0 ~ 1.0)
    w: float  # 조향 (-1.0 ~ 1.0, 음수=좌회전, 양수=우회전)


class TrackingService:
    """
    바퀴벌레 추적 서비스
    
    YOLO 탐지 결과(bbox)를 기반으로 cmd_vel을 계산하여 Pi로 전송
    """
    
    def __init__(self):
        self.mode: TrackingMode = TrackingMode.OFF
        
        # 추적 파라미터
        self._dead_zone = 0.30  # 화면 중앙 30% 이내면 직진
        self._max_steer = 0.8   # 최대 조향값
        self._base_speed = 2.4  # 기본 전진 속도
        self._min_speed = 2.0  # 최소 속도 (가까울 때)
        
        # 상태 추적
        self._last_cmd_time: float = 0.0
        self._cmd_interval: float = 0.1  # 100ms마다 명령 전송
        self._no_target_count: int = 0
        self._no_target_threshold: int = 10  # 10프레임 동안 타겟 없으면 정지
        
        logger.info("TrackingService initialized (mode=OFF)")
    
    def start_tracking(self) -> None:
        """추적 모드 시작"""
        if self.mode == TrackingMode.TRACK:
            logger.info("Already in TRACK mode")
            return
        
        self.mode = TrackingMode.TRACK
        self._no_target_count = 0
        logger.info("🎯 Tracking mode STARTED")
        print("[TRACKING] Mode ON - 바퀴벌레 추적 시작")
    
    def stop_tracking(self) -> None:
        """추적 모드 중지"""
        if self.mode == TrackingMode.OFF:
            return
        
        self.mode = TrackingMode.OFF
        # 정지 명령 전송
        self._send_cmd_vel(CmdVel(v=0.0, w=0.0))
        logger.info("🛑 Tracking mode STOPPED")
        print("[TRACKING] Mode OFF - 추적 중지")
    
    def is_tracking(self) -> bool:
        """추적 모드 여부"""
        return self.mode == TrackingMode.TRACK
    
    def process_detection(
        self, 
        detections: List[Dict[str, Any]], 
        frame_width: int, 
        frame_height: int
    ) -> Optional[CmdVel]:
        """
        탐지 결과를 처리하여 cmd_vel 계산 및 전송
        
        Args:
            detections: YOLO 탐지 결과 리스트
            frame_width: 프레임 너비
            frame_height: 프레임 높이
        
        Returns:
            계산된 CmdVel (전송 안 했으면 None)
        """
        if not self.is_tracking():
            # print("[DEBUG] Not tracking mode")
            return None
        
        print(f"[DEBUG] process_detection called with {len(detections)} detections")

        # 명령 전송 간격 체크
        current_time = time.time()
        if current_time - self._last_cmd_time < self._cmd_interval:
            # print("[DEBUG] Skip: too fast")
            return None
        
        # 타겟 없음
        if not detections:
            self._no_target_count += 1
            if self._no_target_count >= self._no_target_threshold:
                # 타겟 없으면 정지
                cmd = CmdVel(v=0.0, w=0.0)
                self._send_cmd_vel(cmd)
                self._last_cmd_time = current_time
                return cmd
            return None
        
        # 타겟 있음 - 카운터 리셋
        self._no_target_count = 0
        
        # 가장 큰 bbox 선택 (가장 가까운 타겟)
        target = self._select_target(detections)
        if not target:
            return None
        
        # cmd_vel 계산
        cmd = self._calculate_cmd_vel(target, frame_width, frame_height)
        
        # MQTT로 전송
        self._send_cmd_vel(cmd)
        self._last_cmd_time = current_time
        
        return cmd
    
    def _select_target(self, detections: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        추적할 타겟 선택 (가장 큰 bbox = 가장 가까운 대상)
        """
        if not detections:
            return None
        
        def bbox_area(det: Dict[str, Any]) -> float:
            bbox = det.get("bbox", {})
            x1 = bbox.get("x1", 0)
            y1 = bbox.get("y1", 0)
            x2 = bbox.get("x2", 0)
            y2 = bbox.get("y2", 0)
            return (x2 - x1) * (y2 - y1)
        
        return max(detections, key=bbox_area)
    
    def _calculate_cmd_vel(
        self, 
        detection: Dict[str, Any], 
        frame_width: int, 
        frame_height: int
    ) -> CmdVel:
        """
        bbox 위치를 기반으로 cmd_vel 계산
        
        - bbox 중심이 화면 왼쪽 → 좌회전 (w < 0)
        - bbox 중심이 화면 오른쪽 → 우회전 (w > 0)
        - bbox가 크면(가까움) → 속도 감소
        """
        bbox = detection.get("bbox", {})
        x1 = bbox.get("x1", 0)
        y1 = bbox.get("y1", 0)
        x2 = bbox.get("x2", 0)
        y2 = bbox.get("y2", 0)
        
        # bbox 중심 계산
        bbox_center_x = (x1 + x2) / 2
        frame_center_x = frame_width / 2
        
        # 정규화된 오프셋 (-1.0 ~ 1.0)
        offset = (bbox_center_x - frame_center_x) / frame_center_x
        
        # 조향 계산 (dead zone 적용)
        if abs(offset) < self._dead_zone:
            w = 0.0
        else:
            # dead zone 이후의 오프셋만 사용
            effective_offset = (abs(offset) - self._dead_zone) / (1.0 - self._dead_zone)
            w = effective_offset * self._max_steer
            if offset < 0:
                w = -w  # 왼쪽이면 음수
        
        # 속도 계산 (bbox 크기 기반)
        bbox_width = x2 - x1
        bbox_height = y2 - y1
        bbox_area = bbox_width * bbox_height
        frame_area = frame_width * frame_height
        
        # bbox가 화면의 몇 %를 차지하는지
        area_ratio = bbox_area / frame_area if frame_area > 0 else 0
        
        # 가까우면(bbox 크면) 속도 감소
        if area_ratio > 0.2:  # 20% 이상이면 매우 가까움
            v = self._min_speed
        elif area_ratio > 0.1:  # 10% 이상
            v = self._base_speed
        else:
            v = self._base_speed
        
        # 값 클램핑
        v = max(-3.0, min(3.0, v))
        w = max(-3.0, min(3.0, w))
        
        # [Correct] Hardware: Positive=Forward, Negative=Backward
        # Tracking needs Forward, so we use v.
        return CmdVel(v=-v, w=w)
    
    def _send_cmd_vel(self, cmd: CmdVel) -> bool:
        """
        cmd_vel을 MQTT로 Pi에 전송
        """
        try:
            payload = {
                "v": round(cmd.v, 3),
                "w": round(cmd.w, 3),
                "source": "jetson"  # Pi에서 source 확인용
            }
            
            topic = settings.TOPIC_CMD_VEL
            mqtt_service.publish(topic, json.dumps(payload))
            
            # logger.info(f"🎯 [TRACKING] Sent cmd_vel: v={cmd.v:.2f}, w={cmd.w:.2f}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send cmd_vel: {e}")
            return False

# 싱글톤 인스턴스
tracking_service = TrackingService()
