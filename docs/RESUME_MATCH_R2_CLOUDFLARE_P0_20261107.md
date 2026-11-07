# HHBA AI Resume Matching — R2 + Cloudflare P0 (2026-11-07)

Review-only branch: `feature/resume-r2-cloudflare-match-p0-20261107`. No main merge or production deployment.

## Completed in source
- Keep existing `/candidate/match` page. Signed-in candidate can choose one of their saved, privately owned PDF/DOCX files from R2 without re-upload. One-off files remain supported.
- Browser fetches the selected file under the existing real-auth bearer token and runs audited first-party local DOCX/PDF.js text extraction. Original PDF/DOCX bytes never go to the AI matching API.
- Separate consent before sending up to 20,000 characters of extracted text to the same-origin Pages API. User may preview and edit the locally redacted text; once reviewed, an empty or invalid edit blocks submission and never falls back to the original document. Server additionally redacts contacts; sanitization is best effort, not comprehensive.
- Cloudflare Pages Functions use the existing PNVS session, validate candidate role and stored resume ownership, enforce a 100 KB limit even on chunked uploads, then call DeepSeek using a server-only secret. Every inferred degree, skill and work tenure requires explicit source evidence; otherwise it is omitted.
- Results use only the recently built `/data/jobs.json`, same-version `/data/job-sync-status.json` and exact-JD-hash-matching `/data/job-search-facets.json`. ATS links and snapshot freshness are checked. Ranking is relevance, not success probability; real application availability must be verified at the employer website.
- Independent D1 migration `apps/web/d1/0017_resume_match_usage.sql`; atomic budget reservation 2 requests per account per UTC day, 60 globally. Stores only opaque account hash with secret pepper, date and random request ID. No resume text or AI outputs in D1. No tie to prepaid credits.

## Production-safe default
Everything remains off unless `HHBA_MATCH_SERVICE_ENABLED=1`, `HHBA_MATCH_DEEPSEEK_KEY` and `HHBA_MATCH_LIMIT_PEPPER` (>=24 chars) are **all** provided as Cloudflare secrets and migration is present. Key values must never be VITE variables or committed to Git. The plugin's separate AI key should not silently be reused.

## Preview acceptance sequence
1. Verify review CI and frontend build.
2. **Done:** Preview D1 and R2 bindings are independent from Production. Preview D1 `hhba-pnvs-auth-staging-20261103` has a Time Travel recovery bookmark; migration 0017 was applied and verified (one table, two indexes). Production D1 remains untouched.
3. In Preview only, configure two new purpose-specific secrets and explicit service switch after privacy, retention, third-party AI and cross-border data review.
4. Run synthetic candidate end-to-end tests with mock documents and a real Preview Pages deployment; verify no raw private information in D1/logs and correct job auditing behavior.
5. Only after approval plan separate production migration, secrets, controlled pilot and deploy.

Still incomplete: external online job discovery, comprehensive Chinese domestic jobs matching, live hiring status guarantee, PDF OCR, browser compatibility acceptance, real paid DeepSeek invocation.
