-- ========================================================
-- Flyway V12: car_logs ID 시퀀스 동기화
-- V7 mock 데이터에서 ID를 수동 삽입하면서 시퀀스가 꼬이는 문제 방지
-- ========================================================

SELECT setval('car_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM car_logs));
