-- HHBA V1 Stage 2: private, shared, public-source discovery cache.
-- Additive migration for HHBA_PNVS_AUTH_DB; run on preview FIRST.
-- NEVER store resumes, users, prompts, API keys or personal match history here.
-- Nothing in these tables is automatically a verified employer or active job.
CREATE TABLE IF NOT EXISTS hhba_knowledge_sources (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  hostname TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('EMPLOYER_ATS','EMPLOYER_DOMAIN_CANDIDATE')),
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','VERIFIED','REJECTED')),
  proof_url TEXT,
  proof_checked_at TEXT,
  verified_employer_id TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1 CHECK(seen_count>=1)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_sources_review
  ON hhba_knowledge_sources(review_status,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_sources_host
  ON hhba_knowledge_sources(hostname,last_seen_at DESC);

-- The same short brand name on two hosts remains TWO observations.
-- No legal-entity merge is performed here, including shared ATS tenants.
CREATE TABLE IF NOT EXISTS hhba_knowledge_employer_observations (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  observed_host TEXT NOT NULL,
  identity_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(identity_status IN ('PENDING','REVIEWED','REJECTED')),
  industry_tags_json TEXT NOT NULL DEFAULT '[]',
  business_tags_json TEXT NOT NULL DEFAULT '[]',
  tags_status TEXT NOT NULL DEFAULT 'NEEDS_COMPANY_EVIDENCE'
    CHECK(tags_status IN ('NEEDS_COMPANY_EVIDENCE','PROPOSED','REVIEWED')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1 CHECK(seen_count>=1),
  UNIQUE(name_normalized,observed_host)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_employer_review
  ON hhba_knowledge_employer_observations(identity_status,last_seen_at DESC);

-- Position evidence is a candidate, not proof of ownership, an open vacancy,
-- eligibility, application submission or employment.
CREATE TABLE IF NOT EXISTS hhba_knowledge_job_observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES hhba_knowledge_sources(id),
  employer_observation_id TEXT NOT NULL REFERENCES hhba_knowledge_employer_observations(id),
  title TEXT NOT NULL,
  mainland_location TEXT NOT NULL,
  occupation_tag TEXT NOT NULL DEFAULT '',
  evidence_status TEXT NOT NULL DEFAULT 'SEARCH_CANDIDATE'
    CHECK(evidence_status IN ('SEARCH_CANDIDATE','DETAIL_REVIEWED','REJECTED')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1 CHECK(seen_count>=1)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_jobs_employer
  ON hhba_knowledge_job_observations(employer_observation_id,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_jobs_role
  ON hhba_knowledge_job_observations(occupation_tag,last_seen_at DESC);
