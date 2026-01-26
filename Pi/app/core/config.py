from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pi MQTT Configuration Settings"""
    
    # MQTT Broker Settings
    MQTT_BROKER: str = "I14B201.p.ssafy.io"
    MQTT_PORT: int = 1883
    
    # Robot Identification
    ROBOT_ID: str = "robot-01"
    
    # MQTT Topics
    @property
    def TOPIC_MOTOR_COMMAND(self) -> str:
        """모터 제어 명령 수신 토픽"""
        return f"robot/{self.ROBOT_ID}/motor"
    
    @property
    def TOPIC_MOTOR_STATUS(self) -> str:
        """모터 상태 발행 토픽"""
        return f"robot/{self.ROBOT_ID}/motor/status"
    
    @property
    def TOPIC_COMMAND(self) -> str:
        """일반 명령 수신 토픽 (Jetson과 동일)"""
        return f"robot/{self.ROBOT_ID}/command"
    
    @property
    def TOPIC_STATUS(self) -> str:
        """상태 발행 토픽"""
        return f"robot/{self.ROBOT_ID}/status"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
