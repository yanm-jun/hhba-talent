# HHBA Global Hiring Marketplace · 30 Official ATS Boards (2026-10-18)

## Scope
The public Railway pilot expands from **6** to **30** verified board identifiers: six previously deployed plus 24 additions. All newly added identifiers passed `probe_official_boards.mjs` on 2026-10-18: live native JSON board endpoint, well-formed official job URLs, matching identifiers, and official JD evidence. Source verification logs: https://github.com/yanm-jun/hhba-talent/actions/runs/39093360220.

New Greenhouse boards: Figma, Anduril, Discord, Reddit, Airtable, Flexport, Robinhood, GitLab, Twilio, Cloudflare, Vercel, Gusto, Wise, Coursera.

New Ashby boards: OpenAI, Notion, Ramp, Linear, Perplexity, ElevenLabs, Vanta, Harvey, Headway.

New Lever board: Binance.

## Integrity and staging
- `boards` is the canonical allowlisted board registry. New source names are not trusted unless native ATS results contain an official URL and source-matching job ID.
- Six simultaneous ATS connections per sync rather than unbounded parallel requests. Keep requests low-frequency (10-minute listing cache); one JD read only upon user view, same source-job identity.
- Chinese translated titles are initially terminology-backed pending machine-translation cache warmup. **Do not claim all newly imported positions are naturally translated.**
- No new public republication rights implied by an open ATS API. JD reading remains user-initiated translation with the existing constrained live reader.
- These are overseas positions; no assertion that they sponsor work visas or accept applicants from China.
- Count visible jobs only from `/api/jobs` after production deploy; provider preflight counts may change and duplicate URLs are deduplicated.
- Trial architecture remains a Railway Bun Function; full enterprise React deployment is separate.

## Acceptance
Run `HHBA Mobile Web Real JD Translation E2E`, `HHBA live JD reader source check`, and `HHBA official all jobs full audit` after deployment. The 30-board smoke must verify `boards === 30`, `failures === 0` (or transparently report unavailable boards), and official source detail on all enabled boards.

Next scale objective: translate/cache metadata more efficiently and migrate discovery/cache to a database-backed worker so that the service doesn't reload many large ATS boards on each 10-minute cache expiry.
