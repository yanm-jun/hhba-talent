# HHBA Phase 2 / P2-1 · Isolated read-only Jobs API gateway

**Status (2026-10-19): development branch only. NOT deployed. NOT wired to the white HHBA front end.**

## Product rule B

- Default recruitment market: only **recently observed positions on an allowed official ATS hosted board** (Greenhouse, Ashby, Lever).
- A recently observed listing is NOT proof that the position accepts applications right now. State remains `RECENTLY_OBSERVED`, `application_confirmed_open=false`.
- Historical `JOB-...` or prior `OPEN` records do **not** automatically enter the active market. The historic source repository remains unchanged.
- Chinese translations are *display metadata*, not proof of employer approval. Full JD, its translation and application eligibility are not represented as approved.
- Domestic records from the existing preview are **intentionally not promoted** until individually validated using appropriate official evidence.
- All company names and URLs are sourced from existing data, not generated examples.

## Files

- `contract.mjs`: source URL validator, canonical job ID, alias preservation, bilingual summary, strict freshness and public visibility rules, stable paging / filtering.
- `server.mjs`: private/local read-only HTTP adapter for one existing upstream; enforces no credential forwarding, pagination consistency, fail-closed behavior and source allowlist.
- `contract.test.mjs` and `http.test.mjs`: synthetic regression tests.
- `package.json`: Node 22+ without third-party runtime dependencies.

## Endpoints

| HTTP | Route | Purpose |
|---|---|---|
| GET | `/recruitment/api/v2/health` | Current isolated snapshot health |
| GET | `/recruitment/api/v2/jobs?q=&company=&city=&remote=&recruitment_type=&limit=&offset=` | Consistent paged index |
| GET | `/recruitment/api/v2/jobs/:id` | Same canonical detail as index |
| GET | `/recruitment/api/v2/jobs/:id/sources` | Public source metadata only |
| GET | `/recruitment/api/v2/jobs/:legacy_id` | Existing green-market ID alias when present |

The public HTML React app still uses **v1**. No frontend, database or source repository was edited in this batch.

## Local verification

```bash
cd apps/jobs-gateway
npm test
# Only if reviewing an existing read-only upstream:
HHBA_ATS_UPSTREAM_URL=https://hhba-web-production-024c.up.railway.app/ npm run start:local
```

The adapter binds **127.0.0.1:8789** by default, not a public host. It is not a deployment specification. The upstream allowlist contains only the two explicitly known HHBA Railway preview domains. Requests are GET-only and do not copy browser cookies, auth headers or resume data.

## Source, ID and translation limitations

- Existing green IDs use `platform-boardSlug-nativeId`; this gateway generates `J_` + deterministic 32-hex SHA-256 using ATS platform + board slug + canonical official URL. Old IDs are aliases only; the ATS native ID is **not guessed** from composite ID.
- Other source formats (`JOB-...`, `ATS-...`, 32-digit hash) remain in the original repositories. Their import, validated alias reconciliation and collision accounting are **not finished**.
- Upstream ATS listings from the green preview are metadata-first. This gateway passes through existing reviewed/unreviewed *title* translations when available; it does not proxy unrestricted JD retrieval or `translate-part`, does not write SQLite caches, and does not disclose third-party JD text.
- Any source board failure, inconsistent pagination, incomplete feed, or snapshot older than 24 hours causes the entire current-market read to fail closed. It will never silently advertise an incomplete snapshot as complete.
- A URL on an allowed ATS host is not by itself verification of company recruitment authorization. `company.identity_verified=false`. Real review provenance and a production publication policy must be added before public rollout.
- No direct user-uploaded resume or talent API connection is made: this is **Phase 2**, not matching.

## Next milestones, NOT yet completed

1. P2-0: obtain/verifiably preserve immutable source snapshots, production function revision, Xiaomi environment data and SQLite title translations without touching production files.
2. P2-2: implement an independently audited historical adapter and approved domestic-current-job adapter; reconcile `JOB-...`, `ATS-...`, green aliases, and cross-source IDs. Audit mismatch records rather than force merges.
3. Validate real pagination, source health, full-collection and status semantics against read-only snapshots of the existing online preview services; no production write.
4. Separate rights-reviewed JD and optional, rate-limited same-origin translation reader behind a reviewed approval policy.
5. Only after tests and owner approval, evaluate switching the white HHBA React site from v1 to v2 in its own staging environment. Railway production preview remains untouched.

**This code is intentionally not production-ready, and no current-position count is claimed.**
