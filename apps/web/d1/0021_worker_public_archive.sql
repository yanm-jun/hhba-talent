-- HHBA: PUBLIC-ONLY labor-rights archive and opt-in fund entry disclosures.
-- Requires the existing dedicated HHBA_TRANSPARENCY_DB and migration 0020.
-- Not an intake database. Store ONLY reviewed, consented, redacted public summaries.
-- Never import fictional HHBA-DEMO cases or simulated ledger amounts here.
-- Apply through a separately approved staging migration, not a production build.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS hhba_worker_public_cases(
 id TEXT PRIMARY KEY NOT NULL CHECK(id GLOB 'CASE-[A-Z0-9-]*' AND length(id) BETWEEN 11 AND 60),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 4 AND 160),
 category TEXT NOT NULL CHECK(category IN (
  '工资与薪酬','劳动合同与用工','工时休假','离职与补偿','社保与工伤','争议处理与证据'
 )),
 case_stage TEXT NOT NULL CHECK(case_stage IN ('受理中','处理中','已结束')),
 summary TEXT NOT NULL CHECK(length(summary) BETWEEN 30 AND 3000),
 process_summary TEXT NOT NULL CHECK(length(process_summary) BETWEEN 20 AND 4000),
 outcome_summary TEXT NOT NULL CHECK(length(outcome_summary) BETWEEN 20 AND 4000),
 publication_state TEXT NOT NULL DEFAULT 'draft'
  CHECK(publication_state IN ('draft','reviewed','published','withdrawn')),
 consent_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(consent_confirmed IN (0,1)),
 fact_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(fact_reviewed IN (0,1)),
 privacy_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(privacy_reviewed IN (0,1)),
 approved_by TEXT,
 published_at TEXT,
 revised_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(publication_state!='published' OR (
  consent_confirmed=1 AND fact_reviewed=1 AND privacy_reviewed=1
  AND length(trim(coalesce(approved_by,'')))>0 AND published_at IS NOT NULL
 ))
);
CREATE INDEX IF NOT EXISTS hhba_worker_public_cases_visible_idx
 ON hhba_worker_public_cases(publication_state,published_at DESC);

-- This table contains ONLY individual entries that operators separately cleared
-- for public release. Full fund totals MUST always come from published monthly
-- reports, not SUM of these optional, partial item disclosures.
CREATE TABLE IF NOT EXISTS hhba_fin_public_entries(
 id TEXT PRIMARY KEY NOT NULL CHECK(id GLOB 'FUND-[A-Z0-9-]*' AND length(id) BETWEEN 11 AND 64),
 period TEXT NOT NULL REFERENCES hhba_fin_reports(period),
 occurred_on TEXT NOT NULL CHECK(length(occurred_on)=10),
 entry_kind TEXT NOT NULL CHECK(entry_kind IN ('inflow','outflow')),
 amount_fen INTEGER NOT NULL CHECK(amount_fen>0),
 purpose_summary TEXT NOT NULL CHECK(length(purpose_summary) BETWEEN 10 AND 1500),
 public_case_id TEXT REFERENCES hhba_worker_public_cases(id),
 publication_state TEXT NOT NULL DEFAULT 'draft'
  CHECK(publication_state IN ('draft','reviewed','published','withdrawn')),
 source_checked INTEGER NOT NULL DEFAULT 0 CHECK(source_checked IN (0,1)),
 privacy_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(privacy_reviewed IN (0,1)),
 approved_by TEXT,
 published_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(publication_state!='published' OR (
  source_checked=1 AND privacy_reviewed=1
  AND length(trim(coalesce(approved_by,'')))>0 AND published_at IS NOT NULL
 )),
 CHECK(entry_kind='outflow' OR public_case_id IS NULL)
);
CREATE INDEX IF NOT EXISTS hhba_fin_public_entries_visible_idx
 ON hhba_fin_public_entries(publication_state,period DESC,occurred_on DESC);
CREATE INDEX IF NOT EXISTS hhba_fin_public_entries_case_idx
 ON hhba_fin_public_entries(public_case_id,publication_state);

-- No deletes of published records: use a reviewed withdrawal or correction,
-- and retain the internal publishing/audit history. A future admin publisher
-- must implement audit and separation-of-duties checks before enabling writes.
CREATE TRIGGER IF NOT EXISTS hhba_worker_public_cases_no_delete_published
 BEFORE DELETE ON hhba_worker_public_cases WHEN OLD.publication_state='published'
 BEGIN SELECT RAISE(ABORT,'PUBLISHED_CASE_CANNOT_BE_DELETED'); END;
CREATE TRIGGER IF NOT EXISTS hhba_fin_public_entries_no_delete_published
 BEFORE DELETE ON hhba_fin_public_entries WHEN OLD.publication_state='published'
 BEGIN SELECT RAISE(ABORT,'PUBLISHED_LEDGER_ENTRY_CANNOT_BE_DELETED'); END;
