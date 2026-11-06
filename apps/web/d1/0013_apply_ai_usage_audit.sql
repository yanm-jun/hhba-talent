-- HHBA one-key apply V0.6: minimal AI token/cost audit, no PII.
-- Requires 0011; backup and apply only to preview before production review.
ALTER TABLE hhba_apply_ai_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy' CHECK(status IN ('legacy','reserved','ok','failed'));
ALTER TABLE hhba_apply_ai_requests ADD COLUMN model TEXT NOT NULL DEFAULT '';
ALTER TABLE hhba_apply_ai_requests ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK(prompt_tokens>=0);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0 CHECK(cached_tokens>=0);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK(completion_tokens>=0);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN estimated_peak_microusd INTEGER NOT NULL DEFAULT 0 CHECK(estimated_peak_microusd>=0);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0 CHECK(duration_ms>=0);
ALTER TABLE hhba_apply_ai_requests ADD COLUMN error_code TEXT;
ALTER TABLE hhba_apply_ai_requests ADD COLUMN completed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_hhba_apply_ai_requests_day ON hhba_apply_ai_requests(created_at,status);
