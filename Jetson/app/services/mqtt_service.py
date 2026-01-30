
import logging
from typing import Optional
from paho.mqtt import client as mqtt_client
from app.core.config import settings

logger = logging.getLogger(__name__)

class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt_client.Client] = None

    def initialize(self):
        client_id = f"fastapi-client-{settings.ROBOT_ID}"
        self.client = mqtt_client.Client(client_id=client_id, callback_api_version=mqtt_client.CallbackAPIVersion.VERSION2)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

    def connect(self):
        if not self.client:
            self.initialize()

        try:
            self.client.connect(settings.MQTT_BROKER, settings.MQTT_PORT)
            self.client.loop_start()
            logger.info("MQTT Service Started")
        except Exception as e:
            logger.error(f"MQTT Connection Failed: {e}")

    def disconnect(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT Service Stopped")

    def on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            print(f"[*] MQTT Connected to {settings.MQTT_BROKER}!")
            logger.info(f"Connected to MQTT Broker: {settings.MQTT_BROKER}")
            client.subscribe(settings.TOPIC_COMMAND)
            print(f"[*] Subscribed to: {settings.TOPIC_COMMAND}")
        else:
            print(f"[!] MQTT Connection Failed with code: {rc}")
            logger.error(f"Failed to connect, return code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            payload = msg.payload.decode()
            print(f"\n[>>>] Message Received on {msg.topic}: {payload}")
            logger.info(f"MQTT Received: {msg.topic} -> {payload}")
            # TODO: Handle commands received via MQTT here
            # e.g., dispatch to hardware_service.move_robot(...)
        except Exception as e:
            logger.error(f"Message processing error: {e}")

    def publish(self, topic: str, message: str):
        if self.client and self.client.is_connected():
            return self.client.publish(topic, message)
        else:
            logger.warning("MQTT not connected. Cannot publish.")
            return None

mqtt_service = MQTTService()
