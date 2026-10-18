# HHBA Jobs Indexer v0.1 — staging only

Independent, repo-built recruitment indexer. This is **not** the production HHBA market and does not replace or merge the existing domestic historical job observations.

## Why
The production Railway Bun Function hit its **96 KiB single-file limit**. This service splits official ATS sources, normalization, refresh state, API and UI into separate files and deploys as a conventional Node container.

## Contents
- `boards.json`: 36 existing configured ATS boards plus 4 new cross-industry candidates
- `catalog.mjs`: native public Greenhouse, Lever and Ashby JSON GET, strict official job URL validation
- `store.mjs`: bounded parallel refresh (5), 15-minute refresh interval, per-source health, 24-hour maximum retained in-process stale cache, URL deduplication
- `server.mjs`: HTTP endpoints and safe pagination
- `page.mjs`, `app.js`: Chinese-first independent preview page, company/favicon, official position links and retry UI
- `test/catalog.test.mjs`: offline regression tests

## API
- `GET /health` checks HTTP runtime, source counts and freshness; `GET /ready` returns 503 until a nonempty snapshot exists
- `GET /api/boards` reports **configured** sources and each source's actual result
- `GET /api/jobs/page?q=...&company=...&remote=true&limit=30&offset=0`
- `GET /api/jobs/:id` gives an individual normalized record (no copyrighted full JD)
- `GET /` is the staging preview
- Jobs use `status=fresh|stale`, `observedAt` and validated official application links. A configured board is not counted as successful until live JSON returns a valid result.

## Cross-industry candidates (not counted as deployed yet)
Form Energy (battery manufacturing), ShopBack (retail/commerce), AlphaSights Campus Recruiting (professional services), General Robotics (robotics). These were selected from discoverable official public recruiting pages, but actual ATS API fetching and non-zero job counts need Railway execution before acceptance.

## Start and test
From `ops/jobs-indexer`: `npm test`, then `npm start`. Node 22+; no third-party runtime packages. Docker build: `docker build -f Dockerfile.prod .`.

## Railway deployment (do NOT modify the current live service)
1. Use the **existing HHBA GitHub repository**, branch `feat/jobs-indexer-service-20261018`.
2. Create an **additional staging service**. Set Root Directory `ops/jobs-indexer`, Dockerfile `Dockerfile.prod`, healthcheck `/health`. Enable deployment from that branch. Use `railway.json` from that root directory.
3. Do **not** mount or copy the old service's production `/data` SQLite volume or inject the Xiaomi historical-list environment chunks. They remain with the old service.
4. Confirm `/ready` = 200, `/api/boards` source status, `/api/jobs/page?q=OpenAI`, and a specific position `/api/jobs/:id`. Verify links resolve to actual official job pages.
5. Benchmark startup and periodic refresh, page through >60 jobs, simulate a failed board, then test retry/stale visibility.
6. Only after these tests, plan a feature parity migration: Chinese titles, existing domestic official records and permissioned JD viewer. **Do not switch the existing HHBA URL until these have passed.**

## Current provisioning blocker
Railway returned `Free plan resource provision limit exceeded. Please upgrade to provision more resources!` when creating the staging service. Therefore this repo branch has **not** been deployed as a new service. Do not replace the live HHBA service or the translation service to bypass the quota. The live original remains healthy at its existing URL.

## Caveats
- The refreshed snapshot is in process memory, not a durable database. A process restart requires a fresh sync.
- A source that returns zero jobs is valid; a failed/invalid source is not a verified success.
- The staging preview shows official original-language job titles. The bilingual feature and original domestic listings belong to the current production app and need an explicit migration.
- Site/app security is by an official host+board slug allowlist, not by trust in arbitrary third-party URLs. No website scraping, application submission or resume collection.
