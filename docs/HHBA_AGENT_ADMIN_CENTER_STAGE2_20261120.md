# HHBA Admin Agent & Skills Center · Stage 2 (2026-11-20)

## Source
This is based on the existing password-only admin PR #340, NOT main. Its separate Cloudflare Pages project remains `hhba-admin-console` with domain `admin.hhba.work`. No duplicated administrator login system.

## Implemented
- Sidebar entry `AI 求职 Agent` shows **four fixed, server-approved Skills**. The owner can pause/enable Agent permission and toggle optional targeted rewriting.
- Admin-only `GET/POST /admin-preview/api/candidate-agent` checks the existing encrypted admin password session; POST also requires exact same Origin, JSON and dedicated request header.
- Changes use D1 compare-and-swap revisions and an **atomic audit entry** to avoid lost updates; unknown skill IDs, duplicate IDs and missing required matching skills are rejected.
- Real anonymized execution outcomes can be loaded **manually** (to save D1 reads); there are no fictional stats.
- No API keys are returned, edited, uploaded or stored through the UI. It is not a plugin installation or arbitrary code-execution endpoint.
- The Agent is additionally guarded by the candidate runtime's Cloudflare master flags, so toggling the admin checkbox does not bypass production protections.
- No applicant data, resume, user identifiers, URLs or prompt strings in the run/audit tables.
- Separate build scripts include new static assets only in protected password-admin output.

## Database / deployment
Migration `apps/web/d1/0031_candidate_agent_policy.sql` MUST be applied to the **candidate auth D1** `HHBA_PNVS_AUTH_DB` in the *matching target environment*, not finance DB or standalone admin password credential DB. It exists in the companion candidate Agent PR with exactly the same content. Do not apply twice or to the wrong database.
The admin project must bind the same corresponding candidate D1 (Preview -> Preview and Production -> Production). Separate domain/CORS origins are irrelevant: admin API writes only to shared D1; candidate runtime reads it via its own same-origin functions. No cross-origin browser request from admin site to hhba.work.
No secrets or production flags were changed. This PR should not be deployed to admin.hhba.work until both PR bases and companion candidate runtime have passed Preview acceptance.

## Verify
```sh
cd apps/web
node --experimental-sqlite --test scripts/candidate-agent-policy.contract.test.mjs scripts/admin-agent-skills.api.test.mjs
CF_PAGES_BRANCH=feature/admin-agent-skills-center-stage2-20261120 python3 scripts/build-standalone-admin.py
```

## Not yet delivered
- Full long-lived Agent queue/retry/resume for all Skills, independent per-user agent jobs, or real-world accuracy benchmarks.
- Multi-provider official JD engine #357 integration.
- Word renderer production service; original DOCX cannot be universally guaranteed pixel-identical after rewrite.
