"""
Raspberry Pi MQTT Motor Controller
Main entry point - MQTT 연결 및 제어 서비스 실행
"""
import logging
import signal
import sys
import time

from app.services.mqtt_service import mqtt_service
from app.services.control_service import control_service
from app.core.config import settings

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def signal_handler(sig, frame):
    """Ctrl+C 핸들러"""
    print("\n[*] Shutting down...")
    mqtt_service.disconnect()
    sys.exit(0)


def main():
    """메인 함수"""
    print("=" * 50)
    print("  Raspberry Pi Motor Controller")
    print("=" * 50)
    print(f"  Broker: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
    print(f"  Robot ID: {settings.ROBOT_ID}")
    print(f"  Watchdog: {settings.WATCHDOG_MS}ms")
    print("-" * 50)
    print("  Topics:")
    print(f"    MODE:    {settings.TOPIC_MODE}")
    print(f"    UI_CMD:  {settings.TOPIC_UI_CMD}")
    print(f"    JETSON:  {settings.TOPIC_JETSON_CMD}")
    print(f"    ESTOP:   {settings.TOPIC_ESTOP}")
    print("=" * 50)
    
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # control_service를 mqtt_service에 연결
    mqtt_service.set_control_service(control_service)
    
    try:
        # MQTT 연결
        mqtt_service.connect()
        
        print("\n[*] Waiting for MQTT messages... (Ctrl+C to exit)")
        print("[*] Default mode: MANUAL")
        print()
        
        # 메인 루프 (20Hz로 tick 호출)
        while True:
            control_service.tick()  # Watchdog 체크
            time.sleep(0.05)  # 50ms = 20Hz
            
    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        logger.error(f"Error: {e}")
        mqtt_service.disconnect()
        sys.exit(1)


if __name__ == "__main__":
    main()
