import logging
from typing import Optional

import board
import busio
from adafruit_servokit import ServoKit

logger = logging.getLogger(__name__)


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


class SteeringServoController:
    """Steering servo control via PCA9685 (ServoKit)."""

    def __init__(
        self,
        i2c: Optional[busio.I2C] = None,
        address: int = 0x60,
        channel: int = 0,  # change if your servo uses a different channel
        center_deg: float = 115.0,
        steer_scale_deg: float = 25.0,
        min_deg: float = 85.0,
        max_deg: float = 145.0,
        pulse_min_us: int = 500,
        pulse_max_us: int = 2500,
    ) -> None:
        self._i2c = i2c or busio.I2C(board.SCL, board.SDA)
        self._kit = ServoKit(channels=16, i2c=self._i2c, address=address)

        self._channel = channel
        self._center = center_deg
        self._scale = steer_scale_deg
        self._min = min_deg
        self._max = max_deg

        self._kit.servo[self._channel].set_pulse_width_range(
            pulse_min_us,
            pulse_max_us,
        )

        self._last_angle = center_deg
        logger.info(
            "SteeringServo initialized addr=0x%02X ch=%d center=%.1f scale=%.1f min=%.1f max=%.1f",
            address,
            channel,
            center_deg,
            steer_scale_deg,
            min_deg,
            max_deg,
        )

    @property
    def last_angle(self) -> float:
        return self._last_angle

    def center(self) -> None:
        self.set_angle(self._center)

    def set_angle(self, angle_deg: float) -> None:
        angle = _clamp(angle_deg, self._min, self._max)
        self._kit.servo[self._channel].angle = angle
        self._last_angle = angle
        logger.debug("Steer set angle=%.1f", angle)

    def set_from_w(self, w: float) -> None:
        """
        Map steering input to angle.
        w in [-1.0, 1.0] (or rad/s, treated as normalized by clamp).
        """
        w = _clamp(w, -1.0, 1.0)
        angle = self._center + (w * self._scale)
        self.set_angle(angle)
