
import logging
import time
from typing import Optional
from paho.mqtt import client as mqtt_client
from app.core.config import settings

logger = logging.getLogger(__name__)

class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt_client.Client] = None
        self.last_map_request_id = None
        self.last_map_request_time = 0

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
                (f"robot/+/map_generate", 0)
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

            # 3. 레거시 명령 프로토콜 (통합 토픽)
            elif msg.topic == settings.TOPIC_COMMAND:
                cmd_type = data.get("type", "")
                if cmd_type == "mode":
                    mode = data.get("mode", "").upper()
                    from app.services.tracking_service import tracking_service
                    
                    if mode == "AUTO" or mode == "TRACK":
                        tracking_service.start_tracking()
                    elif mode == "MANUAL" or mode == "OFF":
                        tracking_service.stop_tracking()

            # 4. 지도 생성 프로토콜
            elif "map_generate" in msg.topic:
                request_id = data.get("requestId")
                
                # 중복 요청 방지 (2초 내 동일 ID 무시)
                current_time = time.time()
                if request_id == self.last_map_request_id and (current_time - self.last_map_request_time) < 2.0:
                    logger.warning(f"Duplicate map request ignored: {request_id}")
                    return

                self.last_map_request_id = request_id
                self.last_map_request_time = current_time

                print(f"[MAP] 요청 수신: ID={request_id}")
                
                if request_id:
                    import asyncio
                    from app.services.map_service import map_service
                    
                    # paho-mqtt의 콜백 스레드에는 이벤트 루프가 없으므로 asyncio.run()을 사용하여 실행해야 합니다.
                    # 하지만 asyncio.run()은 블로킹되므로 별도 스레드에서 실행하거나 create_task를 쓰려면 
                    # 메인 루프에 threadsafe하게 던져야 합니다.
                    # 여기서는 간단하고 안전하게 별도 실행을 위해 asyncio.run()을 쓰되,
                    # MQTT 수신이 막히지 않으려면 이 자체를 스레드로 분리하거나 해야 합니다.
                    # map_service 내부가 비동기이므로, 안전하게 실행하기 위해 run_in_executor를 
                    # 흉내낼 수도 있지만, 가장 확실한 방법은 loop.run_in_executor를 사용하는 것입니다.
                    # 그러나 현재 콜백내라 루프 접근이 어려우므로, asyncio.run()을 쓰되 
                    # 이것이 블로킹되지 않게 threading.Thread를 사용합니다.
                    
                    import threading
                    def run_async_task():
                        asyncio.run(map_service.generate_map_task(request_id))
                    
                    threading.Thread(target=run_async_task, daemon=True).start()

        except Exception as e:
            logger.error(f"Message processing error: {e}")

    def publish(self, topic: str, message: str):
        if self.client and self.client.is_connected():
            return self.client.publish(topic, message)
        else:
            logger.warning("MQTT not connected. Cannot publish.")
            return None

mqtt_service = MQTTService()
