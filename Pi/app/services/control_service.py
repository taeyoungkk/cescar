"""
Control Service for Raspberry Pi Motor Control
Handles: MODE, ESTOP, watchdog, cmd_vel arbitration.
"""
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

import board
import busio
from app.controllers.motor_hat import MotorHatController
from app.controllers.steering_servo import SteeringServoController
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CmdVel:
    """Velocity command."""
    v: float  # forward/backward (-1.0 ~ 1.0)
    w: float  # steering input (-1.0 ~ 1.0 or rad/s)


class ControlService:
    """
    Control policy:
    - mode: MANUAL/AUTO
    - cmd_vel: ui vs jetson arbitration
    - estop: hard stop
    - watchdog: stop if no command within timeout
    """

    def __init__(self):
        self.mode: str = "MANUAL"
        self.estop: bool = False

        self.last_cmd: Optional[CmdVel] = None
        self.last_cmd_source: Optional[str] = None
        self.last_cmd_time: float = 0.0

        self._applied_stop: bool = True
        self._status_publisher: Optional[Callable[[Dict[str, Any]], None]] = None

        # Steering calibration (deg)
        self._steer_channel = 0  # change if needed
        self._steer_center = 115.0
        self._steer_scale = 40.0
        self._steer_min = 65.0
        self._steer_max = 165.0

        # Hardware controllers (same I2C bus, different addresses)
        self._motor: Optional[MotorHatController] = None
        self._steer: Optional[SteeringServoController] = None
        self._init_hardware()

        logger.info("ControlService initialized (mode=MANUAL)")

    def _init_hardware(self) -> None:
        try:
            print("[HW] Initializing I2C bus...")
            i2c = busio.I2C(board.SCL, board.SDA)
            print("[HW] I2C bus OK")
            
            print("[HW] Initializing MotorHat (0x40)...")
            self._motor = MotorHatController(
                i2c=i2c,
                address=0x40,
                pwma=0,
                ain1=1,
                ain2=2,
            )
            print("[HW] MotorHat OK")
            
            print("[HW] Initializing SteeringServo (0x60)...")
            self._steer = SteeringServoController(
                i2c=i2c,
                address=0x60,
                channel=self._steer_channel,
                center_deg=self._steer_center,
                steer_scale_deg=self._steer_scale,
                min_deg=self._steer_min,
                max_deg=self._steer_max,
            )
            print("[HW] SteeringServo OK")
            
            # Safe state on boot
            self._motor.stop()
            self._steer.center()
            print("[HW] ✓ All hardware initialized successfully")
            logger.info("All hardware initialized successfully")
            
        except OSError as e:
            logger.error(f"I2C communication error: {e}")
            print(f"[HW] ✗ I2C ERROR: {e}")
            print("[HW]   → Check I2C wiring and device addresses")
            print("[HW]   → Run 'i2cdetect -y 1' to scan devices")
            self._motor = None
            self._steer = None
        except Exception as e:
            logger.error(f"Hardware init failed: {e}")
            print(f"[HW] ✗ Hardware init FAILED: {e}")
            print(f"[HW]   → Exception type: {type(e).__name__}")
            self._motor = None
            self._steer = None

    def set_status_publisher(self, publisher: Callable[[Dict[str, Any]], None]) -> None:
        self._status_publisher = publisher

    def on_mode(self, payload: Dict[str, Any]) -> None:
        """Handle mode change (MANUAL/AUTO)."""
        mode = str(payload.get("mode", "")).upper()

        if mode not in ("AUTO", "MANUAL"):
            logger.warning(f"Invalid mode payload: {payload}")
            print(f"[MODE] invalid payload={payload}")
            return

        if self.mode != mode:
            self.mode = mode
            logger.info(f"Mode changed to: {self.mode}")
            print(f"[MODE] -> {self.mode}")
            self._publish_status()

    def on_estop(self, payload: Dict[str, Any]) -> None:
        """Handle emergency stop."""
        stop = bool(payload.get("stop", True))

        if stop and not self.estop:
            self.estop = True
            logger.warning("ESTOP activated!")
            print("[ESTOP] ON -> FORCE STOP")
            self._apply_stop(source="estop")
            self._publish_status()
        elif (not stop) and self.estop:
            self.estop = False
            logger.info("ESTOP deactivated")
            print("[ESTOP] OFF")
            self._publish_status()

    def on_cmd_vel(self, source: str, payload: Dict[str, Any]) -> None:
        """
        Handle velocity command.
        - source: "ui" or "jetson"
        - payload: {"v": float, "w": float}
        """
        try:
            v = float(payload.get("v", 0.0))
            w = float(payload.get("w", 0.0))
        except (TypeError, ValueError):
            logger.warning(f"Invalid cmd_vel numbers: source={source}, payload={payload}")
            print(f"[CMD] invalid numbers source={source} payload={payload}")
            return

        if self.estop:
            logger.debug(f"Command ignored (ESTOP): source={source}")
            print(f"[CMD] ignored (ESTOP) source={source} v={v} w={w}")
            return

        if self.mode == "MANUAL" and source != "ui":
            logger.debug(f"Command ignored (MANUAL mode): source={source}")
            print(f"[CMD] ignored (MANUAL mode) source={source} v={v} w={w}")
            return

        if self.mode == "AUTO" and source != "jetson":
            logger.debug(f"Command ignored (AUTO mode): source={source}")
            print(f"[CMD] ignored (AUTO mode) source={source} v={v} w={w}")
            return

        cmd = CmdVel(v=v, w=w)
        self.apply_cmd(cmd, source=source)

    def apply_cmd(self, cmd: CmdVel, source: str) -> None:
        """Apply command to hardware immediately."""
        # Clamp inputs to normalized range
        v = max(-1.0, min(1.0, cmd.v))
        w = max(-1.0, min(1.0, cmd.w))
        if v != cmd.v or w != cmd.w:
            logger.warning(
                "cmd_vel clamped: v %.3f->%.3f w %.3f->%.3f",
                cmd.v,
                v,
                cmd.w,
                w,
            )

        self.last_cmd = CmdVel(v=v, w=w)
        self.last_cmd_source = source
        self.last_cmd_time = time.time()
        self._applied_stop = (v == 0.0 and w == 0.0)

        if self._motor:
            self._motor.set_speed(v)
        else:
            logger.warning("Motor controller not initialized")

        if self._steer:
            self._steer.set_from_w(w)
        else:
            logger.warning("Steering controller not initialized")

        logger.info(f"Command applied: source={source}, v={v:.3f}, w={w:.3f}")
        print(f"[APPLY] source={source} mode={self.mode} v={v:.3f} w={w:.3f}")
        self._publish_status()

    def _apply_stop(self, source: str) -> None:
        self.last_cmd = CmdVel(0.0, 0.0)
        self.last_cmd_source = source
        self.last_cmd_time = time.time()
        self._applied_stop = True

        if self._motor:
            self._motor.stop()
        if self._steer:
            self._steer.center()

        logger.info("Stop applied: source=%s", source)
        print(f"[STOP] source={source} mode={self.mode}")

    def tick(self) -> None:
        """
        Periodic call (watchdog check). Recommended at 20Hz.
        """
        if self.estop:
            return

        if self.last_cmd_time <= 0:
            return

        elapsed_ms = (time.time() - self.last_cmd_time) * 1000.0

        if elapsed_ms > settings.WATCHDOG_MS:
            if not self._applied_stop:
                logger.warning(f"Watchdog triggered: {int(elapsed_ms)}ms no command")
                print(f"[WATCHDOG] {int(elapsed_ms)}ms no cmd -> STOP")
                self._apply_stop(source="watchdog")
                self._publish_status()

    def get_status(self) -> Dict[str, Any]:
        """Return current status."""
        steer_angle = self._steer.last_angle if self._steer else None
        v_val = self.last_cmd.v if self.last_cmd else 0.0
        w_val = self.last_cmd.w if self.last_cmd else 0.0
        return {
            "mode": self.mode,
            "estop": self.estop,
            "last_cmd_source": self.last_cmd_source,
            "last_cmd": {
                "v": v_val,
                "w": w_val,
            } if self.last_cmd else None,
            "speed": abs(v_val),
            "steer_angle": steer_angle,
        }

    def _publish_status(self) -> None:
        if not self._status_publisher:
            return
        self._status_publisher(self.get_status())

    def cleanup(self) -> None:
        self._apply_stop(source="cleanup")
        if self._motor:
            self._motor.deinit()
        logger.info("ControlService cleanup complete")


control_service = ControlService()
