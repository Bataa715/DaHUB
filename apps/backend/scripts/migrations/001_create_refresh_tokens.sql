-- Refresh tokens table for JWT token refresh mechanism
-- This table stores refresh tokens to allow users to obtain new access tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id String,
  userId String,
  token String,
  expiresAt DateTime,
  isRevoked UInt8 DEFAULT 0,
  createdAt DateTime,
  PRIMARY KEY (id)
) ENGINE = MergeTree()
ORDER BY (id);
