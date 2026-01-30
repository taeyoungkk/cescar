
import psutil
import platform
import logging

logger = logging.getLogger(__name__)

class MonitoringService:
    def __init__(self):
        self.is_jetson = platform.machine() == "aarch64"

    def get_system_stats(self):
        """
        CPU, RAM, Disk 사용량 및 온도를 반환합니다.
        Jetson Nano의 경우 GPU 사용량(Mock/Stub)을 포함합니다.
        """
        stats = {
            "cpu_usage": psutil.cpu_percent(interval=None),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total,
                "used": psutil.disk_usage('/').used,
                "percent": psutil.disk_usage('/').percent
            },
            "temperature": self._get_temperature(),
            "gpu": self._get_gpu_stats(),
            "battery": self._get_battery_stats()
        }
        return stats

    def _get_battery_stats(self):
        """
        배터리 잔량 및 충전 상태를 가져옵니다.
        """
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    "percent": battery.percent,
                    "power_plugged": battery.power_plugged,
                    "secsleft": battery.secsleft
                }
            
            # Jetson Nano에서 특정 I2C 배터리 보드를 사용 중이라면 
            # 여기서 해당 센서 값을 읽는 로직을 구현해야 합니다.
            # 예: INA219 센서 등 사용 시
            return {
                "percent": 100, # 기본값 (전원 연결됨)
                "power_plugged": True,
                "note": "Standard DC Power"
            }
        except Exception:
            return None

    def _get_temperature(self):
        """
        시스템 온도를 가져옵니다.
        """
        try:
            if self.is_jetson:
                # Jetson Nano Thermal Zone (Thermal Zone 0 is usually CPU)
                with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                    temp = int(f.read().strip()) / 1000.0
                return temp
            else:
                # Windows/MacOS에서 psutil을 통한 온도 읽기 시도 (지원 안될 수 있음)
                temps = psutil.sensors_temperatures()
                if temps:
                    # 첫 번째 센서값 반환
                    for name, entries in temps.items():
                        return entries[0].current
                return 45.0 # Mock value for development
        except Exception:
            return 0.0

    def _get_gpu_stats(self):
        """
        GPU 사용량을 가져옵니다. 
        Jetson의 경우 jtop 또는 tegrastats가 필요하지만 여기선 시뮬레이션 합니다.
        """
        if self.is_jetson:
            # Jetson Nano 전용 라이브러리(jetson-stats 등)를 사용하거나 
            # tegrastats 파일을 파싱해야 합니다.
            return {"usage": 15, "temp": 42.0} # Mock Jetson GPU stats
        return {"usage": 0, "temp": 0} # Non-Jetson (PC)

monitoring_service = MonitoringService()
