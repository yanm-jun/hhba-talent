# HHBA live official-JD preview (Railway Function)

This file mirrors the **running** production preview Bun Function
`hhba-live-jobs-preview` at
https://hhba-live-jobs-preview-production.up.railway.app/.

It is **not** the canonical React HHBA website; the proper app's frontend
is in `apps/web/`. The preview tests the product flow:

Official ATS listing -> HHBA `/jobs/<ATS-job-id>` original JD -> official
company application page.

Platform behavior:
- Greenhouse: GET exact public posting by ID; render `content`.
- Lever: GET exact posting; assemble description, lists and additional.
- Ashby: GET published job board, select exact job ID; render description.
- Preserve source sections and sanitize externally supplied HTML.
- Reject changed job title/URL, missing posting, or off-board links.
- Public metadata listing refreshed every 10 minutes on demand. This is an
  **in-memory preview** and not a durable full production job index.
- No resumes, employer account creation, or application form processing.

Deployment requires the Railway account and the HHBA preview Function;
updates to this file alone do NOT redeploy the Railway Function. Use Railway
`update_function_source_code` with the entire contents of
`live_jobs_preview.ts`.

**Publication rights note:** Public API readability does not itself grant
rights to republish all original employer JD content. This public pilot
needs a separate source-level rights review before expanding beyond
limited testing. The canonical engine implements independent approval
in `hhba_pipeline/global_ats_public_jd.py`.

The startup diagnostics log only counts, success booleans and lengths.
No job description is logged.
