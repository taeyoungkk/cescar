"""
Raspberry Pi MQTT Motor Controller
Main entry point for the application
"""
import logging
import signal
import sys
import time

from app.services.mqtt_service import mqtt_service
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
    print("  Raspberry Pi MQTT Motor Controller")
    print("=" * 50)
    print(f"  Broker: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
    print(f"  Robot ID: {settings.ROBOT_ID}")
    print(f"  Motor Topic: {settings.TOPIC_MOTOR_COMMAND}")
    print("=" * 50)
    
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # MQTT 연결
        mqtt_service.connect()
        
        # 연결 테스트 메시지 발행
        mqtt_service.publish_status({
            "device": "raspberry-pi",
            "robot_id": settings.ROBOT_ID,
            "status": "online",
            "message": "Pi MQTT service started"
        })
        
        print("\n[*] Waiting for MQTT messages... (Ctrl+C to exit)")
        
        # 메인 루프
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        logger.error(f"Error: {e}")
        mqtt_service.disconnect()
        sys.exit(1)


if __name__ == "__main__":
    main()
