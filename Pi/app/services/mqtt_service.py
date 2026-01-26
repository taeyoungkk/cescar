"""
MQTT Service for Raspberry Pi Motor Control
Jetson의 mqtt_service.py와 동일한 구조로 구현
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
        """연결 성공 시 콜백"""
        if rc == 0:
            print(f"[*] MQTT Connected to {settings.MQTT_BROKER}!")
            logger.info(f"Connected to MQTT Broker: {settings.MQTT_BROKER}")
            
            # 모터 명령 토픽 구독
            client.subscribe(settings.TOPIC_MOTOR_COMMAND)
            print(f"[*] Subscribed to: {settings.TOPIC_MOTOR_COMMAND}")
            
            # 일반 명령 토픽 구독 (Jetson으로부터 받을 수 있음)
            client.subscribe(settings.TOPIC_COMMAND)
            print(f"[*] Subscribed to: {settings.TOPIC_COMMAND}")
        else:
            print(f"[!] MQTT Connection Failed with code: {rc}")
            logger.error(f"Failed to connect, return code {rc}")
    
    def on_disconnect(self, client, userdata, disconnect_flags, rc, properties=None):
        """연결 해제 시 콜백"""
        logger.warning(f"MQTT Disconnected with code: {rc}")
        print(f"[!] MQTT Disconnected with code: {rc}")
    
    def on_message(self, client, userdata, msg):
        """메시지 수신 시 콜백"""
        try:
            payload = msg.payload.decode()
            print(f"\n[>>>] Message Received on {msg.topic}: {payload}")
            logger.info(f"MQTT Received: {msg.topic} -> {payload}")
            
            # 등록된 핸들러가 있으면 호출
            if msg.topic in self.message_handlers:
                self.message_handlers[msg.topic](payload)
            else:
                self._handle_default(msg.topic, payload)
                
        except Exception as e:
            logger.error(f"Message processing error: {e}")
    
    def _handle_default(self, topic: str, payload: str):
        """기본 메시지 핸들러"""
        try:
            data = json.loads(payload)
            command = data.get("command", "")
            
            if topic == settings.TOPIC_MOTOR_COMMAND:
                self._handle_motor_command(data)
            elif topic == settings.TOPIC_COMMAND:
                self._handle_general_command(data)
                
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received: {payload}")
    
    def _handle_motor_command(self, data: Dict[str, Any]):
        """모터 명령 처리 (TODO: 실제 모터 제어 로직 연결)"""
        command = data.get("command", "")
        print(f"[MOTOR] Command received: {command}")
        # TODO: motor_service.execute(command, data)
    
    def _handle_general_command(self, data: Dict[str, Any]):
        """일반 명령 처리"""
        command = data.get("command", "")
        print(f"[GENERAL] Command received: {command}")
    
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
