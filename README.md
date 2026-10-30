# 🐞 Cescar

> **벌레 탐지 로봇의 시야와 움직임을 웹에서 확인하고 제어합니다.**

Cescar는 **Jetson과 Raspberry Pi 기반 벌레 탐지 로봇 모니터링·제어 시스템**입니다. 카메라 영상에서 YOLO로 탐지한 결과를 웹에 표시하고, 원격 조종·자동 순찰·지도 관리·탐지 이력 및 알림 기능을 제공합니다.

| 항목 | 내용 |
| --- | --- |
| 개발 기간 | 2026.01.05 ~ 2026.02.09 |
| 개발 인원 | 5명 |
| 플랫폼 | Web / PWA + Jetson + Raspberry Pi |
| 기관 | 삼성 청년 SW·AI 아카데미 14기 |

## 📋 목차

- [🧩 주요 기능](#-주요-기능)
- [🧰 기술 스택](#-기술-스택)
- [🧱 시스템 아키텍처](#-시스템-아키텍처)
- [🔧 핵심 구현](#-핵심-구현)
- [🤝 팀 구성 및 역할](#-팀-구성-및-역할)
- [🚀 시작하기](#-시작하기)
- [📚 관련 문서](#-관련-문서)

## 🧩 주요 기능

| 기능 | 설명 |
| --- | --- |
| 실시간 영상 및 탐지 표시 | WebRTC로 로봇 카메라 영상을 보고, WebSocket으로 전달받은 탐지 박스를 화면에 표시합니다. |
| 원격 조종 및 모드 변경 | 웹 조작으로 이동 명령을 전달하고 수동·자동 모드를 변경합니다. |
| 자동 순찰 및 추적 | Jetson의 자동 모드에서 순찰하다가 탐지 대상이 나타나면 추적으로 전환하고, 대상 소실 시 순찰로 복귀합니다. |
| 지도 생성 및 관리 | ROS2 지도 저장 작업을 요청하고 생성된 지도와 메타데이터를 저장·조회합니다. |
| 탐지 이력 및 알림 | 탐지 시 스냅샷과 영상을 기록하고, 탐지 이력 조회와 Firebase 푸시 알림을 제공합니다. |
| 차량 등록 및 상태 조회 | 사용자별 차량을 등록하고 소유권, 연결 상태, 장치에서 보고한 시스템 상태를 관리합니다. |

## 🧰 기술 스택

| 분야 | 주요 기술 |
| --- | --- |
| Frontend | TypeScript, Next.js, React, Tailwind CSS, Zustand |
| Backend | Java 21, Spring Boot, Spring Security, Spring Data JPA, Flyway |
| Jetson / AI | Python, FastAPI, Ultralytics YOLO, PyTorch, OpenCV |
| 로봇 제어 | Raspberry Pi, ROS2, LiDAR·엔코더, PCA9685 기반 모터·서보 제어 |
| 실시간 통신 | MQTT / EMQX, WebSocket, WebRTC, GStreamer |
| 데이터 / 외부 서비스 | PostgreSQL, Google Cloud Storage, Firebase Cloud Messaging |
| 배포 | Docker Compose, AWS EC2, Nginx, Vercel |

세부 의존성은 [Frontend package.json](./Frontend/package.json), [Backend pom.xml](./Backend/pom.xml), [Jetson requirements.txt](./Jetson/requirements.txt), [Pi requirements.txt](./Pi/requirements.txt)를 참고합니다.

## 🧱 시스템 아키텍처

웹과 백엔드는 사용자·차량·기록을 관리하고, Jetson은 영상 처리와 주행 판단을, Raspberry Pi는 모터·조향 제어와 엔코더 데이터 수집을 담당합니다.

```text
[사용자]
Next.js 웹 / PWA
  ├─ REST API → Spring Boot → PostgreSQL
  ├─ WebSocket ↔ Spring Boot (시그널링·탐지 박스·차량 상태)
  └─ WebRTC 영상 수신 ← Jetson (GStreamer)

[로봇 제어 및 상태]
Spring Boot ↔ EMQX (MQTT)
                ├─ Jetson: YOLO 탐지, 순찰·추적, ROS2 지도 처리
                └─ Raspberry Pi: 모터·서보 제어, 엔코더 데이터 발행
                     └─ MQTT → Jetson의 ROS2 odom 브리지

[탐지 기록 및 알림]
Jetson → 스냅샷·영상·지도 파일 → Google Cloud Storage
       → MQTT 이벤트 → Spring Boot → 이력 저장 / Firebase 알림
```

```text
S14P11B201/
├── Frontend/  # 웹 화면, 영상·지도·탐지 이력, 원격 제어 UI
├── Backend/   # 인증·차량·이력 API, MQTT 및 WebSocket 연동
├── Jetson/    # 카메라·YOLO·WebRTC, 순찰·추적·지도 처리
├── Pi/        # 모터·서보·엔코더 제어, MQTT 통신
└── exec/      # 환경 설정, 배포, DB 및 외부 서비스 문서
```

## 🔧 핵심 구현

### 📡 영상과 탐지 데이터의 전송 경로 분리

카메라 프레임을 WebRTC 송출과 YOLO 추론에서 공유합니다. 영상은 WebRTC로 보내고 탐지 좌표는 별도 WebSocket으로 전달해, 프론트엔드에서 영상 위에 박스를 그립니다. 백엔드는 차량별 시그널링과 탐지 메시지를 중계합니다.

### 🚗 모드별 주행 명령과 정지 처리

Raspberry Pi는 MANUAL 모드에서는 사용자 명령을, AUTO 모드에서는 Jetson 명령을 받아 모터와 조향을 제어합니다. 비상 정지 명령과 일정 시간 명령을 받지 못했을 때 정지하는 watchdog을 구현했습니다.

Jetson은 자동 모드의 상태를 순찰과 추적으로 나누고, 탐지 여부에 따라 상태를 전환합니다. LiDAR와 엔코더 데이터는 순찰 판단 및 ROS2 연동에 사용합니다.

### 🗺️ 비동기 지도 생성과 결과 연결

백엔드에서 요청 ID와 함께 지도 생성 명령을 MQTT로 발행합니다. Jetson은 ROS2 지도 저장 도구를 실행하고 지도 이미지·메타데이터를 업로드한 뒤 결과를 발행합니다. 백엔드는 요청과 결과를 연결해 지도 정보를 저장합니다.

### 🔔 탐지 기록과 장치 상태 관리

탐지 이벤트에 쿨다운을 두어 연속 녹화를 제한하고, 스냅샷·영상 저장 결과를 MQTT로 전달합니다. 백엔드는 탐지 이력과 파일 경로를 관리하고 FCM 알림으로 연결합니다.

장치 상태 메시지 수신 시각을 온라인 판정에 활용하며, MQTT 구독 복구와 WebSocket 재연결 처리를 통해 연결이 끊긴 뒤 다시 수신할 수 있도록 구성했습니다.

## 🤝 팀 구성 및 역할

팀원별 주요 기여를 요약했습니다.

| 이름 | 담당 | 주요 기여 |
| --- | --- | --- |
| 김승수 | Frontend | 대시보드·지도 UI, 영상·조종 API 연동, PWA·FCM 알림 |
| 김건남 | Robotics / Streaming | WebRTC·탐지 박스 전송, 순찰·추적 및 ROS2 연동, Pi 주행·엔코더 제어 |
| 김태영 | Backend | 인증·차량·이력 API, MQTT 상태·지도 결과 처리, GCS 파일 조회 연동 |
| 최두용 | Jetson / Backend | MQTT 통신·장치 상태 연동, 탐지 스냅샷·영상 기록, GCS 업로드 |
| 정성윤 | AI | 로봇 카메라 영상에서 벌레를 식별하기 위한 객체 탐지 AI 모델 학습 |

## 🚀 시작하기

### 개발 환경

- Java 21, Node.js 및 npm, Docker 및 Docker Compose
- Jetson·Raspberry Pi에 맞는 Python 환경과 장치 드라이버
- 카메라, LiDAR, 엔코더, 모터·서보 등 해당 기능에 필요한 하드웨어
- GCS·Firebase 서비스 계정 및 프론트엔드 환경 설정

아래 명령은 각각 **저장소 루트에서 시작하는 별도 터미널** 기준입니다. 웹·백엔드와 장치 프로그램은 실행 환경이 다르므로 각 구성요소에 맞게 준비합니다.

### Backend

[환경 설정 문서](./exec/1/1-2%29%20env.md)와 [DB 설정 문서](./exec/1/1-4%29%20db_info.md)를 참고해 `application.properties`의 DB·MQTT 설정을 맞춥니다. Firebase 초기화에는 `Backend/src/main/resources/firebase-service-account.json`이 필요하며, GCS 사용 시 프로젝트·버킷·인증 파일 경로를 설정합니다.

```bash
cd Backend
docker compose up -d
./mvnw spring-boot:run
```

Compose는 PostgreSQL과 EMQX를 실행합니다. 기본 호스트 포트는 PostgreSQL `5432`, MQTT `8085`입니다. Windows PowerShell에서는 `./mvnw` 대신 `.\mvnw.cmd`를 사용합니다.

### Frontend

`Frontend/.env.local.example`을 `.env.local`로 복사한 뒤 API·시그널링·탐지 WebSocket·Firebase 값을 설정합니다. 차량의 식별자가 프론트엔드·백엔드·장치 설정에서 일치해야 합니다.

```bash
cd Frontend
npm install
npm run build -- --webpack
npm run start
```

로컬 접속 주소는 `http://localhost:3000`입니다. 모바일 PWA와 푸시 알림은 HTTPS 및 브라우저의 알림 권한 설정이 필요합니다.

### Jetson

카메라, GStreamer의 WebRTC 플러그인, ROS2 환경을 준비합니다. 지도 저장에는 `nav2_map_server`와 `pnmtopng`가 필요하며, SLAM·LiDAR 노드는 별도로 구성해야 합니다.

`Jetson/.env`에 MQTT 주소·차량 ID·WebSocket 주소·GCS 설정을 지정하고, `YOLO_MODEL_PATH`가 실제 모델 파일을 가리키도록 설정합니다. 모델 가중치는 현재 저장소에 포함되어 있지 않습니다. 탐지 미디어를 GCS에 업로드하려면 `ENABLE_CLOUD_UPLOAD=true`도 설정합니다.

```bash
cd Jetson
pip install -r requirements.txt
python run.py
```

`run.py`는 MQTT odom 브리지와 FastAPI 서버를 함께 시작합니다. PyTorch·GStreamer·ROS2 등 장치별 의존성은 `requirements.txt` 설치와 별도로 준비해야 합니다.

### Raspberry Pi

`Pi/.env`에서 MQTT 주소·차량 ID와 실제 배선에 맞는 엔코더·차량 설정을 지정합니다. I2C·GPIO 및 모터·서보 드라이버를 준비한 장치에서 실행합니다.

```bash
cd Pi
pip install -r requirements.txt
python main.py
```

### 현재 실행 범위

영상 송출·자동 순찰·지도 생성은 연결된 장치와 모델·ROS2 환경을 전제로 합니다. 홈 화면의 별도 탐지 시작·중지 버튼은 현재 코드에서 API 연동 안내 상태이므로, 로봇의 모드 변경 기능과 구분됩니다.

## 📚 관련 문서

| 문서 | 내용 |
| --- | --- |
| [Frontend 실행 안내](./Frontend/README.md) | 프론트엔드 빌드·접속 및 PWA 안내 |
| [실행 환경](./exec/1/1-1%29%20settings.md) | JVM, 서버, 브로커, DB 구성 |
| [환경 설정](./exec/1/1-2%29%20env.md) | Backend·Frontend·Jetson 환경 설정 |
| [배포 안내](./exec/1/1-3%29%20deployment.md) | 웹·모바일 접속 및 배포 환경 |
| [DB 설정](./exec/1/1-4%29%20db_info.md) | DB 연결, 포트, 마이그레이션 위치 |
| [외부 서비스](./exec/2/2%29%20external_service.md) | GCS·Firebase 용도 및 연동 설정 |
