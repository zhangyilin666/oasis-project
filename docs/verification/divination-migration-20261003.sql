-- Running upgrade c8d4e2f091ab -> d9f2a67b103c

CREATE TABLE divination_readings (
    id INTEGER NOT NULL AUTO_INCREMENT, 
    user_id INTEGER NOT NULL, 
    request_id VARCHAR(64) NOT NULL, 
    request_fingerprint VARCHAR(64), 
    rule_version VARCHAR(64), 
    input_data JSON, 
    facts JSON, 
    analysis JSON, 
    status VARCHAR(16) NOT NULL DEFAULT 'pending', 
    error_message VARCHAR(300), 
    model_name VARCHAR(64), 
    created_at DATETIME NOT NULL DEFAULT now(), 
    updated_at DATETIME NOT NULL DEFAULT now(), 
    deleted_at DATETIME, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_divination_user_request UNIQUE (user_id, request_id), 
    CONSTRAINT ck_divination_status CHECK (status IN ('pending','processing','completed','failed'))
);

CREATE INDEX ix_divination_user_created ON divination_readings (user_id, created_at);

UPDATE alembic_version SET version_num='d9f2a67b103c' WHERE alembic_version.version_num = 'c8d4e2f091ab';

