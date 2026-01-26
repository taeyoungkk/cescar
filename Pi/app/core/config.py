from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pi MQTT Configuration Settings"""
    
    # MQTT Broker Settings
    MQTT_BROKER: str = "I14B201.p.ssafy.io"
    MQTT_PORT: int = 1883
    
    # Robot Identification
    ROBOT_ID: str = "robot-01"
    
    # Watchdog timeout (ms)
    WATCHDOG_MS: int = 300
    
    # === MQTT Topics ===
    
    # 모드 제어 (MANUAL/AUTO)
    @property
    def TOPIC_MODE(self) -> str:
        return "ui/mode"
    
    # UI에서 오는 명령 (MANUAL 모드용)
    @property
    def TOPIC_UI_CMD(self) -> str:
        return "ui/cmd_vel"
    
    # Jetson에서 오는 명령 (AUTO 모드용)
    @property
    def TOPIC_JETSON_CMD(self) -> str:
        return "jetson/cmd_vel"
    
    # 비상정지
    @property
    def TOPIC_ESTOP(self) -> str:
        return "system/estop"
    
    # 모터 상태 발행
    @property
    def TOPIC_MOTOR_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/motor/status"
    
    # 일반 상태 발행
    @property
    def TOPIC_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/status"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

