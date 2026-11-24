-- Only digests and expiration timestamps; never persist CVs or model drafts.
CREATE TABLE IF NOT EXISTS hhba_ai_checkpoint_claims (
 token_hash TEXT PRIMARY KEY,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_ai_checkpoint_claims_expiry ON hhba_ai_checkpoint_claims(expires_at);
