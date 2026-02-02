CREATE TABLE notification_tokens (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

ALTER TABLE notification_tokens
    ADD CONSTRAINT fk_notification_token_member FOREIGN KEY(member_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_notification_tokens_member_id ON notification_tokens(member_id);

-- Test dummy tokens for local verification
INSERT INTO notification_tokens (member_id, token, created_at, updated_at)
VALUES
    (1, 'DUMMY_TOKEN_USER_1', NOW(), NOW()),
    (2, 'DUMMY_TOKEN_USER_2', NOW(), NOW());
