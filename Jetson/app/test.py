# 1. 라이다 토픽 구독 설정 (별도 파일)
from .services.autonomous_mapping_service import autonomous_mapping_service
import json
from .services.mqtt_service import mqtt_service

def on_lidar_message(client, userdata, msg):
    scan_data = json.loads(msg.payload)
    autonomous_mapping_service.process_lidar_scan(scan_data)

# MQTT 구독
mqtt_service.subscribe("/lidar/scan", on_lidar_message)

# 2. 맵핑 시작/중지
autonomous_mapping_service.start_mapping()
# ... 맵핑 진행 ...
autonomous_mapping_service.stop_mapping()
