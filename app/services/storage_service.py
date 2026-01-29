import logging
import os
from datetime import datetime
from google.cloud import storage
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.upload_dir = "uploads"
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)
        
        # GCS 클라이언트 초기화
        try:
            # .env에서 읽어온 자격 증명 파일 경로가 있다면 환경 변수에 설정
            if settings.GOOGLE_APPLICATION_CREDENTIALS:
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS

            self.client = storage.Client(project=settings.GOOGLE_CLOUD_PROJECT)
            self.bucket = self.client.bucket(settings.GCS_BUCKET_NAME)
            logger.info(f"✅ GCS Client initialized for bucket: {settings.GCS_BUCKET_NAME}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize GCS Client: {e}")
            self.client = None
            self.bucket = None

    def upload_file(self, file_path: str, destination_name: str = None) -> str:
        """
        파일을 Google Cloud Storage로 업로드합니다.
        """
        if not os.path.exists(file_path):
            logger.error(f"Upload failed: File not found at {file_path}")
            return None

        if destination_name is None:
            destination_name = os.path.basename(file_path)

        # GCS 내 경로 설정 (예: robot_id/파일명)
        blob_path = f"{settings.ROBOT_ID}/{destination_name}"

        try:
            if self.bucket:
                blob = self.bucket.blob(blob_path)
                
                # MIME 타입 자동 감지 (이미지/비디오 등 구분)
                import mimetypes
                content_type, _ = mimetypes.guess_type(file_path)
                
                # 감지되지 않을 경우 기본값 설정
                if content_type is None:
                    content_type = 'application/octet-stream'

                logger.info(f"📤 [GCS UPLOADING] {file_path} as {content_type}")
                
                blob.upload_from_filename(file_path, content_type=content_type)
                
                # public URL 생성
                cloud_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/{blob_path}"
                logger.info(f"🚀 [GCS SUCCESS] File uploaded to {cloud_url}")
                return cloud_url
            else:
                logger.error("GCS bucket is not initialized. Upload skipped.")
                return None
        except Exception as e:
            logger.error(f"❌ GCS Upload failed: {e}")
            return None

storage_service = StorageService()
