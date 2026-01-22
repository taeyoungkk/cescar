from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MQTT_BROKER: str = "localhost"
    MQTT_PORT: int = 1883
    ROBOT_ID: str = "robot_default"
    
    @property
    def TOPIC_COMMAND(self) -> str:
        return f"robot/{self.ROBOT_ID}/command"

    @property
    def TOPIC_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/status"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
