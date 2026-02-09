# 사용하는 외부 서비스 정보

1) Google Cloud
* 용도: 스냅샷, 영상, 지도 파일 저장(GCS)
* 프로젝트 ID: aiot-5c227
* 버킷명: ssafy-aiot
* 필요 정보/설정:
* 서비스 계정 키(JSON)
* GCS_PROJECT_ID, GCS_BUCKET, GCS_CREDENTIALS_PATH (백엔드)
* GOOGLE_CLOUD_PROJECT, GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS (Jetson)

2) Firebase
* 용도: FCM 알림
* 프로젝트 ID: aiot-5c227
* 필요 정보/설정:
* Web 앱 설정값 (API Key, Auth Domain, Project ID 등)
* NEXT_PUBLIC_FIREBASE_*, NEXT_PUBLIC_FIREBASE_VAPID_KEY (프론트)