-- ========================================================
-- Flyway V13: 소유자 스냅샷(owner_id) 추가
-- 소유 변경 시 과거 로그/지도 접근을 분리하기 위함
-- ========================================================

ALTER TABLE car_logs ADD COLUMN owner_id BIGINT;

UPDATE car_logs cl
SET owner_id = c.owner_id
FROM cars c
WHERE cl.car_id = c.id;

CREATE INDEX IF NOT EXISTS idx_car_logs_owner_id ON car_logs(owner_id);

ALTER TABLE maps ADD COLUMN owner_id BIGINT;

UPDATE maps m
SET owner_id = c.owner_id
FROM cars c
WHERE m.car_id = c.id;

CREATE INDEX IF NOT EXISTS idx_maps_owner_id ON maps(owner_id);
