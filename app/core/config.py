from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    ROBOT_ID: str = "robot_default"
    
    # WebRTC 시그널링 서버 URL
    SIGNALING_WS_URL: str = "ws://localhost:8080/ws/webrtc"
    
    @property
    def TOPIC_COMMAND(self) -> str:
        return f"robot/{self.ROBOT_ID}/command"

    @property
    def TOPIC_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/status"

    @property
    def TOPIC_DETECTION(self) -> str:
        return f"robot/{self.ROBOT_ID}/detection"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
