# HHBA Candidate Agent · Stage 2 candidate-runtime integration (2026-11-20)

## Scope
This draft is based on candidate Agent PR #423, NOT on main. Existing matching, authentication, candidate consent, and user-selected Word editor remain unchanged. No automatic applications.

## Runtime
- Admin policy is loaded from `hhba_candidate_agent_policy` in existing `HHBA_PNVS_AUTH_DB` **only after candidate authentication and express AI consent**.
- Candidate Agent runs only when BOTH the pre-existing platform master flag `HHBA_CANDIDATE_AGENT_ENABLED=1` (and, in production, `HHBA_CANDIDATE_AGENT_PRODUCTION_ALLOWED=1`) and the **administrator's D1 policy** enable it.
- Admin can select known Skills. Required matching Skills are: `resume_evidence`, `official_job_search`, `fit_scoring`; `targeted_resume_rewrite` is optional and remains behind a separate user decision and separate editor consent.
- Missing D1 migration, invalid/disabled policy and exhausted D1 read capacity fail closed for the *Agent*; the existing matching request uses its original safe legacy path if available.
- Optional `targeted_resume_rewrite` permission is enforced by **both** the user-facing Job Match action and the actual `/api/resume-rewrite` + `/api/resume-rewrite-step` API handlers. An already-open browser cannot bypass a newly disabled Skill to trigger paid rewriting. The original non-Agent editing route keeps its existing separate feature gates.
- A successful/failed Agent invocation is logged in `hhba_candidate_agent_runs` **without any user identity, resume content, prompt, official URL, or job title**.
- The candidate-facing interface only receives the Agent's actual execution trace when the feature truly ran, never a pretend progress animation.
- The existing model search still provides the list and scoring; this stage does **not** claim model-directed autonomous selection across all skills. This must be implemented and benchmarked separately.

## Database
Migration: `apps/web/d1/0031_candidate_agent_policy.sql`. The **same exact migration** is proposed in the companion admin PR. Apply it once to the correct candidate auth D1 after Preview tests; it has not been run against any production database.

## Acceptance
`node --experimental-sqlite --test scripts/candidate-agent-skills.contract.test.mjs scripts/candidate-agent-policy.contract.test.mjs`.
Do not merge this branch into main while PR #423 (itself based on PR #405) remains Draft. No production switch enabled in this change.

## Remaining before production
- Admin PR's password-only Skills page and authenticated POST API must be merged and tested against the **same D1 binding**.
- End-to-end signed-in Preview smoke on a synthetic resume and actual provider, including safeguards against expensive retries.
- Durable per-user orchestration (the anonymous completed-run ledger is **not** a resumable multi-skill job queue).
- Word original-layout renderer/service acceptance and actual downloadable document checks.
