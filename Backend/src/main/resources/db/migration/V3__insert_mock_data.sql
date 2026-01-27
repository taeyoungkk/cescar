-- ========================================================
-- Flyway V3: 테스트 목데이터 구축
-- 3가지 시나리오: 내 차, 타인 차, 미등록 차량
-- ========================================================

-- 1. 테스트 유저 생성
-- 유저 1 (본인 역할, 비밀번호: 1234)
INSERT INTO users (id, email, password, name, nickname, created_at)
VALUES (1, 'test@ssafy.com', '1234', '유저1', '유저1', NOW())
ON CONFLICT (id) DO NOTHING;

-- 유저 2 (타인 역할, 비밀번호: 1234)
INSERT INTO users (id, email, password, name, nickname, created_at)
VALUES (2, 'other@ssafy.com', '1234', '유저2', '유저2', NOW())
ON CONFLICT (id) DO NOTHING;


-- 2. 시나리오별 차량 데이터 생성

-- [시나리오 1] 내 차 (My Car) - 등록완료, 온라인 상태
-- 조회 성공 테스트용
INSERT INTO cars (id, device_id, claim_code, nickname, owner_id, created_at)
VALUES (1, 'my-car-001', 'CLAIM-1111', '내차', 1, NOW())
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO car_status (car_id, mode, heading, x, y, updated_at)
VALUES (1, CAST('STOP' AS car_mode), 0.0, 10.0, 20.0, NOW())
ON CONFLICT (car_id) DO NOTHING;


-- [시나리오 2] 타인 차량 (Other's Car) - 등록완료, 온라인 상태
-- 권한 부족(조회 실패) 테스트용
INSERT INTO cars (id, device_id, claim_code, nickname, owner_id, created_at)
VALUES (2, 'other-car-001', 'CLAIM-2222', '남의차', 2, NOW())
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO car_status (car_id, mode, heading, x, y, updated_at)
VALUES (2, CAST('AUTO' AS car_mode), 45.0, 50.0, 50.0, NOW())
ON CONFLICT (car_id) DO NOTHING;


-- [시나리오 3] 미등록 차량 (Unowned Car) - 등록 테스트용
-- PATCH API 시뮬레이션 후 등록 테스트 진행
INSERT INTO cars (id, device_id, claim_code, created_at)
VALUES (3, 'unowned-car-001', 'CLAIM-3333', NOW())
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO car_status (car_id, mode, heading, x, y, updated_at)
VALUES (3, CAST('STOP' AS car_mode), 0.0, 0.0, 0.0, NOW() - INTERVAL '1 hour')
ON CONFLICT (car_id) DO NOTHING;
