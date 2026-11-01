-- HHBA candidate/recruiter identity store. Email ownership and enterprise status are not verified in preview.
CREATE TABLE IF NOT EXISTS auth_users(
 id TEXT PRIMARY KEY NOT NULL,email TEXT NOT NULL UNIQUE,password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,password_iterations INTEGER NOT NULL,display_name TEXT NOT NULL,
 email_verified_at INTEGER,created_at INTEGER NOT NULL,disabled_at INTEGER);
CREATE TABLE IF NOT EXISTS auth_roles(
 user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 account_type TEXT NOT NULL CHECK(account_type IN ('candidate','recruiter')),
 created_at INTEGER NOT NULL,PRIMARY KEY(user_id,account_type));
CREATE TABLE IF NOT EXISTS auth_sessions(
 token_hash TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits(
 rate_key TEXT PRIMARY KEY NOT NULL,window_start INTEGER NOT NULL,hits INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_limits_start ON auth_rate_limits(window_start);
