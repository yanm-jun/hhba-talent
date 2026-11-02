# HHBA Cloudflare 6 real metrics · 2026-11-02
## Source and scope
1. Public displayable jobs: GET /api/metrics/public reads the exact same-origin data/jobs.json and data/job-sync-status.json; excludes invalid/withdrawn statuses; stale >24h withheld. This measures *recruitment records*, not contracts, candidates or paid customers.
2. ATS sources and audit coverage: counts from same official audit; reports audited full JD and source failures.
3. Website PV: visitor expressly opts in via existing banner, browser GPC/DNT honored; daily HMAC pseudo-identifier with a 1-minute per-event dedupe; no IP, raw URL, email, search query or CV logged to D1. Does not measure all traffic.
4. Saved jobs: only anonymized per-device saved relationship in D1; cannot be interpreted as registered users or cross-device user collections. Does not import or claim historical Railway counts.
5. Registered users: **not connected** until trusted production auth database is integrated; never show test/preview D1 accounts as registered users.
6. DAU/MAU: **not connected** until trusted session activity with individual registered account ID is integrated; never use device UV as substitute.

## Implementation
- Pages Functions in apps/web/functions, with HHBA_METRICS_DB D1 and secret HHBA_METRICS_SECRET (at least 32 chars) independently bound in **preview**.
- D1 migration apps/web/d1/0003_cloudflare_metrics.sql.
- **Only original** `/preview-admin/` navigation/cards/workbench is used: existing dashboard.js reads GET /api/metrics/public and GET /api/admin/metrics via a shape adapter. Do NOT create another dashboard. Custom 1–90-day interval and D1 bookmark add/remove event counts preserve the old UI. Public metrics can render without credentials; *private* metrics require a signed Cloudflare Access JWT validated by RS256/JWKS + issuer + audience + allowlisted email.
- To enable private metrics later, set only server-side HHBA_ACCESS_TEAM_DOMAIN (e.g. team.cloudflareaccess.com), HHBA_ACCESS_AUD, HHBA_METRICS_ADMIN_EMAIL, add Cloudflare Access policy protecting the /admin-metrics/* and /api/admin/metrics endpoints. **No shared admin password or public aggregate backdoor.**
- A browser showing — for missing/unauthorized metrics is intentional, not a zero. The separate /admin-metrics/ page from the first draft was removed. GitHub Pages stays a public read-only static preview.
- First deploy to an isolated preview D1. To deploy production, create a new, separate production D1; do not reuse the preview database or auth preview database. Configure Access first. Explicit approval required before merging main.

## Safety and limitations
- No Railway dependency in these Cloudflare API paths.
- No real Gmail/email registration required for 1–4. Production account-derived 5–6 remain deferred until domain approval and verified identity.
- No retroactive traffic numbers. Only events after the D1 collector is running can appear.
- Protect/approve privacy notice, retention and data deletion before broadly enabling production collection.
