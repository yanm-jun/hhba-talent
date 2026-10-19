# HHBA Public Recruitment MVP — Railway deployment

Service A: **hhba-jobs-api** (private network only) from repository
`yanm-jun/hhba-recruitment-engine`, branch `feat/global-ats-public-apis-20261017`.
Its root `Dockerfile` exposes port 8765. Set `PORT=8765`.
Do not generate a public domain for this API.

Service B: **hhba-web** (public website) from repository `yanm-jun/hhba-talent`,
branch `feat/dual-entry-recruitment-integration`.
Select the repository root `Dockerfile`. Set `PORT=8080` and:
`HHBA_RECRUITMENT_API_URL=http://hhba-jobs-api.railway.internal:8765`.
These must be in the SAME Railway project and environment. Then generate a
public HTTPS domain for service `hhba-web` only.

The web server proxies ONLY read-only recruitment GET endpoints. It never
forwards browser cookies or bearer tokens. Account APIs return explicit 401/503
until the actual authenticated HHBA product backend is separately deployed.
Do not tell users that resume uploads, recruiter accounts or automatic
applications are available in this **recruitment browsing MVP**.

Critical: the bundled source records are historical, and overseas ATS metadata
needs the persistent source-reviewed SQLite volume on the API service before
it can be shown publicly. The website must not substitute fake jobs if the
private API is unavailable; `/health` becomes 503 in that case.

Railway no longer allows new services to opt into legacy railway.json config
(as of 2026-10). Use these root Dockerfiles and configure service settings
through Railway UI/app. The hosting account owner must connect the private
GitHub repos and generate the domain; commits alone don't publish a website.

Verified production setup docs: https://docs.railway.com/networking/domains/working-with-domains

CI smoke test for proxy: `node --test deploy/railway/web.test.mjs`.
