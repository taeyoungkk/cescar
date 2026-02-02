-- ========================================================
-- Flyway V4: 시퀀스 동기화
-- 수동으로 입력된 목 데이터(ID 1, 2)와 자동 생성 ID의 충돌을 방지합니다.
-- ========================================================

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('cars_id_seq', (SELECT MAX(id) FROM cars));
SELECT setval('maps_id_seq', (SELECT MAX(id) FROM maps));
