-- 1. Cars 테이블에 nickname 컬럼 추가 (차량 별명)
ALTER TABLE cars
    ADD COLUMN nickname VARCHAR(50);

-- 2. Car Status 테이블에서 is_online 컬럼 제거 (Heartbeat 방식으로 전환)
ALTER TABLE car_status DROP COLUMN is_online;
