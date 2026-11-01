-- D1 additions: verified email challenges and HHBA /join applications
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

CREATE TABLE IF NOT EXISTS join_applications (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 contact_type TEXT NOT NULL,
 contact TEXT NOT NULL,
 direction TEXT NOT NULL,
 experience TEXT NOT NULL,
 portfolio TEXT,
 strength TEXT,
 weekly_time TEXT NOT NULL,
 collaboration_mode TEXT NOT NULL,
 note TEXT,
 created_at INTEGER NOT NULL,
 mail_status TEXT NOT NULL CHECK(mail_status IN ('pending','accepted','failed')),
 mail_provider_id TEXT,
 mail_updated_at INTEGER,
 consent_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_join_applications_created ON join_applications(created_at);

-- Server-enforced submission throttling. Applicant addresses never form the D1 rate key.
CREATE TABLE IF NOT EXISTS join_rate_limits (
 rate_key TEXT PRIMARY KEY NOT NULL,
 window_start INTEGER NOT NULL,
 hits INTEGER NOT NULL
);
