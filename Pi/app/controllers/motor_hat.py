import logging
from typing import Optional

import board
import busio
from adafruit_pca9685 import PCA9685

logger = logging.getLogger(__name__)


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


class MotorHatController:
    """DC motor control via TB6612 on PCA9685 (Motor HAT)."""

    def __init__(
        self,
        i2c: Optional[busio.I2C] = None,
        address: int = 0x40,
        frequency: int = 1000,
        pwma: int = 0,
        ain1: int = 1,
        ain2: int = 2,
    ) -> None:
        self._i2c = i2c or busio.I2C(board.SCL, board.SDA)
        self._pca = PCA9685(self._i2c, address=address)
        self._pca.frequency = frequency

        self._pwma = pwma
        self._ain1 = ain1
        self._ain2 = ain2

        self._last_speed = 0.0
        logger.info(
            "MotorHat initialized addr=0x%02X freq=%d pwma=%d ain1=%d ain2=%d",
            address,
            frequency,
            pwma,
            ain1,
            ain2,
        )

    @property
    def last_speed(self) -> float:
        return self._last_speed

    def stop(self) -> None:
        self._pca.channels[self._pwma].duty_cycle = 0
        self._pca.channels[self._ain1].duty_cycle = 0
        self._pca.channels[self._ain2].duty_cycle = 0
        self._last_speed = 0.0
        logger.debug("Motor stop")

    def set_speed(self, v: float) -> None:
        """
        Set speed using signed normalized input.
        v in [-1.0, 1.0], sign -> direction.
        """
        v = _clamp(v, -1.0, 1.0)

        if v == 0.0:
            self.stop()
            return

        speed = abs(v)
        duty = int(speed * 0xFFFF)

        if v > 0.0:
            self._pca.channels[self._ain1].duty_cycle = 0xFFFF
            self._pca.channels[self._ain2].duty_cycle = 0
        else:
            self._pca.channels[self._ain1].duty_cycle = 0
            self._pca.channels[self._ain2].duty_cycle = 0xFFFF

        self._pca.channels[self._pwma].duty_cycle = duty
        self._last_speed = v
        logger.debug("Motor set v=%.3f duty=%d", v, duty)

    def deinit(self) -> None:
        try:
            self.stop()
        finally:
            self._pca.deinit()
            logger.info("MotorHat deinit")
