"""
YOLO Inference Service

YOLO 모델을 로드하고 프레임에서 객체를 탐지하는 서비스
"""

import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class YoloService:
    """YOLO 모델 추론 서비스"""
    
    def __init__(self):
        self.model = None
        self.confidence_threshold = settings.YOLO_CONFIDENCE_THRESHOLD
        self._is_loaded = False
    
    def load_model(self) -> bool:
        """
        YOLO 모델 로드
        Returns: 성공 여부
        """
        try:
            from ultralytics import YOLO
            
            model_path = settings.YOLO_MODEL_PATH
            logger.info(f"Loading YOLO model from: {model_path}")
            
            self.model = YOLO(model_path)
            self._is_loaded = True
            
            logger.info("✅ YOLO model loaded successfully")
            return True
            
        except ImportError:
            logger.error("❌ ultralytics 패키지가 설치되어 있지 않습니다. pip install ultralytics")
            return False
        except Exception as e:
            logger.error(f"❌ YOLO 모델 로드 실패: {e}")
            return False
    
    def is_loaded(self) -> bool:
        """모델 로드 여부 확인"""
        return self._is_loaded and self.model is not None
    
    def detect(self, frame) -> list[dict]:
        """
        프레임에서 객체 탐지 수행
        
        Args:
            frame: OpenCV 이미지 프레임 (numpy array, BGR 형식)
        
        Returns:
            탐지 결과 리스트:
            [
                {
                    "label": "insect",
                    "confidence": 0.95,
                    "bbox": {
                        "x1": 100, "y1": 100,
                        "x2": 200, "y2": 200
                    }
                }
            ]
        """
        if not self.is_loaded():
            logger.warning("YOLO 모델이 로드되지 않았습니다")
            return []
        
        if frame is None:
            return []
        
        try:
            # YOLO 추론 수행
            results = self.model(frame, verbose=False)
            
            detections = []
            for result in results:
                if result.boxes is None:
                    continue
                    
                for box in result.boxes:
                    conf = float(box.conf[0])
                    
                    # 신뢰도 임계값 체크
                    if conf < self.confidence_threshold:
                        continue
                    
                    # bbox 좌표 추출 (x1, y1, x2, y2)
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # 클래스 라벨
                    cls_id = int(box.cls[0])
                    label = result.names.get(cls_id, f"class_{cls_id}")
                    
                    detections.append({
                        "label": label,
                        "confidence": round(conf, 3),
                        "bbox": {
                            "x1": round(x1, 1),
                            "y1": round(y1, 1),
                            "x2": round(x2, 1),
                            "y2": round(y2, 1)
                        }
                    })
            
            return detections
            
        except Exception as e:
            logger.error(f"YOLO 추론 에러: {e}")
            return []


# 싱글톤 인스턴스
yolo_service = YoloService()
