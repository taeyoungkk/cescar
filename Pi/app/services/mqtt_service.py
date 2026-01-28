"""
MQTT Service for Raspberry Pi Motor Control
MQTT 연결/구독/발행 담당. 수신 메시지는 control_service로 전달.
"""
import json
import logging
from typing import Optional, Callable, Dict, Any
from paho.mqtt import client as mqtt_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt_client.Client] = None
        self.message_handlers: Dict[str, Callable] = {}
        self._control_service = None  # control_service 주입용
    
    def set_control_service(self, control_service):
        """ControlService 인스턴스 주입"""
        self._control_service = control_service
        logger.info("ControlService connected to MQTTService")
    
    def initialize(self):
        """MQTT 클라이언트 초기화"""
        client_id = f"raspberry-pi-{settings.ROBOT_ID}"
        self.client = mqtt_client.Client(
            client_id=client_id,
            callback_api_version=mqtt_client.CallbackAPIVersion.VERSION2
        )
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
    
    def connect(self):
        """MQTT 브로커에 연결"""
        if not self.client:
            self.initialize()
        
        try:
            logger.info(f"Connecting to MQTT Broker: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
            self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT)
            self.client.loop_start()
            logger.info("MQTT Service Started")
        except Exception as e:
            logger.error(f"MQTT Connection Failed: {e}")
            raise
    
    def disconnect(self):
        """MQTT 연결 해제"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT Service Stopped")
    
    def on_connect(self, client, userdata, flags, rc, properties=None):
        """연결 성공 시 콜백 - 제어 관련 토픽 구독"""
        if rc == 0:
            print(f"[*] MQTT Connected to {settings.MQTT_BROKER}!")
            logger.info(f"Connected to MQTT Broker: {settings.MQTT_BROKER}")
            
            # 제어 토픽 구독
            topics = [
                settings.TOPIC_MODE,        # 모드 변경 (MANUAL/AUTO)
                settings.TOPIC_UI_CMD,      # UI 명령
                settings.TOPIC_JETSON_CMD,  # Jetson 명령
                settings.TOPIC_ESTOP,       # 비상정지
            ]
            
            for topic in topics:
                client.subscribe(topic)
                print(f"[*] Subscribed to: {topic}")
        else:
            print(f"[!] MQTT Connection Failed with code: {rc}")
            logger.error(f"Failed to connect, return code {rc}")
    
    def on_disconnect(self, client, userdata, disconnect_flags, rc, properties=None):
        """연결 해제 시 콜백"""
        logger.warning(f"MQTT Disconnected with code: {rc}")
        print(f"[!] MQTT Disconnected with code: {rc}")
    
    def on_message(self, client, userdata, msg):
        """메시지 수신 시 콜백 - control_service로 전달"""
        try:
            payload_str = msg.payload.decode()
            print(f"\n[>>>] Message Received on {msg.topic}: {payload_str}")
            logger.info(f"MQTT Received: {msg.topic} -> {payload_str}")
            
            # JSON 파싱
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {payload_str}")
                return
            
            # control_service로 전달
            if self._control_service:
                self._dispatch_to_control(msg.topic, payload)
            else:
                logger.warning("ControlService not connected")
                
        except Exception as e:
            logger.error(f"Message processing error: {e}")
    
    def _dispatch_to_control(self, topic: str, payload: Dict[str, Any]):
        """토픽에 따라 control_service 메서드 호출"""
        if topic == settings.TOPIC_MODE:
            self._control_service.on_mode(payload)
        elif topic == settings.TOPIC_ESTOP:
            self._control_service.on_estop(payload)
        elif topic == settings.TOPIC_UI_CMD:
            self._control_service.on_cmd_vel("ui", payload)
        elif topic == settings.TOPIC_JETSON_CMD:
            self._control_service.on_cmd_vel("jetson", payload)
        else:
            logger.debug(f"Unknown topic: {topic}")
    
    def register_handler(self, topic: str, handler: Callable):
        """특정 토픽에 대한 커스텀 핸들러 등록"""
        self.message_handlers[topic] = handler
        logger.info(f"Handler registered for topic: {topic}")
    
    def publish(self, topic: str, message: str) -> bool:
        """메시지 발행"""
        if self.client and self.client.is_connected():
            result = self.client.publish(topic, message)
            if result.rc == 0:
                logger.info(f"Published to {topic}: {message}")
                return True
            else:
                logger.error(f"Publish failed with code: {result.rc}")
                return False
        else:
            logger.warning("MQTT not connected. Cannot publish.")
            return False
    
    def publish_motor_status(self, status: Dict[str, Any]):
        """모터 상태 발행"""
        message = json.dumps(status)
        return self.publish(settings.TOPIC_MOTOR_STATUS, message)
    
    def publish_status(self, status: Dict[str, Any]):
        """일반 상태 발행"""
        message = json.dumps(status)
        return self.publish(settings.TOPIC_STATUS, message)


# 싱글톤 인스턴스
mqtt_service = MQTTService()
