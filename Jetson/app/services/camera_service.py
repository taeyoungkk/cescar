"""
Camera Service - Centralized Camera Capture

카메라를 한 곳에서만 열어 프레임을 공유하는 서비스
- WebRTC: appsrc로 프레임 전달
- Detection: get_frame()으로 최신 프레임 획득
"""

import threading
import time
import logging
from typing import Optional, Callable, List
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class CameraService:
    """중앙 카메라 캡처 서비스"""
    
    def __init__(
        self,
        device: int = 0,
        width: int = 640,
        height: int = 480,
        fps: int = 30
    ):
        self._device = device
        self._width = width
        self._height = height
        self._fps = fps
        self._target_interval = 1.0 / fps
        
        self._cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        
        # Frame buffer (thread-safe)
        self._frame: Optional[np.ndarray] = None
        self._frame_lock = threading.Lock()
        self._frame_timestamp: float = 0
        
        # Callbacks for real-time frame push
        self._callbacks: List[Callable[[np.ndarray], None]] = []
        self._callbacks_lock = threading.Lock()
    
    @property
    def width(self) -> int:
        return self._width
    
    @property
    def height(self) -> int:
        return self._height
    
    @property
    def fps(self) -> int:
        return self._fps
    
    @property
    def is_running(self) -> bool:
        return self._running
    
    def start(self) -> bool:
        """카메라 캡처 시작"""
        if self._running:
            logger.warning("CameraService already running")
            return True
        
        self._cap = cv2.VideoCapture(self._device)
        if not self._cap.isOpened():
            logger.error(f"❌ Failed to open camera device {self._device}")
            return False
        
        # 카메라 설정
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
        self._cap.set(cv2.CAP_PROP_FPS, self._fps)
        
        # 실제 설정된 값 확인
        actual_width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = int(self._cap.get(cv2.CAP_PROP_FPS))
        
        logger.info(f"📸 Camera opened: {actual_width}x{actual_height} @ {actual_fps}fps")
        
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        
        return True
    
    def stop(self):
        """카메라 캡처 중지"""
        self._running = False
        
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None
        
        if self._cap:
            self._cap.release()
            self._cap = None
        
        with self._frame_lock:
            self._frame = None
        
        logger.info("🛑 CameraService stopped")
    
    def get_frame(self) -> Optional[np.ndarray]:
        """최신 프레임 반환 (thread-safe copy)"""
        with self._frame_lock:
            if self._frame is None:
                return None
            return self._frame.copy()
    
    def get_frame_with_timestamp(self) -> tuple[Optional[np.ndarray], float]:
        """최신 프레임과 타임스탬프 반환"""
        with self._frame_lock:
            if self._frame is None:
                return None, 0
            return self._frame.copy(), self._frame_timestamp
    
    def register_callback(self, callback: Callable[[np.ndarray], None]):
        """프레임 수신 콜백 등록 (WebRTC appsrc용)"""
        with self._callbacks_lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)
                logger.info(f"Registered frame callback: {callback.__name__ if hasattr(callback, '__name__') else 'anonymous'}")
    
    def unregister_callback(self, callback: Callable[[np.ndarray], None]):
        """콜백 해제"""
        with self._callbacks_lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)
    
    def _capture_loop(self):
        """프레임 캡처 루프 (별도 스레드)"""
        logger.info("📹 Camera capture loop started")
        
        while self._running and self._cap is not None:
            loop_start = time.time()
            
            ret, frame = self._cap.read()
            if not ret:
                logger.warning("⚠️ Failed to read frame")
                time.sleep(0.01)
                continue
            
            timestamp = time.time()
            
            # Frame buffer 업데이트
            with self._frame_lock:
                self._frame = frame
                self._frame_timestamp = timestamp
            
            # 콜백 호출 (WebRTC 등)
            with self._callbacks_lock:
                callbacks = self._callbacks.copy()
            
            for cb in callbacks:
                try:
                    cb(frame)
                except Exception as e:
                    logger.error(f"Frame callback error: {e}")
            
            # FPS 유지
            elapsed = time.time() - loop_start
            sleep_time = self._target_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        logger.info("📹 Camera capture loop ended")


# 싱글톤 인스턴스
camera_service = CameraService()
