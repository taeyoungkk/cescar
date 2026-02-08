import json
import logging
import time
from typing import Optional
from paho.mqtt import client as mqtt_client
from app.core.config import settings

logger = logging.getLogger(__name__)

import threading

class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt_client.Client] = None
        self.last_map_request_id = None
        self.last_map_request_time = 0
        self._stop_burst_flag = False  # 정지 명령 반복 전송 중단 플래그

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
            # robot/{deviceId}/mode 형식을 지원하기 위해 robot/+/mode 구독
            # Payload: {"mode": "AUTO"} -> Explore Start
            # Payload: {"mode": "MANUAL"} -> Explore Stop
            topics = [
                (settings.TOPIC_COMMAND, 0),
                (f"robot/+/mode", 0),  # settings.TOPIC_MODE 대체 및 wildcard 적용
                (settings.TOPIC_CONTROL, 0),
                (f"robot/+/map_generate", 0),
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
            
            # 1. Mode Change Protocol (robot/+/mode)
            # Topic 예: robot/jetson_nano/mode
            if msg.topic.endswith("/mode"):
                mode = data.get("mode", "").upper()
                from app.services.tracking_service import tracking_service
                from app.services.explore_service import explore_service
                from app.services.auto_mode_controller import auto_mode_controller
                
                if mode == "AUTO":
                    # AUTO 모드 시작 (패트롤 + 트래킹 자동 전환)
                    self._stop_burst_flag = True # Stop Burst 중단
                    logger.info("Starting AUTO mode (patrol + tracking)")
                    auto_mode_controller.start()
                    print(f"[MODE] -> AUTO STARTED (Received via {msg.topic})")
                
                elif mode == "EXPLORE":
                    # 레거시 Explore 모드 (영상 촬영용)
                    self._stop_burst_flag = True
                    logger.info("Starting explore service (legacy)")
                    explore_service.start_explore()
                    print(f"[MODE] -> EXPLORE STARTED (Received via {msg.topic})")
                    
                elif mode == "TRACK":
                    # Tracking 모드 시작
                    self._stop_burst_flag = True # Stop Burst 중단
                    tracking_service.start_tracking()
                    print(f"[MODE] -> TRACKING STARTED (Received via {msg.topic})")
                    
                elif mode == "MANUAL" or mode == "OFF" or mode == "STOP":
                    # [Fast Stop 1] 즉시 정지 명령 전송 (가장 우선, Non-blocking)
                    stop_payload = {"v": 0.0, "w": 0.0, "source": "emergency_stop"}
                    self.publish(settings.TOPIC_CMD_VEL, json.dumps(stop_payload))
                    
                    # [Fast Stop 2] 무거운 정리 작업은 별도 스레드로 분리하여 MQTT 루프 차단 방지
                    import threading
                    def _stop_task():
                        # Burst Stop 실행 (반복 전송)
                        self.burst_stop() 
                        
                        logger.info("Stopping all services (Threaded)")
                        from app.services.auto_mode_controller import auto_mode_controller
                        auto_mode_controller.stop()  # 패트롤/트래킹 모두 중지
                        explore_service.stop_explore()  # 레거시 explore도 중지
                        print(f"[MODE] -> ALL STOPPED (Processed in background)")

                    # 데몬 스레드로 실행하여 즉시 리턴
                    threading.Thread(target=_stop_task, daemon=True).start()
            
            # 2. Manual Control Protocol (Backend sends to .../control)
            elif msg.topic == settings.TOPIC_CONTROL:
                # Backend sends: {"v": -0.5, "w": 0.0} (inverted values)
                v = float(data.get("v", 0.0))
                w = float(data.get("w", 0.0))
                
                # Forward to Pi immediately (bypass tracking service logic)
                cmd_payload = {
                    "v": v, 
                    "w": w,
                    "source": "manual_control"
                }
                self.publish(settings.TOPIC_CMD_VEL, json.dumps(cmd_payload))

            # 3. 레거시 명령 프로토콜 (통합 토픽)
            elif msg.topic == settings.TOPIC_COMMAND:
                cmd_type = data.get("type", "")
                if cmd_type == "mode":
                    mode = data.get("mode", "").upper()
                    from app.services.tracking_service import tracking_service
                    from app.services.explore_service import explore_service
                    from app.services.auto_mode_controller import auto_mode_controller
                    
                    if mode == "AUTO":
                        self._stop_burst_flag = True
                        logger.info("Starting AUTO mode")
                        auto_mode_controller.start()
                    elif mode == "EXPLORE":
                        self._stop_burst_flag = True
                        explore_service.start_explore()
                    elif mode == "TRACK":
                        self._stop_burst_flag = True
                        tracking_service.start_tracking()
                    elif mode == "MANUAL" or mode == "STOP":
                        # [Fast Stop] Burst Stop & Service Stop
                        self.burst_stop()
                        
                        logger.info("Stopping all services")
                        auto_mode_controller.stop()
                        explore_service.stop_explore()

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
                    
                    import threading
                    def run_async_task():
                        asyncio.run(map_service.generate_map_task(request_id))
                    
                    threading.Thread(target=run_async_task, daemon=True).start()
                    
        except Exception as e:
            logger.error(f"Message processing error: {e}")

    def burst_stop(self, count: int = 5, interval: float = 0.05) -> None:
        """정지 명령을 여러 번 연속 전송 (빠른 정지 보장)"""
        import json
        stop_payload = json.dumps({"v": 0.0, "w": 0.0, "source": "burst_stop"})
        
        for i in range(count):
            if self._stop_burst_flag:
                break
            self.publish(settings.TOPIC_CMD_VEL, stop_payload)
            time.sleep(interval)
        
        logger.info(f"Burst stop completed ({count} commands)")

    def publish(self, topic: str, message: str):
        if self.client and self.client.is_connected():
            return self.client.publish(topic, message)
        else:
            logger.warning("MQTT not connected. Cannot publish.")
            return None

mqtt_service = MQTTService()
