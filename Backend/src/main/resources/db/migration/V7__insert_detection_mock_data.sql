-- ========================================================
-- Flyway V4: 감지(Detection) 테스트 데이터
-- V3에서 생성된 Car/CarLog 데이터를 기반으로 감지 데이터 추가
-- ========================================================

-- 1. Map(맵) 생성 (CarLog 연결을 위해 필요)
INSERT INTO maps (id, car_id, name, width, height, resolution, origin_x, origin_y, created_at)
VALUES (1, 1, 'Test Map', 800, 600, 0.05, 0.0, 0.0, NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. CarLog(운행 기록) 생성 (Detection 연결을 위해 필요)
-- Car ID 1 (내 차)에 대한 운행 기록 생성
INSERT INTO car_logs (id, car_id, map_id, start_at, status, detection_count)
VALUES (1, 1, 1, NOW(), 'RUNNING', 2)
ON CONFLICT (id) DO NOTHING;

-- 3. Detection(감지) 데이터 생성
-- Log ID 1에 연결된 감지 기록 1 (이미지 O, 비디오 X)
INSERT INTO detections (id, log_id, label, confidence, x, y, image_url, video_url, created_at)
VALUES (1, 1, 'person', 0.95, 10.5, 20.5, 'detections/1/image.jpg', NULL, NOW())
ON CONFLICT (id) DO NOTHING;

-- Log ID 1에 연결된 감지 기록 2 (이미지 O, 비디오 O)
INSERT INTO detections (id, log_id, label, confidence, x, y, image_url, video_url, created_at)
VALUES (2, 1, 'car', 0.88, 30.0, 40.0, 'detections/2/image.jpg', 'detections/2/video.mp4', NOW())
ON CONFLICT (id) DO NOTHING;
