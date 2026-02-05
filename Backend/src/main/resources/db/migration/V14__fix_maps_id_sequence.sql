-- Sync BIGSERIAL sequences to avoid duplicate key after manual inserts
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0));
SELECT setval('cars_id_seq', COALESCE((SELECT MAX(id) FROM cars), 0));
SELECT setval('maps_id_seq', COALESCE((SELECT MAX(id) FROM maps), 0));
SELECT setval('car_logs_id_seq', COALESCE((SELECT MAX(id) FROM car_logs), 0));
SELECT setval('detections_id_seq', COALESCE((SELECT MAX(id) FROM detections), 0));
SELECT setval('notification_tokens_id_seq', COALESCE((SELECT MAX(id) FROM notification_tokens), 0));
