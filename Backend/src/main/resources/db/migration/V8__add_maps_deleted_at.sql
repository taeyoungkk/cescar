-- Add soft delete column for maps
ALTER TABLE maps
    ADD COLUMN deleted_at TIMESTAMP;
