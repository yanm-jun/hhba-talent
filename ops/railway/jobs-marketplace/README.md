# HHBA Jobs Marketplace – Railway Function

This source is a **versioned snapshot and proposed expansion** of the separate Railway Function `hhba-live-jobs-preview`, not the `apps/web` service. The Railway Function is hosted independently of this repository. A GitHub commit or PR does **not** deploy the service by itself.

## Scope of the change
- Preserve the original 34 configured global ATS boards and existing Chinese official job records.
- Add **Cursor** and **Mercor** using the public Ashby JSON job-board API (no page scraping).
- Preserve per-job official URLs and existing `urlOK` validation.
- Keep jobs as first-class search results; do not replace the listing with a company directory.
- Make API failures visible rather than leaving a stale, misleading result list.
- Add startup keyword checks for OpenAI, 腾讯, 小米, Cursor and Mercor. Actual checks must pass on the running service.

## Deploy and verify (manual/controlled)
1. Obtain the running Railway Function's source and verify that no unrelated edits were made.
2. Deploy the **complete** `index.tsx` as a Railway Bun Function to the intended production environment, leaving environment variables and persistent translation volume untouched.
3. Confirm Railway deployment state is `SUCCESS`, read back `get_function_source_code`, and confirm that the deployed source contains both new ATS boards and the retry control.
4. Inspect `HHBA_SOURCE_SYNC`, `HHBA_HOME_LIST_RESTORED`, `HHBA_DOMESTIC_SEARCH_SELFTEST`, and `HHBA_SEARCH_KEYWORD_E2E`. Both new brands must report nonzero verified official job entries. A source failure must not be reported as a successful addition.
5. Exercise homepage / API search / detail link: OpenAI, 腾讯, 小米, Cursor, Mercor; test filters and clicking official applications.
6. If checks fail, restore the previous Railway Function source. Never delete the older data or replace job cards with employer links.

## Data caveats
The existing Xiaomi records are a historical official-list snapshot, not independently verified currently open roles. The additional Ashby feeds are candidate live sources until the deployment logs show successful refresh. The upstream job-board APIs can change; unverified or unreachable sources must be recorded as failures.

## Developer test
`node --test ops/railway/jobs-marketplace/source.test.mjs` verifies invariants and change presence without requiring private Railway environment variables. It is **not** a replacement for deployed HTTP and user-interface acceptance tests.
