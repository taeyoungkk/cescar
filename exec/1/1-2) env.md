# 빌드 시 사용되는 환경 변수 상세 (스크린샷 항목과 동일 형식)

## Backend
* GCS_PROJECT_ID: Google Cloud 프로젝트 ID
* GCS_BUCKET: GCS 버킷명
* GCS_CREDENTIALS_PATH: 서비스 계정 JSON 경로
* (기본 설정 파일) application.properties

## Frontend
* NEXT_PUBLIC_API_BASE_URL: 백엔드 API 기본 URL
* NEXT_PUBLIC_SIGNALING_URL: WebRTC 시그널링 WS URL
* NEXT_PUBLIC_DETECTION_WS_URL: 탐지 WebSocket URL
* NEXT_PUBLIC_ROBOT_ROOM_ID: WebRTC 룸 ID 기본값
* NEXT_PUBLIC_FIREBASE_API_KEY
* NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
* NEXT_PUBLIC_FIREBASE_PROJECT_ID
* NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
* NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
* NEXT_PUBLIC_FIREBASE_APP_ID
* NEXT_PUBLIC_FIREBASE_VAPID_KEY
* NEXT_PUBLIC_FCM_DEBUG (선택)
* NEXT_PUBLIC_MISSION_MIN_X
* NEXT_PUBLIC_MISSION_MIN_Y
* NEXT_PUBLIC_MISSION_MAX_X
* NEXT_PUBLIC_MISSION_MAX_Y



## WebRTC 시그널링 서버 (EC2 Spring) - Nginx 사용 시 포트 제거

GCS_BUCKET_NAME=ssafy-aiot
GOOGLE_CLOUD_PROJECT=gen-lang-client-0860397875
GOOGLE_APPLICATION_CREDENTIALS=env/gen-lang-client-0860397875-ee8b15a8ba29.json


## Jetson 환경 설정 파일
# 이 파일을 .env로 복사하고 값을 채워주세요

# MQTT 브로커 설정 (로컬 백엔드)
MQTT_BROKER=3.35.235.49
# MQTT_BROKER=localhost
# MQTT_BROKER=I14B201.p.ssafy.io
MQTT_PORT=8085
ROBOT_ID=my-car-001


# YOLO 모델 설정
YOLO_MODEL_PATH=app/models/one_class_nano.pt
YOLO_CONFIDENCE_THRESHOLD=0.5

# WebRTC 시그널링 서버 URL (로컬 백엔드)
SIGNALING_WS_URL=wss://I14B201.p.ssafy.io/ws/webrtc
# SIGNALING_WS_URL=ws://I14B201.p.ssafy.io:8080/ws/webrtc

# Detection WebSocket URL (bbox 실시간 스트리밍 - 로컬 백엔드)
DETECTION_WS_URL=wss://I14B201.p.ssafy.io/ws/detections
# SIGNALING_WS_URL=ws://I14B201.p.ssafy.io:8080/ws/detections


## MQTT
MQTT_BROKER=3.35.235.49
MQTT_PORT=8085
ROBOT_ID=my-car-001


## docker-compose.yaml
```python
services:
  db:
    image: postgres:17
    container_name: postgres-ssafy
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=ssafy
      - POSTGRES_PASSWORD=ssafy
      - POSTGRES_DB=ssafy
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
  emqx:
    image: emqx/emqx:5.4.1 # 최신 안정화 버전
    container_name: emqx_broker
    ports:
      - "8085:1883"       # MQTT 프로토콜 포트
      - "8083:8083"       # WebSocket 포트
      - "8084:8084"       # WSS (Secure WebSocket) 포트
      - "8883:8883"       # MQTT over SSL 포트
      - "18083:18083"     # EMQX Dashboard (관리자 UI 포트)
    environment:
      - "EMQX_NODE_NAME=emqx@node1"
      - "EMQX_CLUSTER__DISCOVERY_STRATEGY=static"
    volumes:
      - emqx_data:/opt/emqx/data
      - emqx_log:/opt/emqx/log
volumes:
  postgres_data:
  emqx_data:
  emqx_log:
```