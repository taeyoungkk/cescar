
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
            
            # Subscribe to topics
            topics = [
                (settings.TOPIC_COMMAND, 0),
                (settings.TOPIC_MODE, 0),
                (settings.TOPIC_CONTROL, 0),
                (f"robot/+/+", 0)  # [DEBUG] Watch ALL robot topics
            ]
            client.subscribe(topics)
            print(f"[*] Subscribed to: {[t[0] for t in topics]}")
        else:
            print(f"[!] MQTT Connection Failed with code: {rc}")
            logger.error(f"Failed to connect, return code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            payload = msg.payload.decode()
            
            # [DEBUG] odom/status 로그는 너무 많아서 제외하고 중요 메시지만 출력
            # if "odom" not in msg.topic and "status" not in msg.topic:
                # print(f"\n[>>>] Message Received on {msg.topic}: {payload}")
                # logger.info(f"MQTT Received: {msg.topic} -> {payload}")
            
            import json
            data = json.loads(payload)
            
            # 1. Mode Change Protocol (Backend sends to .../mode)
            if msg.topic == settings.TOPIC_MODE:
                mode = data.get("mode", "").upper()
                from app.services.tracking_service import tracking_service
                
                if mode == "AUTO" or mode == "TRACK":
                    tracking_service.start_tracking()
                    print(f"[MODE] -> TRACKING ON (Received via {msg.topic})")
                elif mode == "MANUAL" or mode == "OFF" or mode == "STOP":
                    tracking_service.stop_tracking()
                    print(f"[MODE] -> TRACKING OFF (Received via {msg.topic})")
            
            # 2. Manual Control Protocol (Backend sends to .../control)
            elif msg.topic == settings.TOPIC_CONTROL:
                # Backend sends: {"v": -0.5, "w": 0.0} (inverted values)
                v = float(data.get("v", 0.0))
                w = float(data.get("w", 0.0))
                
                # Forward to Pi immediately (bypass tracking service logic)
                # Pi expects: {"v": ..., "w": ..., "source": "jetson"}
                # Note: We might need to invert v back if Pi expects positive for forward
                # For now, forwarding as is (assuming Backend intentions are correct for the robot)
                
                cmd_payload = {
                    "v": v, 
                    "w": w,
                    "source": "manual_control"
                }
                self.publish(settings.TOPIC_CMD_VEL, json.dumps(cmd_payload))
                # logger.debug(f"[MANUAL] v={v}, w={w}")

            # 3. Legacy Command Protocol (Unified topic)
            elif msg.topic == settings.TOPIC_COMMAND:
                cmd_type = data.get("type", "")
                if cmd_type == "mode":
                    mode = data.get("mode", "").upper()
                    from app.services.tracking_service import tracking_service
                    
                    if mode == "AUTO" or mode == "TRACK":
                        tracking_service.start_tracking()
                    elif mode == "MANUAL" or mode == "OFF":
                        tracking_service.stop_tracking()
                        
        except Exception as e:
            logger.error(f"Message processing error: {e}")

    def publish(self, topic: str, message: str):
        if self.client and self.client.is_connected():
            return self.client.publish(topic, message)
        else:
            logger.warning("MQTT not connected. Cannot publish.")
            return None

mqtt_service = MQTTService()
