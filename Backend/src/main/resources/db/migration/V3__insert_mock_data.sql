-- 테스트 유저 (ID: 1, 비밀번호: 1234)
-- 주의: password는 암호화되지 않은 평문입니다 (테스트용)
INSERT INTO users (id, email, password, name, nickname, created_at)
VALUES (1, 'test@ssafy.com', '1234', '테스트유저', '테스터', NOW())
ON CONFLICT (id) DO NOTHING;

-- 1. 소유자 없는 차량 (등록 테스트용)
-- Claim Code: CLAIM-1111
INSERT INTO cars (device_id, claim_code, created_at)
VALUES ('device-new-001', 'CLAIM-1111', NOW())
ON CONFLICT (device_id) DO NOTHING;

-- 2. 이미 등록된 차량 (조회/제어 테스트용, 소유자: 1)
-- Claim Code: CLAIM-2222
INSERT INTO cars (device_id, claim_code, nickname, owner_id, created_at)
VALUES ('device-owned-001', 'CLAIM-2222', '테스트카', 1, NOW())
ON CONFLICT (device_id) DO NOTHING;

-- 2번 차량의 초기 상태 데이터 (Car ID 조회 필요, 여기서는 순차적으로 2번이라 가정하거나 서브쿼리 사용)
-- PostgreSQL에서 currval 등을 쓰기보다 안전하게 서브쿼리로 ID 조회해서 넣음
INSERT INTO car_status (car_id, mode, heading, x, y, updated_at)
SELECT id, CAST('STOP' AS car_mode), 0.0, 0.0, 0.0, NOW()
FROM cars
WHERE device_id = 'device-owned-001'
ON CONFLICT (car_id) DO NOTHING;
