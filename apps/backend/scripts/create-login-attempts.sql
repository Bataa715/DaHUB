-- [CRIT-2] Login attempts table for persistent brute-force protection.
-- Run this script once against the audit_db database before deploying the
-- updated auth.service.ts that uses ClickHouse-backed login throttling.
--
-- Usage:
--   clickhouse-client --host localhost --database audit_db < create-login-attempts.sql

CREATE TABLE IF NOT EXISTS login_attempts
(
    id          String,
    lockKey     String,       -- e.g. "login:dept:username" or "admin-login:userId"
    attemptedAt DateTime      DEFAULT now(),
    success     UInt8         DEFAULT 0   -- 1 = successful login (clears failures)
)
ENGINE = MergeTree()
ORDER BY (lockKey, attemptedAt)
TTL attemptedAt + INTERVAL 24 HOUR DELETE;  -- auto-clean rows older than 24h
