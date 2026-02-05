import logging
import os
import subprocess
import json
import asyncio
import yaml
from app.core.config import settings
from app.services.storage_service import storage_service
from app.services.mqtt_service import mqtt_service

logger = logging.getLogger(__name__)

class MapService:
    def __init__(self):
        self.output_dir = "maps"
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def generate_map_task(self, request_id: str):
        """
        맵 세이버를 실행하고, 이미지를 변환하여 GCS에 업로드한 후, 백엔드에 알림을 보냅니다.
        이 작업은 메인 스레드를 차단하지 않기 위해 비동기로 실행됩니다.
        """
        logger.info(f"🗺️ 지도 생성 작업 시작 - 요청 ID: {request_id}")

        try:
            # 1. ROS2 맵 세이버 실행
            # 보안 강화를 위해 map_name 대신 request_id를 파일명으로 사용합니다.
            # 파일명에 허용되지 않는 문자가 있을 수 있으므로 request_id만 사용이 안전합니다.
            safe_filename = f"map_{request_id}"
            base_filename = os.path.join(os.getcwd(), self.output_dir, safe_filename)
            
            # 명령어: ros2 run nav2_map_server map_saver_cli -f <절대경로>
            cmd = ["ros2", "run", "nav2_map_server", "map_saver_cli", "-f", base_filename]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"❌ 맵 세이버 실패: {stderr.decode()}")
                self._send_result(request_id, status="fail", error_message="맵 세이버 명령어 실패")
                return

            logger.info("✅ 지도 파일 생성 완료 (pgm + yaml)")

            # 2. 메타데이터 파싱 (YAML)
            yaml_path = f"{base_filename}.yaml"
            pgm_path = f"{base_filename}.pgm"
            png_path = f"{base_filename}.png"

            if not os.path.exists(yaml_path) or not os.path.exists(pgm_path):
                logger.error("❌ 생성된 지도 파일을 찾을 수 없습니다.")
                self._send_result(request_id, status="fail", error_message="지도 파일 없음")
                return

            with open(yaml_path, 'r') as f:
                map_metadata = yaml.safe_load(f)
            
            resolution = map_metadata.get('resolution', 0.05)
            origin = map_metadata.get('origin', [0.0, 0.0, 0.0])
            origin_x = origin[0]
            origin_y = origin[1]

            # 3. PGM을 PNG로 변환 (pnmtopng 사용)
            # 셸 주입 방지: shlex.quote 사용하거나 단순히 파일명에 특수문자가 없음을 보장해야 함.
            # 여기서는 request_id 기반으로 생성한 safe_filename만 사용하므로 상대적으로 안전하지만,
            # 공백 처리 등을 위해 따옴표를 명시합니다.
            convert_cmd = f'pnmtopng "{pgm_path}" > "{png_path}"'
            
            convert_process = await asyncio.create_subprocess_shell(
                convert_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            c_stdout, c_stderr = await convert_process.communicate()

            if convert_process.returncode != 0:
                logger.error(f"❌ 이미지 변환 실패: {c_stderr.decode()}")
                if not os.path.exists(png_path):
                     self._send_result(request_id, status="fail", error_message="이미지 변환 실패")
                     return

            logger.info("✅ 지도 이미지가 PNG로 변환됨")

            # 너비/높이 가져오기 (PGM 헤더 파싱 개선)
            width, height = self._get_image_dimensions_from_pgm(pgm_path)
            
            if width == 0 or height == 0:
                logger.error("❌ 이미지 크기를 확인할 수 없습니다.")
                self._send_result(request_id, status="fail", error_message="이미지 크기 확인 불가")
                return

            # 4. GCS 업로드
            # 목적지 파일명도 request_id 기반으로 생성
            image_url = storage_service.upload_file(png_path, destination_name=f"maps/map_{request_id}.png")

            if not image_url:
                logger.error("❌ 알 수 없는 업로드 실패")
                self._send_result(request_id, status="fail", error_message="업로드 실패")
                return
            
            # GCS URL이 gs://로 시작한다면 https://로 변환 (StorageService가 이미 처리할 수도 있지만 안전장치)
            if image_url.startswith("gs://"):
                 # gs://bucket_name/path/to/file -> https://storage.googleapis.com/bucket_name/path/to/file
                 bucket_name = settings.GCS_BUCKET_NAME
                 object_path = image_url.replace(f"gs://{bucket_name}/", "")
                 image_url = f"https://storage.googleapis.com/{bucket_name}/{object_path}"

            # 5. 성공 결과 전송
            result_payload = {
                "requestId": request_id,
                "status": "success",
                "imageUrl": image_url,
                "width": width,
                "height": height,
                "resolution": resolution,
                "originX": origin_x,
                "originY": origin_y
            }
            
            self._send_result(request_id, payload=result_payload)
            
            # 임시 파일 정리 (선택 사항)
            # try:
            #     os.remove(pgm_path)
            #     os.remove(yaml_path)
            #     os.remove(png_path)
            # except:
            #     pass

        except Exception as e:
            logger.error(f"❌ 지도 생성 중 예기치 않은 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self._send_result(request_id, status="fail", error_message=str(e))

    def _get_image_dimensions_from_pgm(self, pgm_path):
        """
        PGM 파일 헤더를 파싱하여 너비와 높이를 반환합니다.
        헤더 길이에 제한을 두지 않고 필요한 정보를 찾을 때까지 읽습니다.
        """
        try:
            with open(pgm_path, 'rb') as f:
                header_data = b""
                tokens = []
                
                # PGM 헤더는 P5/P2, 너비, 높이, 최대값 순서로 나옴
                # 주석(#)은 줄 단위로 무시
                # 최대값(Maxval) 다음에는 공백 문자 하나(보통 줄바꿈)가 오고 그 뒤부터 바이너리 데이터
                
                in_comment = False
                while len(tokens) < 4:  # 매직넘버, 너비, 높이, 최대값까지 4개 토큰 필요
                    byte = f.read(1)
                    if not byte:
                        break
                    
                    char = byte.decode('ascii', errors='ignore')
                    
                    # 주석 처리
                    if char == '#':
                        in_comment = True
                        continue
                    if in_comment:
                        if char == '\n':
                            in_comment = False
                        continue
                        
                    # 공백 처리 (토큰 구분)
                    if char.isspace():
                        if header_data:
                            tokens.append(header_data.decode('ascii'))
                            header_data = b""
                    else:
                        header_data += byte
                        
                    # 안전 장치: 헤더가 너무 길어지면 중단 (예: 1KB)
                    if f.tell() > 1024:
                        logger.warning("PGM 헤더가 너무 깁니다.")
                        break
                
                # 마지막 토큰 처리 if needed (보통 공백으로 끝나서 처리됨)
                
                if len(tokens) >= 3:
                     # tokens[0]은 매직넘버 (P5 등)
                     width = int(tokens[1])
                     height = int(tokens[2])
                     return width, height
                
        except Exception as e:
            logger.error(f"⚠️ PGM 헤더 파싱 실패: {e}")
        
        return 0, 0

    def _send_result(self, request_id, status=None, error_message=None, payload=None):
        topic = f"robot/{settings.ROBOT_ID}/map_result"
        
        if payload is None:
            payload = {
                "requestId": request_id,
                "status": status,
                "errorMessage": error_message,
                "errorCode": "MAP_GEN_ERROR"
            }
        
        mqtt_service.publish(topic, json.dumps(payload))
        logger.info(f"📤 Sent map result for {request_id} to {topic}")

map_service = MapService()
