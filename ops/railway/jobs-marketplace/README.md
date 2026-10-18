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


## Verified deployment — 2026-10-18

- **Railway Function size limit is 96 KiB.** The first proposed source was 99,640 bytes, which prevented a new working build despite successful mutation responses. Removed standalone comments, retaining all code and ATS records. Final source is **96,052 UTF-8 bytes**.
- **Production deployment ID:** `64c7dc64-77d1-4118-85c0-de497d9fd595`, `SUCCESS`. Live source read-back matched the compact version.
- **Source loading:** 9,040 job records, 36 healthy ATS boards, zero board failures. The previous source loaded 8,795 records from 34 ATS boards.
- **Live HTTP self-tests:** OpenAI 813, Tencent 19, Xiaomi 1,010, Cursor 133, Mercor 112; all five returned HTTP 200 with expected company and positive job count.
- **Homepage self-test:** 30 server-rendered job cards, no employer-directory replacement, client script syntactically valid and employer-name mapping present.
- **GitHub Actions runner caveat:** The private-repo workflow failed before executing any steps; the job steps array was empty and GitHub job logs returned `BlobNotFound`. Retrying the run also failed without test steps. Do not present GitHub Actions as passing. Inspect the repo's Actions runtime availability, policy and billing settings separately.
- **Future expansion:** Do not continue growing a monolithic Railway Function near its source-size ceiling. Move the board registry and server to a normal repo-based deploy or externally managed data configuration before large-scale expansion.
