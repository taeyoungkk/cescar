
import logging
import platform

logger = logging.getLogger(__name__)

class HardwareService:
    def __init__(self):
        self.is_jetson = platform.machine() == "aarch64" # 간단한 Jetson 감지 로직 (실제환경에 맞게 수정 가능)
        if self.is_jetson:
            logger.info("Jetson Nano 환경 감지됨. GPIO를 초기화합니다.")
            # import Jetson.GPIO as GPIO
            # GPIO.setmode(GPIO.BOARD)
            pass
        else:
            logger.info("Non-Jetson 환경 감지됨. 하드웨어 시뮬레이션 모드로 동작합니다.")

hardware_service = HardwareService()
