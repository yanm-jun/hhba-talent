-- Email-only migration for HHBA authentication phase one. No /join forms or applicant data.
CREATE TABLE IF NOT EXISTS auth_email_challenges (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 used_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_email_challenges_email ON auth_email_challenges(email,purpose,created_at);
