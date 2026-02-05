import logging
import os
from logging.handlers import RotatingFileHandler

def setup_logging():
    """
    전역 로깅 설정: 콘솔 출력 및 파일 저장(Rotating)을 설정합니다.
    Django의 LOGGING 설정과 유사하게 한 곳에서 관리합니다.
    """
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # 로그 포맷 정의
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'
    formatter = logging.Formatter(log_format, datefmt=date_format)

    # 루트 로거 가져오기
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # 기존 핸들러 제거 (중복 방지)
    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    # 1. 콘솔 핸들러 설정
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 2. 파일 핸들러 설정 (누적기록 및 Rotating)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # 특정 라이브러리(예: uvicorn) 로그 레벨 조정이 필요한 경우 여기서 추가 가능
    # logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    logging.info("🚀 Global logging system initialized (Console + File)")
