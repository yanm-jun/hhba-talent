-- Separately consented structured profile sync. No source document is stored
-- here and the profile fields are encrypted with a secret kept outside D1.
-- Configure HHBA_APPLY_PROFILE_TRANSFER_KEY (64 random hex chars) via
-- Cloudflare Preview secret after isolated preview migration and review.
CREATE TABLE IF NOT EXISTS hhba_apply_profile_transfers (
 phone TEXT PRIMARY KEY REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 resume_id TEXT NOT NULL,
 nonce_hex TEXT NOT NULL,
 cipher_hex TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 claimed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_profile_transfers_expiry
 ON hhba_apply_profile_transfers(expires_at);
