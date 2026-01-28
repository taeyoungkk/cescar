"""
Control Service for Raspberry Pi Motor Control
제어 로직 담당: MODE, ESTOP, Watchdog, 명령 우선순위 처리
"""
import time
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CmdVel:
    """속도 명령 데이터"""
    v: float  # 선속도 (전진/후진)
    w: float  # 각속도 (회전)


class ControlService:
    """
    제어 정책 관리:
    - mode: MANUAL/AUTO
    - cmd_vel: ui vs jetson 우선순위
    - estop: 무조건 stop
    - watchdog: 일정 시간 명령 없으면 stop
    """
    
    def __init__(self):
        self.mode: str = "MANUAL"
        self.estop: bool = False
        
        self.last_cmd: Optional[CmdVel] = None
        self.last_cmd_source: Optional[str] = None
        self.last_cmd_time: float = 0.0
        
        self._applied_stop: bool = True  # 중복 stop 출력 방지
        
        logger.info("ControlService initialized (mode=MANUAL)")
    
    def on_mode(self, payload: Dict[str, Any]) -> None:
        """모드 변경 처리 (MANUAL/AUTO)"""
        mode = str(payload.get("mode", "")).upper()
        
        if mode not in ("AUTO", "MANUAL"):
            logger.warning(f"Invalid mode payload: {payload}")
            print(f"[MODE] invalid payload={payload}")
            return
        
        if self.mode != mode:
            self.mode = mode
            logger.info(f"Mode changed to: {self.mode}")
            print(f"[MODE] -> {self.mode}")
    
    def on_estop(self, payload: Dict[str, Any]) -> None:
        """비상정지 처리"""
        stop = payload.get("stop", True)
        stop = bool(stop)
        
        if stop and not self.estop:
            self.estop = True
            logger.warning("ESTOP activated!")
            print("[ESTOP] ON -> FORCE STOP")
            self.apply_cmd(CmdVel(0.0, 0.0), source="estop")
        elif (not stop) and self.estop:
            self.estop = False
            logger.info("ESTOP deactivated")
            print("[ESTOP] OFF")
    
    def on_cmd_vel(self, source: str, payload: Dict[str, Any]) -> None:
        """
        속도 명령 처리
        - source: "ui" 또는 "jetson"
        - payload: {"v": float, "w": float}
        """
        try:
            v = float(payload.get("v", 0.0))
            w = float(payload.get("w", 0.0))
        except (TypeError, ValueError):
            logger.warning(f"Invalid cmd_vel numbers: source={source}, payload={payload}")
            print(f"[CMD] invalid numbers source={source} payload={payload}")
            return
        
        # ESTOP 활성화 시 모든 명령 무시
        if self.estop:
            logger.debug(f"Command ignored (ESTOP): source={source}")
            print(f"[CMD] ignored (ESTOP) source={source} v={v} w={w}")
            return
        
        # 모드에 따른 명령 필터링
        if self.mode == "MANUAL" and source != "ui":
            logger.debug(f"Command ignored (MANUAL mode): source={source}")
            print(f"[CMD] ignored (MANUAL mode) source={source} v={v} w={w}")
            return
        
        if self.mode == "AUTO" and source != "jetson":
            logger.debug(f"Command ignored (AUTO mode): source={source}")
            print(f"[CMD] ignored (AUTO mode) source={source} v={v} w={w}")
            return
        
        # 명령 적용
        cmd = CmdVel(v=v, w=w)
        self.apply_cmd(cmd, source=source)
    
    def apply_cmd(self, cmd: CmdVel, source: str) -> None:
        """
        명령 적용 (현재는 print, 나중에 실제 모터 제어로 교체)
        """
        self.last_cmd = cmd
        self.last_cmd_source = source
        self.last_cmd_time = time.time()
        self._applied_stop = (cmd.v == 0.0 and cmd.w == 0.0)
        
        # TODO: 실제 모터 제어 로직
        # motor_driver.set_velocity(cmd.v, cmd.w)
        
        logger.info(f"Command applied: source={source}, v={cmd.v:.3f}, w={cmd.w:.3f}")
        print(f"[APPLY] source={source} mode={self.mode} v={cmd.v:.3f} w={cmd.w:.3f}")
    
    def tick(self) -> None:
        """
        주기적으로 호출 (watchdog 체크)
        메인 루프에서 약 20Hz로 호출 권장
        """
        # ESTOP 활성화 시 watchdog 무시
        if self.estop:
            return
        
        # 아직 명령 받은 적 없으면 무시
        if self.last_cmd_time <= 0:
            return
        
        # Watchdog: 일정 시간 명령 없으면 stop
        elapsed_ms = (time.time() - self.last_cmd_time) * 1000.0
        
        if elapsed_ms > settings.WATCHDOG_MS:
            # 이미 stop 적용했으면 중복 출력 방지
            if not self._applied_stop:
                logger.warning(f"Watchdog triggered: {int(elapsed_ms)}ms no command")
                print(f"[WATCHDOG] {int(elapsed_ms)}ms no cmd -> STOP")
                self.apply_cmd(CmdVel(0.0, 0.0), source="watchdog")
    
    def get_status(self) -> Dict[str, Any]:
        """현재 상태 반환"""
        return {
            "mode": self.mode,
            "estop": self.estop,
            "last_cmd_source": self.last_cmd_source,
            "last_cmd": {
                "v": self.last_cmd.v if self.last_cmd else 0.0,
                "w": self.last_cmd.w if self.last_cmd else 0.0
            } if self.last_cmd else None
        }


# 싱글톤 인스턴스
control_service = ControlService()
