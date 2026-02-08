"""
Detection WebSocket Service

실시간으로 bbox 좌표를 Spring Backend의 /ws/detections 엔드포인트로 스트리밍하는 서비스
프론트엔드에서 canvas로 영상 위에 bbox를 그릴 수 있도록 함
"""

import json
import threading
import logging
from datetime import datetime
from typing import Optional

import websocket

from app.core.config import settings

logger = logging.getLogger(__name__)


class DetectionWebSocketService:
    """Detection bbox 실시간 스트리밍 서비스"""
    
    def __init__(self):
        self._ws: Optional[websocket.WebSocket] = None
        self._connected: bool = False
        self._room_id: Optional[str] = None
        self._lock = threading.Lock()
        self._reconnect_enabled: bool = True
        self._should_run: bool = False
    
    def connect(self, room_id: str) -> bool:
        """
        WebSocket 연결 및 room 참가
        
        Args:
            room_id: 참가할 room ID (보통 robot_id와 동일)
        
        Returns:
            연결 성공 여부
        """
        with self._lock:
            if self._connected:
                logger.info("Detection WebSocket already connected")
                return True
            
            try:
                self._room_id = room_id
                self._should_run = True
                
                # WebSocket 연결
                ws_url = settings.DETECTION_WS_URL
                logger.info(f"Connecting to Detection WebSocket: {ws_url}")
                
                self._ws = websocket.create_connection(
                    ws_url,
                    timeout=10,
                    origin="https://I14B201.p.ssafy.io"
                )
                
                # room 참가 메시지 전송
                join_msg = {
                    "type": "join",
                    "roomId": room_id
                }
                self._ws.send(json.dumps(join_msg))
                logger.info(f"✅ Joined detection room: {room_id}")
                
                self._connected = True
                return True
                
            except Exception as e:
                logger.error(f"❌ Detection WebSocket 연결 실패: {e}")
                self._connected = False
                return False
    
    def disconnect(self) -> None:
        """WebSocket 연결 종료"""
        with self._lock:
            self._should_run = False
            self._connected = False
            
            if self._ws is not None:
                try:
                    self._ws.close()
                except Exception:
                    pass
                self._ws = None
            
            logger.info("Detection WebSocket disconnected")
    
    def is_connected(self) -> bool:
        """연결 상태 확인"""
        return self._connected and self._ws is not None
    
    def send_detections(
        self, 
        detections: list[dict], 
        frame_width: int,
        frame_height: int
    ) -> bool:
        """
        탐지 결과(bbox 좌표)를 WebSocket으로 전송
        
        Args:
            detections: YOLO 탐지 결과 리스트
            frame_width: 프레임 너비 (프론트에서 스케일링에 필요)
            frame_height: 프레임 높이
        
        Returns:
            전송 성공 여부
        """
        if not self.is_connected():
            # 재연결 시도
            if self._reconnect_enabled and self._room_id:
                self.connect(self._room_id)
            
            if not self.is_connected():
                return False
        
        try:
            # Frontend가 이해하는 형식으로 변환
            # Jetson: {label, confidence, bbox: {x1, y1, x2, y2}}
            # Frontend expects: {label, confidence, x1, y1, x2, y2} (flat)
            formatted_detections = []
            for det in detections:
                bbox = det.get("bbox", {})
                formatted_detections.append({
                    "label": det.get("label"),
                    "confidence": det.get("confidence"),
                    "x1": bbox.get("x1"),
                    "y1": bbox.get("y1"),
                    "x2": bbox.get("x2"),
                    "y2": bbox.get("y2"),
                })
            
            message = {
                "type": "detections",
                "roomId": self._room_id,
                "data": {
                    "timestamp": datetime.now().isoformat(),
                    "frameWidth": frame_width,
                    "frameHeight": frame_height,
                    "count": len(formatted_detections),
                    "detections": formatted_detections
                }
            }
            
            self._ws.send(json.dumps(message))
            # if formatted_detections:
            #     logger.info(f"📦 Sent {len(formatted_detections)} bbox(es) via WebSocket")
            return True
            
        except websocket.WebSocketConnectionClosedException:
            logger.warning("Detection WebSocket connection closed")
            try:
                self._ws.close()
            except Exception:
                pass
            self._connected = False
            return False
        except Exception as e:
            logger.error(f"Detection 전송 에러: {e}")
                        # 에러 발생 시 확실하게 연결 종료 처리하여 리소스 반환
            try:
                self._ws.close()
            except Exception:
                pass
            self._connected = False
            return False


# 싱글톤 인스턴스
detection_ws_service = DetectionWebSocketService()
