-- =====================================
-- Flyway V1: 초기 테이블 및 ENUM 생성
-- =====================================

-- 1. users 테이블
CREATE TABLE users (
                       id BIGSERIAL PRIMARY KEY,
                       email VARCHAR(255) NOT NULL UNIQUE,
                       password VARCHAR(255) NOT NULL,
                       name VARCHAR(100) NOT NULL,
                       nickname VARCHAR(100) NOT NULL,
                       created_at TIMESTAMP NOT NULL
);

-- 2. car_mode ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'car_mode') THEN
CREATE TYPE car_mode AS ENUM ('STOP', 'MANUAL', 'AUTO');
END IF;
END $$;

-- 3. log_status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_status') THEN
CREATE TYPE log_status AS ENUM ('RUNNING', 'STOPPED', 'ERROR', 'COMPLETED');
END IF;
END $$;

-- 4. cars 테이블 (FK 제외, maps FK는 나중에 추가)
CREATE TABLE cars (
                      id BIGSERIAL PRIMARY KEY,
                      device_id VARCHAR(64) NOT NULL UNIQUE,
                      owner_id BIGINT,
                      current_map_id BIGINT,
                      claim_code VARCHAR(32) NOT NULL UNIQUE,
                      created_at TIMESTAMP NOT NULL
);

-- 5. maps 테이블 (car_id FK 제외)
CREATE TABLE maps (
                      id BIGSERIAL PRIMARY KEY,
                      car_id BIGINT NOT NULL,
                      name VARCHAR(50) NOT NULL,
                      image_url TEXT,
                      width INT NOT NULL,
                      height INT NOT NULL,
                      resolution REAL NOT NULL,
                      origin_x REAL NOT NULL,
                      origin_y REAL NOT NULL,
                      created_at TIMESTAMP NOT NULL
);

-- 6. car_status 테이블
CREATE TABLE car_status (
                            car_id BIGINT PRIMARY KEY,
                            x NUMERIC(10,4) DEFAULT 0,
                            y NUMERIC(10,4) DEFAULT 0,
                            heading REAL NOT NULL DEFAULT 0,
                            mode car_mode NOT NULL DEFAULT 'STOP',
                            is_online BOOLEAN NOT NULL DEFAULT FALSE,
                            updated_at TIMESTAMP NOT NULL
);

-- 7. car_logs 테이블 (FK 제외)
CREATE TABLE car_logs (
                          id BIGSERIAL PRIMARY KEY,
                          car_id BIGINT NOT NULL,
                          map_id BIGINT NOT NULL,
                          start_at TIMESTAMP NOT NULL,
                          end_at TIMESTAMP,
                          status log_status NOT NULL,
                          detection_count INT NOT NULL DEFAULT 0
);

-- 8. detections 테이블 (FK 제외)
CREATE TABLE detections (
                            id BIGSERIAL PRIMARY KEY,
                            log_id BIGINT NOT NULL,
                            label VARCHAR(50) NOT NULL,
                            confidence REAL NOT NULL,
                            x NUMERIC(10,4) NOT NULL,
                            y NUMERIC(10,4) NOT NULL,
                            image_url TEXT,
                            created_at TIMESTAMP NOT NULL
);

-- =====================================
-- FK 제약조건 추가 (ALTER TABLE)
-- =====================================

-- cars
ALTER TABLE cars
    ADD CONSTRAINT fk_car_owner FOREIGN KEY(owner_id) REFERENCES users(id);

ALTER TABLE cars
    ADD CONSTRAINT fk_car_current_map FOREIGN KEY(current_map_id) REFERENCES maps(id);

-- maps
ALTER TABLE maps
    ADD CONSTRAINT fk_map_car FOREIGN KEY(car_id) REFERENCES cars(id) ON DELETE CASCADE;

-- car_status
ALTER TABLE car_status
    ADD CONSTRAINT fk_status_car FOREIGN KEY(car_id) REFERENCES cars(id) ON DELETE CASCADE;

-- car_logs
ALTER TABLE car_logs
    ADD CONSTRAINT fk_log_car FOREIGN KEY(car_id) REFERENCES cars(id) ON DELETE CASCADE;

ALTER TABLE car_logs
    ADD CONSTRAINT fk_log_map FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE;

-- detections
ALTER TABLE detections
    ADD CONSTRAINT fk_detection_log FOREIGN KEY(log_id) REFERENCES car_logs(id) ON DELETE CASCADE;
