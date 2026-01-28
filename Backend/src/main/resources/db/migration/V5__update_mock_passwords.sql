-- ========================================================
-- Flyway V5: 기존 목 데이터 완전 초기화 및 암호화 적용
-- 사용자 환경에서 직접 생성된 정답 해시값을 영구 보존합니다.
-- ========================================================

-- 1. 기존 연관 데이터(차량 소유권) 잠시 해제
UPDATE cars SET owner_id = NULL WHERE owner_id IN (1, 2);

-- 2. 기존 유저 삭제
DELETE FROM users WHERE id IN (1, 2);

-- 3. 유저 1 (test@ssafy.com, 비밀번호: 1234)
INSERT INTO users (id, email, password, name, nickname, created_at)
VALUES (1, 'test@ssafy.com', '$2a$10$AGb9sfiDTnaZuaqqAhi/AefGcKWH2BE2PGusfYdMZAW5JqlN7bd5W', '유저1', '유저1', NOW());

-- 4. 유저 2 (other@ssafy.com, 비밀번호: 1234)
INSERT INTO users (id, email, password, name, nickname, created_at)
VALUES (2, 'other@ssafy.com', '$2a$10$rCCE3ZPYSADbRtcMBlYHYubQlKH10PxG9Fel36S6BF4j1jY/NaP8O', '유저2', '유저2', NOW());

-- 5. 차량 소유권 다시 연동
UPDATE cars SET owner_id = 1 WHERE device_id = 'my-car-001';
UPDATE cars SET owner_id = 2 WHERE device_id = 'other-car-001';
