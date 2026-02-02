-- Fix detections ID sequence after inserting fixed IDs
SELECT setval(
    pg_get_serial_sequence('detections', 'id'),
    COALESCE((SELECT MAX(id) FROM detections), 1)
);
