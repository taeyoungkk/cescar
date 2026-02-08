"""
Auto Mode Controller for Jetson

AUTO 모드에서 PATROL ↔ TRACKING 상태를 관리하는 컨트롤러.
탐지 시 트래킹으로 전환, 타겟 소실 시 패트롤로 복귀.
"""

import logging
import time
import threading
from enum import Enum
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class AutoModeState(str, Enum):
    """AUTO 모드 상태"""
    IDLE = "IDLE"           # 대기 (AUTO 모드 아님)
    PATROL = "PATROL"       # 패트롤 중
    TRACKING = "TRACKING"   # 트래킹 중


class AutoModeController:
    """
    AUTO 모드 상태 컨트롤러
    
    - PATROL: 지그재그 패턴으로 방 순찰
    - TRACKING: 바퀴벌레 발견 시 추적
    
    전환 조건:
    - PATROL → TRACKING: YOLO 탐지 발생
    - TRACKING → PATROL: N프레임 연속 타겟 소실
    """
    
    def __init__(self):
        self._state = AutoModeState.IDLE
        self._state_lock = threading.Lock()
        
        # 타겟 소실 감지
        self._no_detection_count = 0
        self._no_detection_threshold = 30  # 30프레임 (약 3초) 연속 미탐지 시 패트롤 복귀
        
        # 탐지 상태
        self._last_detection_time = 0
        self._detection_timeout = 3.0  # 3초 타임아웃
        
        logger.info("AutoModeController initialized")

    def start(self) -> None:
        """AUTO 모드 시작 (패트롤 시작)"""
        from app.services.patrol_service import patrol_service
        
        with self._state_lock:
            if self._state != AutoModeState.IDLE:
                logger.info(f"Already in {self._state.value} state")
                return
            
            self._state = AutoModeState.PATROL
            self._no_detection_count = 0
        
        patrol_service.start_patrol()
        logger.info("🚀 AUTO mode STARTED (PATROL)")
        print("[AUTO] 자동 모드 시작 - 패트롤 시작")

    def stop(self) -> None:
        """AUTO 모드 중지"""
        from app.services.patrol_service import patrol_service
        from app.services.tracking_service import tracking_service
        
        with self._state_lock:
            prev_state = self._state
            self._state = AutoModeState.IDLE
        
        # 모든 서비스 중지
        if prev_state == AutoModeState.PATROL:
            patrol_service.stop_patrol()
        elif prev_state == AutoModeState.TRACKING:
            tracking_service.stop_tracking()
        
        logger.info("🛑 AUTO mode STOPPED")
        print("[AUTO] 자동 모드 중지")

    def get_state(self) -> AutoModeState:
        """현재 상태 반환"""
        with self._state_lock:
            return self._state

    def is_active(self) -> bool:
        """AUTO 모드 활성화 여부"""
        with self._state_lock:
            return self._state != AutoModeState.IDLE

    def on_detection(self, detections: List[Dict[str, Any]]) -> None:
        """
        YOLO 탐지 결과 수신 (detection_service에서 호출)
        
        탐지가 있으면 TRACKING 모드로 전환
        """
        with self._state_lock:
            current_state = self._state
        
        if current_state == AutoModeState.IDLE:
            return  # AUTO 모드가 아니면 무시
        
        if detections:
            # 탐지 있음
            self._no_detection_count = 0
            self._last_detection_time = time.time()
            
            if current_state == AutoModeState.PATROL:
                self._switch_to_tracking()
        else:
            # 탐지 없음
            self._no_detection_count += 1
            
            if current_state == AutoModeState.TRACKING:
                # 타겟 소실 체크
                if self._no_detection_count >= self._no_detection_threshold:
                    self._switch_to_patrol()

    def on_frame_processed(self, has_detection: bool) -> None:
        """
        프레임 처리 완료 시 호출 (매 프레임마다)
        
        트래킹 모드에서 타겟 소실 감지용
        """
        with self._state_lock:
            current_state = self._state
        
        if current_state != AutoModeState.TRACKING:
            return
        
        if not has_detection:
            self._no_detection_count += 1
            
            if self._no_detection_count >= self._no_detection_threshold:
                self._switch_to_patrol()
        else:
            self._no_detection_count = 0

    def _switch_to_tracking(self) -> None:
        """PATROL → TRACKING 전환"""
        from app.services.patrol_service import patrol_service
        from app.services.tracking_service import tracking_service
        
        with self._state_lock:
            if self._state != AutoModeState.PATROL:
                return
            self._state = AutoModeState.TRACKING
        
        # 패트롤 일시 정지, 트래킹 시작
        patrol_service.pause_patrol()
        tracking_service.start_tracking()
        
        logger.info("🎯 Switched to TRACKING mode (detection triggered)")
        print("[AUTO] 🎯 바퀴벌레 탐지! 트래킹 모드로 전환")

    def _switch_to_patrol(self) -> None:
        """TRACKING → PATROL 전환"""
        from app.services.patrol_service import patrol_service
        from app.services.tracking_service import tracking_service
        
        with self._state_lock:
            if self._state != AutoModeState.TRACKING:
                return
            self._state = AutoModeState.PATROL
            self._no_detection_count = 0
        
        # 트래킹 중지, 패트롤 재개
        tracking_service.stop_tracking()
        patrol_service.resume_patrol()
        
        logger.info("🚗 Switched to PATROL mode (target lost)")
        print("[AUTO] 🚗 타겟 소실, 패트롤 모드로 복귀")

    def get_status(self) -> dict:
        """상태 정보 반환"""
        with self._state_lock:
            return {
                "state": self._state.value,
                "is_active": self._state != AutoModeState.IDLE,
                "no_detection_count": self._no_detection_count,
                "last_detection_time": self._last_detection_time
            }


# 싱글톤 인스턴스
auto_mode_controller = AutoModeController()
