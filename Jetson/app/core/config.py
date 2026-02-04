from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 8085
    ROBOT_ID: str = "robot_default"
    
    # GCS Settings
    GCS_BUCKET_NAME: str = ""
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    ENABLE_CLOUD_UPLOAD: bool = False
    
    # YOLO Model Settings
    YOLO_MODEL_PATH: str = "models/one_class_nano.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.5
    
    # WebRTC 시그널링 서버 URL
    SIGNALING_WS_URL: str = "ws://localhost:8080/ws/webrtc"
    
    # Detection WebSocket URL (bbox 스트리밍용)
    DETECTION_WS_URL: str = "ws://localhost:8080/ws/detections"
    
    @property
    def TOPIC_COMMAND(self) -> str:
        return f"robot/{self.ROBOT_ID}/command"

    @property
    def TOPIC_MODE(self) -> str:
        return f"robot/{self.ROBOT_ID}/mode"

    @property
    def TOPIC_CONTROL(self) -> str:
        return f"robot/{self.ROBOT_ID}/control"

    @property
    def TOPIC_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/status"

    @property
    def TOPIC_DETECTION(self) -> str:
        return f"robot/{self.ROBOT_ID}/detection"

    @property
    def TOPIC_CMD_VEL(self) -> str:
        return f"robot/{self.ROBOT_ID}/cmd_vel"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
