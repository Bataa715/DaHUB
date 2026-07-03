-- ============================================================================
-- ClickHouse cleanup & optimization — 2026-07
-- Internal Audit web (audit_db)
--
-- Энэ скрипт backend-ийн startup migration-тэй ИЖИЛ өөрчлөлтүүдийг хийнэ.
-- Backend-ээ restart хийвэл автоматаар хэрэгжинэ; яаралтай бол доорхыг
-- clickhouse-client дээр гараар ажиллуулж болно. Бүх үйлдэл idempotent.
--
--   clickhouse-client --user audit_app --password '<нууц үг>' -d audit_db \
--       --multiquery < 2026-07-clickhouse-cleanup.sql
-- ============================================================================

-- ── 1. Кодонд ашиглагддаг ч schema-д дутуу байсан багана ────────────────────
ALTER TABLE audit_db.users ADD COLUMN IF NOT EXISTS grantableTools String DEFAULT '[]';

-- ── 2. Хэзээ ч бөглөгддөггүй / уншигддаггүй баганууд ────────────────────────
-- audit_logs: userEmail, ipAddress, userAgent — үргэлж '' утгатай, веб дээр харагддаггүй
ALTER TABLE audit_db.audit_logs DROP COLUMN IF EXISTS userEmail;
ALTER TABLE audit_db.audit_logs DROP COLUMN IF EXISTS ipAddress;
ALTER TABLE audit_db.audit_logs DROP COLUMN IF EXISTS userAgent;

-- refresh_tokens.id, login_attempts.id — бичигддэг ч хэзээ ч уншигддаггүй
ALTER TABLE audit_db.refresh_tokens DROP COLUMN IF EXISTS id;
ALTER TABLE audit_db.login_attempts DROP COLUMN IF EXISTS id;

-- departments.employeeCount — веб дээр харагддаггүй (users.length ашигладаг)
ALTER TABLE audit_db.departments DROP COLUMN IF EXISTS employeeCount;

-- tailan_images.dataBase64 — хуучин нэршлийн үлдэгдэл багана
ALTER TABLE audit_db.tailan_images DROP COLUMN IF EXISTS dataBase64;

-- ── 3. TTL — лог/түр хүснэгтүүд автоматаар цэвэрлэгдэнэ ─────────────────────
ALTER TABLE audit_db.audit_logs          MODIFY TTL createdAt + INTERVAL 2 YEAR;
ALTER TABLE audit_db.python_api_run_logs MODIFY TTL ranAt     + INTERVAL 2 YEAR;
ALTER TABLE audit_db.refresh_tokens      MODIFY TTL expiresAt + INTERVAL 1 DAY;

-- ── 4. Том blob/JSON баганууд — ZSTD codec (диск хэмнэнэ) ───────────────────
ALTER TABLE audit_db.users          MODIFY COLUMN profileImage String CODEC(ZSTD(3));
ALTER TABLE audit_db.medleg         MODIFY COLUMN imageUrl     String CODEC(ZSTD(3));
ALTER TABLE audit_db.medleg         MODIFY COLUMN content      String CODEC(ZSTD(3));
ALTER TABLE audit_db.tailan_images  MODIFY COLUMN imageData    String DEFAULT '' CODEC(ZSTD(3));
ALTER TABLE audit_db.tailan_reports MODIFY COLUMN plannedTasksJson    String DEFAULT '[]' CODEC(ZSTD(3));
ALTER TABLE audit_db.tailan_reports MODIFY COLUMN dynamicSectionsJson String DEFAULT '[]' CODEC(ZSTD(3));
ALTER TABLE audit_db.tailan_reports MODIFY COLUMN extraDataJson       String DEFAULT '{}' CODEC(ZSTD(3));
ALTER TABLE audit_db.risk_assessment_history MODIFY COLUMN rowsJson   String DEFAULT '[]' CODEC(ZSTD(3));

-- ── 5. (Сонголтоор) Хуучин parts-ыг шинэ codec-оор дахин бичих ──────────────
-- Дискний хэмнэлтийг шууд авахыг хүсвэл (их өгөгдөлтэй үед удаж магадгүй):
-- OPTIMIZE TABLE audit_db.users          FINAL;
-- OPTIMIZE TABLE audit_db.medleg         FINAL;
-- OPTIMIZE TABLE audit_db.tailan_images  FINAL;
-- OPTIMIZE TABLE audit_db.tailan_reports FINAL;

-- ── 6. Шалгах query-нүүд ────────────────────────────────────────────────────
-- SELECT table, name, type FROM system.columns
--   WHERE database = 'audit_db' AND table IN
--   ('audit_logs','refresh_tokens','login_attempts','departments','users')
--   ORDER BY table, position;
-- SELECT table, formatReadableSize(sum(bytes_on_disk)) AS size
--   FROM system.parts WHERE database='audit_db' AND active
--   GROUP BY table ORDER BY sum(bytes_on_disk) DESC;
