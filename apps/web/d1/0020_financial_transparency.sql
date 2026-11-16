-- HHBA Financial Transparency v1 (dedicated D1 binding HHBA_TRANSPARENCY_DB).
-- Apply manually to a dedicated database AFTER verifying migration against staging.
-- This migration does not contain any illustrative or fabricated financial numbers.
CREATE TABLE IF NOT EXISTS hhba_fin_reports(
 period TEXT PRIMARY KEY CHECK(period GLOB '20[0-9][0-9]-[0-1][0-9]'),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','published')),
 draft_json TEXT NOT NULL,
 reviewed_json TEXT,
 published_json TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 prepared_by TEXT NOT NULL,
 reviewed_by TEXT,
 review_note TEXT,
 correction_reason TEXT,
 reviewed_at TEXT,
 published_at TEXT,
 corrected_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hhba_fin_reports_published_idx ON hhba_fin_reports(status,period DESC);
CREATE TABLE IF NOT EXISTS hhba_fin_publication_revisions(
 period TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 published_json TEXT NOT NULL,
 published_at TEXT NOT NULL,
 correction_reason TEXT NOT NULL,
 approved_by TEXT NOT NULL,
 PRIMARY KEY(period,revision)
);
CREATE TABLE IF NOT EXISTS hhba_fin_audit(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 period TEXT,
 action TEXT NOT NULL,
 actor TEXT NOT NULL,
 event_note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hhba_fin_audit_period_idx ON hhba_fin_audit(period,created_at);
CREATE TABLE IF NOT EXISTS hhba_fin_subscribers(
 email_hash TEXT PRIMARY KEY,
 email TEXT,
 status TEXT NOT NULL CHECK(status IN ('pending','verified','unsubscribed')),
 verify_token_hash TEXT,
 verify_expires_at TEXT,
 unsubscribe_token_hash TEXT,
 last_verification_sent_at TEXT,
 consent_version TEXT NOT NULL DEFAULT 'transparency-email-v1',
 consent_at TEXT NOT NULL,
 verified_at TEXT,
 unsubscribed_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS hhba_fin_sub_verify_idx
 ON hhba_fin_subscribers(verify_token_hash) WHERE verify_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hhba_fin_sub_unsubscribe_idx
 ON hhba_fin_subscribers(unsubscribe_token_hash) WHERE unsubscribe_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS hhba_fin_sub_active_idx ON hhba_fin_subscribers(status,email_hash);
CREATE TABLE IF NOT EXISTS hhba_fin_deliveries(
 period TEXT NOT NULL,
 email_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_until TEXT,
 provider_message_id TEXT,
 last_error_code TEXT,
 sent_at TEXT,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(period,email_hash)
);
CREATE INDEX IF NOT EXISTS hhba_fin_delivery_queue_idx ON hhba_fin_deliveries(period,status,updated_at);

-- Public report history and internal audit records are append-only.
-- Corrections create a new numbered version, never rewrite the original release.
CREATE TRIGGER IF NOT EXISTS hhba_fin_revisions_no_update
 BEFORE UPDATE ON hhba_fin_publication_revisions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PUBLICATION_HISTORY'); END;
CREATE TRIGGER IF NOT EXISTS hhba_fin_revisions_no_delete
 BEFORE DELETE ON hhba_fin_publication_revisions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PUBLICATION_HISTORY'); END;
CREATE TRIGGER IF NOT EXISTS hhba_fin_audit_no_update
 BEFORE UPDATE ON hhba_fin_audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FINANCE_AUDIT'); END;
CREATE TRIGGER IF NOT EXISTS hhba_fin_audit_no_delete
 BEFORE DELETE ON hhba_fin_audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FINANCE_AUDIT'); END;
