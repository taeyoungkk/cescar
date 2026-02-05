from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pi MQTT Configuration Settings"""
    
    # MQTT Broker Settings
    MQTT_BROKER: str = "I14B201.p.ssafy.io"
    MQTT_PORT: int = 8085
    
    # Robot Identification
    ROBOT_ID: str = "robot-01"
    
    # Watchdog timeout (ms)
    WATCHDOG_MS: int = 300
    
    # Encoder GPIO pins (BCM numbering)
    ENCODER_PIN_A: int = 17
    ENCODER_PIN_B: int = 27
    
    # 차량 물리 파라미터
    WHEEL_DIAMETER_M: float = 0.06  # 60mm
    ENCODER_PPR: int = 231  # 25GA-370: 11 PPR × 21 gear ratio
    WHEELBASE_M: float = 0.16  # 축간 거리 (조정 필요)
    
    # === MQTT Topics (모두 robot/ 접두사로 통일) ===
    
    # 모드 제어 (MANUAL/AUTO)
    @property
    def TOPIC_MODE(self) -> str:
        return f"robot/{self.ROBOT_ID}/mode"
    
    # UI에서 오는 제어 명령 (MANUAL 모드용)
    @property
    def TOPIC_UI_CMD(self) -> str:
        return f"robot/{self.ROBOT_ID}/control"
    
    # Jetson에서 오는 명령 (AUTO 모드용)
    @property
    def TOPIC_JETSON_CMD(self) -> str:
        return f"robot/{self.ROBOT_ID}/cmd_vel"
    
    # 비상정지
    @property
    def TOPIC_ESTOP(self) -> str:
        return f"robot/{self.ROBOT_ID}/estop"
    
    # 모터 상태 발행
    @property
    def TOPIC_MOTOR_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/motor/status"
    
    # Pi 상태 발행
    @property
    def TOPIC_STATUS(self) -> str:
        return f"robot/{self.ROBOT_ID}/status"
    
    # Odometry 발행
    @property
    def TOPIC_ODOM(self) -> str:
        return f"robot/{self.ROBOT_ID}/sensors/odom"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

