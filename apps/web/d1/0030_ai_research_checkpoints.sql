-- HHBA resumable AI job research checkpoints; account-specific and expire within one day.
-- Stored content is PUBLIC employer job/search evidence and tool metadata ONLY.
-- Never store resume text, tokens, model prompts, applicant PII or Word documents.
-- Apply to HHBA_PNVS_AUTH_DB, not the shared/public JD archive DB.
CREATE TABLE IF NOT EXISTS hhba_ai_research_checkpoints (
 fingerprint TEXT PRIMARY KEY NOT NULL CHECK(length(fingerprint)=64),
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 state_json TEXT NOT NULL CHECK(length(state_json)<=125000),
 updated_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_ai_research_checkpoint_owner
 ON hhba_ai_research_checkpoints(phone,expires_at);
