-- HHBA V1 Stage 3: INTERNAL employer enrichment from public company evidence.
-- Preview first; never apply this migration automatically in production.
-- No candidate resume, account identity, prompt, tokens or full page body.
-- Candidate sources and AI tags are NEVER official-ownership verification.
CREATE TABLE IF NOT EXISTS hhba_knowledge_employer_enrichment_queue (
  employer_observation_id TEXT PRIMARY KEY
    REFERENCES hhba_knowledge_employer_observations(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(state IN ('PENDING','PROCESSING','RETRY','DONE','BLOCKED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  last_completed_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_enrich_due
 ON hhba_knowledge_employer_enrichment_queue(state,next_attempt_at);

-- Only safe public-company-page candidates; no trust or ATS ownership claim.
CREATE TABLE IF NOT EXISTS hhba_knowledge_employer_evidence (
  id TEXT PRIMARY KEY,
  employer_observation_id TEXT NOT NULL
    REFERENCES hhba_knowledge_employer_observations(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_host TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  page_name_matched INTEGER NOT NULL DEFAULT 0 CHECK(page_name_matched IN (0,1)),
  review_status TEXT NOT NULL DEFAULT 'SOURCE_CANDIDATE'
    CHECK(review_status IN ('SOURCE_CANDIDATE','REVIEWED','REJECTED')),
  first_checked_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  UNIQUE(employer_observation_id,source_url)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_evidence_review
 ON hhba_knowledge_employer_evidence(review_status,last_checked_at DESC);

-- Proposed tags are intentionally separate from the curated company profile.
-- A specific job title never automatically becomes a core business tag.
CREATE TABLE IF NOT EXISTS hhba_knowledge_employer_tag_proposals (
  employer_observation_id TEXT NOT NULL
    REFERENCES hhba_knowledge_employer_observations(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES hhba_knowledge_employer_evidence(id)
    ON DELETE CASCADE,
  dimension TEXT NOT NULL
    CHECK(dimension IN ('PRIMARY_INDUSTRY','ADDITIONAL_INDUSTRY',
      'BUSINESS_LINE','BUSINESS_SEGMENT','TECHNOLOGY')),
  tag_id TEXT NOT NULL,
  evidence_excerpt TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK(review_status IN ('PROPOSED','REVIEWED','REJECTED')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(employer_observation_id,evidence_id,dimension,tag_id)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_tag_lookup
 ON hhba_knowledge_employer_tag_proposals(dimension,tag_id,review_status);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_tag_review
 ON hhba_knowledge_employer_tag_proposals(review_status,last_seen_at DESC);

-- Durable limit: reserve at most 8 new enterprise enrichment runs per UTC day.
-- Queries and provider calls are always initiated server-side after a reservation.
CREATE TABLE IF NOT EXISTS hhba_knowledge_enrichment_daily_budget (
  day_utc TEXT NOT NULL,
  employer_observation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(day_utc,employer_observation_id)
);
CREATE INDEX IF NOT EXISTS idx_hhba_knowledge_enrich_budget_day
 ON hhba_knowledge_enrichment_daily_budget(day_utc);
