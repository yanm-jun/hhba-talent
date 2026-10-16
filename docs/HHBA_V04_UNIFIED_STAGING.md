# HHBA V0.4-01 — Unified same-origin local staging

**Goal:** Keep HHBA's one React website with exactly two entrance choices, followed by the real-data recruitment market. The two private backends remain independently operated: HHBA talent (identity/resumes/employers) and HHBA recruitment (official-source historical jobs). This is an isolated, **loopback-only** integration exercise, NOT public deployment.

## Topology

```text
Browser http://127.0.0.1:8088
  ├─ GET /, /candidate, /recruiter/register, /candidate/jobs ... -> apps/web/dist
  ├─ /api/v1/* -> 127.0.0.1:8003 existing talent API
  │     retains existing session cookie and X-CSRF-Token (no bypass)
  └─ GET /recruitment/api/v1/marketplace, jobs, jobs/{id}, stats
       -> 127.0.0.1:8765 recruitment engine
       forced GET/HEAD; strips Cookie, Authorization, CSRF, Origin, Referer
       **never routes /ops or /api/v1/review**
```

## Run both real backends (separate local checkouts)

Do not confuse the two repositories. Both are private and each has its own feature branches; neither is automatically deployed from a PR.

- Start talent API `hhba-talent/apps/api` on **127.0.0.1:8003**, with its existing private database and appropriate migrations. Do not use synthetic fixtures with real user accounts.
- Start recruitment API in **`hhba-recruitment-engine`**, branch `feat/v01-job-search-preview`, on **127.0.0.1:8765**:

```powershell
py scripts/serve_jobs_api.py --master data/jobs_master.jsonl --host 127.0.0.1 --port 8765
```

- In `hhba-talent/apps/web`, execute `npm ci` and `npm run build`.
- From `hhba-talent` project root, start:

```powershell
py scripts/run_staging_gateway.py --host 127.0.0.1 --port 8088 --talent http://127.0.0.1:8003 --recruitment http://127.0.0.1:8765
```

Visit `http://127.0.0.1:8088/`: “我要应聘”, “我要招人” at top, **recruitment market underneath**; click to candidate jobs, historical detail, and recruiter auth. Failure of either upstream is explicit; no sample jobs are injected. Candidate/resume PII must NEVER be shared with recruitment API.

## Testing

```powershell
py -m unittest discover -s scripts -p test_staging_gateway.py -v
```

CI additionally builds the actual React app and runs **real Chromium** against this gateway, with deterministic synthetic upstreams. In CI screenshots and browser tests any positions are **explicitly synthetic**, and must not be presented as real recruiting. Real-market evidence comes separately from the recruitment repo's own 3,545-record historical master and its origin-verification tests.

Production is **not yet deployed**. The local Python gateway does not provide TLS, infrastructure auth, durable monitoring, persistent secrets management, or public ingress security. It refuses network binds other than 127.0.0.1. Do not expose `/ops` or `/api/v1/review` through a future public reverse proxy.

## Verifiable launch gates

1. Frontend compiles with `npm ci && npm run build`.
2. Gateway integration: safe static deep links, talent CSRF/session cookies retained, recruitment credentials stripped and only public read routes forwarded.
3. Actual Chromium: opens homepage two roles and market, recruiter register, candidate area, search and detail on mobile and desktop.
4. Both **real** services exercised locally (separately checked out private repos) against official-source historical data before staging sign-off.
5. At least one real current official job-level title/detail/apply entrance observed, independently reviewed, before a job may be marketed **currently open**. No such production admission is claimed by this integration test.
