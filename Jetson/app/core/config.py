from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # MQTT
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 8085
    ROBOT_ID: str = "robot-01"  # Default fallback
    
    # GCS
    GCS_BUCKET_NAME: str = ""
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    ENABLE_CLOUD_UPLOAD: bool = False
    
    # YOLO
    YOLO_MODEL_PATH: str = "models/one_class_nano.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.5
    
    # WebRTC / WS
    SIGNALING_WS_URL: str = "ws://localhost:8080/ws/webrtc"
    DETECTION_WS_URL: str = "ws://localhost:8080/ws/detections"

    # Odom/SLAM Settings
    WHEELBASE_M: float = 0.16
    FRAME_ID_ODOM: str = "odom"
    FRAME_ID_BASE: str = "base_link"

    # Computed Properties
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
    
    @property
    def TOPIC_SENSORS_ODOM(self) -> str:
        return f"robot/{self.ROBOT_ID}/sensors/odom"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
