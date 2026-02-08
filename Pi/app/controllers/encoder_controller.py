"""
Encoder Controller for Raspberry Pi 5
lgpio 라이브러리를 사용하여 엔코더 펄스를 카운트하고 속도를 계산.
(RPi.GPIO는 Pi 5에서 지원되지 않음)
"""
import logging
import time
import threading
from typing import Optional

try:
    import lgpio
    LGPIO_AVAILABLE = True
except ImportError:
    lgpio = None
    LGPIO_AVAILABLE = False

logger = logging.getLogger(__name__)

# Raspberry Pi 5는 gpiochip4, Pi 4 이하는 gpiochip0
GPIO_CHIP = 4


class EncoderController:
    """
    홀 센서 엔코더 컨트롤러.
    lgpio 폴링 방식으로 펄스 카운트, 속도 계산.
    """
    
    def __init__(
        self,
        pin_a: int = 17,
        pin_b: int = 27,
        ppr: int = 231,  # 25GA-370 기본값 (11 PPR × 21 기어비)
        wheel_diameter_m: float = 0.06,  # 60mm
    ) -> None:
        self._pin_a = pin_a
        self._pin_b = pin_b
        self._ppr = ppr
        self._wheel_circumference = wheel_diameter_m * 3.14159
        
        self._count: int = 0
        self._last_count: int = 0
        self._last_time: float = time.time()
        self._speed: float = 0.0  # m/s
        self._direction: int = 1  # 1: forward, -1: backward
        
        self._lock = threading.Lock()
        self._initialized = False
        self._handle: Optional[int] = None
        self._last_a_state: int = 0
        
        # 폴링 스레드
        self._running = False
        self._poll_thread: Optional[threading.Thread] = None
        
        self._init_gpio()
    
    def _init_gpio(self) -> None:
        if not LGPIO_AVAILABLE:
            logger.warning("lgpio not available - running in simulation mode")
            print("[ENCODER] ⚠️  lgpio not available - simulation mode")
            return
        
        try:
            self._handle = lgpio.gpiochip_open(GPIO_CHIP)
            
            # 입력 핀 설정 (풀업)
            lgpio.gpio_claim_input(self._handle, self._pin_a, lgpio.SET_PULL_UP)
            lgpio.gpio_claim_input(self._handle, self._pin_b, lgpio.SET_PULL_UP)
            
            # 초기 상태 읽기
            self._last_a_state = lgpio.gpio_read(self._handle, self._pin_a)
            
            self._initialized = True
            logger.info(f"Encoder initialized: A=GPIO{self._pin_a}, B=GPIO{self._pin_b}")
            print(f"[ENCODER] ✓ Initialized: A=GPIO{self._pin_a}, B=GPIO{self._pin_b}")
            
            # 폴링 스레드 시작
            self._start_polling()
            
        except Exception as e:
            logger.error(f"Encoder init failed: {e}")
            print(f"[ENCODER] ✗ Init failed: {e}")
    
    def _start_polling(self) -> None:
        """엔코더 폴링 스레드 시작."""
        self._running = True
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()
        logger.info("Encoder polling thread started")
    
    def _poll_loop(self) -> None:
        """엔코더 폴링 루프 - 빠른 속도로 GPIO 상태 확인."""
        while self._running and self._handle is not None:
            try:
                a_state = lgpio.gpio_read(self._handle, self._pin_a)
                
                # A 채널 엣지 감지
                if a_state != self._last_a_state:
                    b_state = lgpio.gpio_read(self._handle, self._pin_b)
                    
                    with self._lock:
                        if a_state == 1:  # 상승 엣지
                            if b_state == 0:
                                self._count += 1
                            else:
                                self._count -= 1
                        else:  # 하강 엣지
                            if b_state == 1:
                                self._count += 1
                            else:
                                self._count -= 1
                    
                    self._last_a_state = a_state
                
                time.sleep(0.0001)  # 0.1ms 폴링 주기
                
            except Exception as e:
                logger.error(f"Polling error: {e}")
                time.sleep(0.01)
    
    def update(self) -> None:
        """속도 계산 - 주기적으로 호출 (20Hz 권장)."""
        now = time.time()
        
        with self._lock:
            dt = now - self._last_time
            if dt <= 0:
                return
            
            delta_count = self._count - self._last_count
            
            # 회전수 계산
            revolutions = delta_count / self._ppr
            
            # 속도 계산 (m/s)
            distance = revolutions * self._wheel_circumference
            self._speed = distance / dt
            
            self._last_count = self._count
            self._last_time = now
    
    @property
    def count(self) -> int:
        with self._lock:
            return self._count
    
    @property
    def speed(self) -> float:
        """현재 속도 (m/s)."""
        return self._speed
    
    @property
    def distance(self) -> float:
        """총 이동 거리 (m)."""
        with self._lock:
            revolutions = self._count / self._ppr
            return revolutions * self._wheel_circumference
    
    def reset(self) -> None:
        """카운터 리셋."""
        with self._lock:
            self._count = 0
            self._last_count = 0
            self._speed = 0.0
            self._last_time = time.time()
        logger.info("Encoder counter reset")
    
    def cleanup(self) -> None:
        """GPIO 정리."""
        self._running = False
        
        if self._poll_thread is not None:
            self._poll_thread.join(timeout=1.0)
        
        if self._handle is not None and self._initialized:
            try:
                lgpio.gpiochip_close(self._handle)
                self._handle = None
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
        
        logger.info("Encoder cleanup complete")
        print("[ENCODER] ✓ Cleanup complete")
