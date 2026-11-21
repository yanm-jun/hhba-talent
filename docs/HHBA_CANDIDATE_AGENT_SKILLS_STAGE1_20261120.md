# HHBA Candidate Agent + Skills · Stage 1 (2026-11-20)

## Goal and scope

The platform owns the AI models, skill catalog, execution budget and tools.
A candidate submits a resume and expressly consents to the AI search.
The platform performs resume-evidence preparation, employer-directed vacancy discovery and match scoring. The applicant chooses a specific vacancy to run the *existing* PR #405 AI resume rewriting editor; the applicant reviews and downloads an edited DOCX, and opens the employer page to apply personally.

**This patch is an isolated first-stage integration, not a complete production Agent platform.** It deliberately does not install a shell-based agent, execute user-supplied Markdown skills, accept arbitrary URLs from the model, change scoring formulas or submit any applications.

## Implementation

- `functions/_lib/candidate-agent-skills.js`: explicit server-owned catalog with IDs, stages and approval gates. No user-provided tool name is accepted.
- `runCandidateAgentMatch`: guarded tool routing to the existing `runSearchFirstMatch`; validates candidate job links, Mainland workplace, numeric scores and response size. Returns a minimal list of executed skills; never includes resume content in the trace.
- `functions/api/match-native/[[path]].js`: optional integration into the *existing authenticated*, same-origin, consent-checked matching endpoint. Both JSON and SSE paths use the same guarded runner when enabled. Old search flow is unchanged when disabled.
- `CandidateMatchNativeDialog`: show a truthful completed-tool caption only if the backend supplies an Agent trace. User must select a vacancy to open existing targeted resume editor; no automatic apply.
- `resumeMatch.ts`: safe optional Agent metadata in the existing public response contract, with Chinese error messages.
- Contract tests and a dedicated GitHub Actions CI validate flags, explicit approval boundary, rejection of fake URLs/third-party boards/foreign jobs and preservation of existing search behavior.

## Cloudflare Preview configuration

Set these only in the private Preview environment:

```text
HHBA_CANDIDATE_AGENT_ENABLED=1
HHBA_AUTH_ROLLOUT=preview
HHBA_CANDIDATE_AGENT_SKILLS=resume_evidence,official_job_search,fit_scoring,targeted_resume_rewrite
```

The existing `HHBA_MATCH_SERVICE_ENABLED`, `HHBA_MATCH_DEEPSEEK_KEY`, authentication database and user upload/AI consent are still required. Model credentials stay in encrypted Cloudflare secrets and never reach the browser. Missing `HHBA_CANDIDATE_AGENT_SKILLS` means all four known skills; an invalid list fails closed, never triggers unknown tools.

For production the Agent additionally requires BOTH `HHBA_MATCH_RUNTIME_MODE=production` and `HHBA_CANDIDATE_AGENT_PRODUCTION_ALLOWED=1`. The independent PR #405 whole-resume editor and Word renderer keep **their own** stricter production gates; enabling this Agent alone never enables paid editing or Word export.

`GET /api/match-native/status` exposes a read-only **sanitized** catalog (IDs and enabled flags, no keys). For this first stage, the operator configures skills through Cloudflare environment variables, **not** an admin UI or public write API. Admin UI and persisted per-tenant capability policies are future stages and must use admin-only RBAC rather than the applicant session.

## What is real vs what remains

**Real/reused:** resume extraction in the user's browser, explicit upload authorization, existing Search/Fetch and ranking, employer-directed source checks, match history, existing user-selected Word rewriter in PR #405, official outbound link.

**Not done:** durable server-side task queue/checkpoint for the whole multi-step pipeline, per-user Agent skill policy in admin UI, independent evidence extractor for accurate structured CV profile, autonomous model-directed tool selection across *all* skills, integration of PR #357's multi-provider search POC, actual live-production acceptance, or universal format-preserving editing of arbitrary Word files.

**Important:** a job search source label is not proof that a company is hiring; search results still require confirmation on the company's original recruitment page. The 0–100 matching score is **not** the probability of being hired. A new draft can only improve its visible wording, not create qualifications or guarantee higher scores.

## Validation

```sh
cd apps/web
node --test scripts/candidate-agent-skills.contract.test.mjs
node --test scripts/match-search-first.contract.test.mjs scripts/match-native-web.contract.test.mjs
npm ci && npx tsc -b --pretty false
```

The isolated PR targets the pre-existing Word-development branch. Do not merge into `main`, apply database migrations or deploy to `hhba.work` until the appropriate Preview and user-approval tests pass.
