-- Public vacancy index, no applicant or order identifiers.
CREATE TABLE IF NOT EXISTS hhba_v4_public_job_assets (
 url TEXT PRIMARY KEY NOT NULL,
 company TEXT NOT NULL,
 title TEXT NOT NULL,
 location TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('OFFICIAL','REFERENCE')),
 jd_version_id TEXT,
 checked_at TEXT NOT NULL,
 CHECK((kind='OFFICIAL' AND jd_version_id IS NOT NULL) OR (kind='REFERENCE' AND jd_version_id IS NULL))
);
CREATE INDEX IF NOT EXISTS hhba_v4_public_job_assets_fresh ON hhba_v4_public_job_assets(checked_at DESC);
