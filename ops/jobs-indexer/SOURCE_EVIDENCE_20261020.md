# HHBA ATS source expansion candidate evidence — 2026-10-20

The 43 entries in boards.json are **configured source candidates**, not 43 authenticated connections or verified in-stock employer vacancies.

New official-host board observations:
- Sierra — https://jobs.ashbyhq.com/sierra/ (Ashby). An individual official role page was discoverable at https://jobs.ashbyhq.com/sierra/26d1f737-94a6-497e-a672-93f4f652fca7/ .
- Monzo — https://job-boards.greenhouse.io/monzo (Greenhouse). The public board displayed job listings at the time of observation.
- Duolingo University Recruitment — https://job-boards.greenhouse.io/duolingounirecruitment (Greenhouse). This is a **university recruitment** board, not the whole Duolingo career inventory.

Verification required before counting these as active:
1. Runtime retrieves successful live JSON from the matching native ATS endpoint.
2. Every result has a valid source ID and source-matched official per-job URL.
3. The /api/boards endpoint reports ok:true and a nonzero job count for that source; zero means an empty verified board, not verified open vacancies.
4. Sampling opens representative official job links and checks their status.
5. Source failure never appears as a fresh default job; previous observations appear only in the separate stale archive for at most 24 hours.

No claimed vacancy totals or approval to ingest private systems are implied by this registry update.
