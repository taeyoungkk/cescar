"""
Raspberry Pi MQTT Motor Controller
Main entry point - MQTT 연결, 제어 서비스, Odometry 발행 실행
"""
import logging
import signal
import sys
import time

from app.services.mqtt_service import mqtt_service
from app.services.control_service import control_service
from app.services.odom_service import odom_service
from app.controllers.encoder_controller import EncoderController
from app.core.config import settings

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 엔코더 컨트롤러 (전역)
encoder: EncoderController = None


def signal_handler(sig, frame):
    """Ctrl+C 핸들러"""
    print("\n[*] Shutting down...")
    control_service.cleanup()
    if encoder:
        encoder.cleanup()
    mqtt_service.disconnect()
    sys.exit(0)


def main():
    """메인 함수"""
    global encoder
    
    print("=" * 50)
    print("  Raspberry Pi Motor Controller + Odom (MQTT)")
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
    print(f"    ODOM:    {settings.TOPIC_ODOM}")
    print("=" * 50)
    
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 엔코더 초기화
    try:
        encoder = EncoderController(
            pin_a=settings.ENCODER_PIN_A,
            pin_b=settings.ENCODER_PIN_B,
            ppr=settings.ENCODER_PPR,
            wheel_diameter_m=settings.WHEEL_DIAMETER_M,
        )
    except Exception as e:
        logger.warning(f"Encoder init failed, continuing without odom: {e}")
        encoder = None
    
    # Odom 서비스 설정
    if encoder:
        odom_service.set_encoder(encoder)
    
    # control_service에서 steering 가져와서 odom에 연결
    if control_service._steer:
        odom_service.set_steering(control_service._steer)
    
    # control_service를 mqtt_service에 연결
    mqtt_service.set_control_service(control_service)
    
    try:
        # MQTT 연결
        mqtt_service.connect()
        
        # Odom 발행 설정
        odom_service.set_publisher(mqtt_service.publish, settings.TOPIC_ODOM)
        
        print("\n[*] Waiting for MQTT messages... (Ctrl+C to exit)")
        print("[*] Default mode: MANUAL")
        if encoder:
            print("[*] Odometry: ENABLED")
        else:
            print("[*] Odometry: DISABLED (encoder not available)")
        print()
        
        # 메인 루프
        while True:
            control_service.tick()  # Watchdog 체크
            odom_service.tick()     # Odom 계산 및 발행
            time.sleep(0.05)        # 50ms = 20Hz
            
    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        logger.error(f"Error: {e}")
        control_service.cleanup()
        if encoder:
            encoder.cleanup()
        mqtt_service.disconnect()
        sys.exit(1)


if __name__ == "__main__":
    main()
