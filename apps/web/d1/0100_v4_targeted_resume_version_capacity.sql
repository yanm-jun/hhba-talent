-- Preserve existing confirmed resume versions; remove legacy 24,000-character
-- product ceiling. D1's native single-row limit remains and is checked in API.
CREATE TABLE hhba_targeted_resume_versions_v4_migrate (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 job_id TEXT NOT NULL,
 job_title TEXT NOT NULL,
 company TEXT NOT NULL,
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 created_at TEXT NOT NULL
);
INSERT INTO hhba_targeted_resume_versions_v4_migrate SELECT * FROM hhba_targeted_resume_versions;
DROP TABLE hhba_targeted_resume_versions;
ALTER TABLE hhba_targeted_resume_versions_v4_migrate RENAME TO hhba_targeted_resume_versions;
CREATE INDEX idx_hhba_targeted_resume_versions_owner ON hhba_targeted_resume_versions(phone,created_at DESC);
CREATE INDEX idx_hhba_targeted_resume_versions_job ON hhba_targeted_resume_versions(phone,job_id,created_at DESC);
