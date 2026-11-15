-- HHBA Talent Intelligence V1 — additive, opt-in D1 migration.
-- DO NOT APPLY automatically to production until a controlled rollout.
-- Does not alter 17 industry libraries or existing candidate/enterprise tables.
-- Attestations are ONLY inserted/approved by an authenticated independent
-- reviewer or separately audited company verification service; search or AI
-- results must never INSERT "verified" records.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hhba_talent_employer_proofs_v1 (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  official_domain TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  careers_url TEXT NOT NULL,
  issuer TEXT NOT NULL CHECK (
    issuer IN ('verified_employer_account','independent_company_audit','human_review')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','verified','revoked','rejected')
  ),
  evidence_url TEXT NOT NULL,
  evidence_quote TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(company) BETWEEN 2 AND 150),
  CHECK (length(official_domain) BETWEEN 4 AND 240),
  CHECK (length(evidence_url) BETWEEN 12 AND 4096),
  CHECK (length(evidence_quote) BETWEEN 20 AND 2000),
  CHECK (length(reviewer_id) BETWEEN 4 AND 150),
  CHECK (status != 'verified' OR verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hhba_talent_employer_proofs_verified_domain
ON hhba_talent_employer_proofs_v1(status,official_domain);

CREATE TABLE IF NOT EXISTS hhba_talent_ats_tenants_v1 (
  id TEXT PRIMARY KEY,
  employer_proof_id TEXT NOT NULL,
  ats_host TEXT NOT NULL,
  tenant_prefix TEXT NOT NULL,
  authorized_careers_url TEXT NOT NULL,
  official_link_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','verified','revoked','rejected')
  ),
  reviewer_id TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employer_proof_id)
    REFERENCES hhba_talent_employer_proofs_v1(id),
  CHECK (length(ats_host) BETWEEN 4 AND 240),
  CHECK (length(tenant_prefix) BETWEEN 2 AND 400),
  CHECK (substr(tenant_prefix,1,1) = '/'),
  CHECK (status != 'verified' OR verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hhba_talent_ats_tenants_verified_host
ON hhba_talent_ats_tenants_v1(status,ats_host,tenant_prefix);

-- Optional discovery staging: candidate sources are NOT employer proofs.
-- Avoid per-user or per-search writes; aggregate and dedupe by canonical host.
CREATE TABLE IF NOT EXISTS hhba_talent_source_candidates_v1 (
  domain TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  first_discovered_at TEXT NOT NULL,
  last_discovered_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','in_review','verified','rejected')
  ),
  reviewer_note TEXT
);
