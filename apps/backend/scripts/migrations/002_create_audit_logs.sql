-- Audit log table to track user actions
-- Stores who, when, what action was performed for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id String,
  userId String,
  userEmail String,
  action String,
  resource String,
  resourceId String,
  method String,
  ipAddress String,
  userAgent String,
  status String,
  errorMessage String,
  metadata String,
  createdAt DateTime,
  PRIMARY KEY (id)
) ENGINE = MergeTree()
ORDER BY (createdAt, userId);
