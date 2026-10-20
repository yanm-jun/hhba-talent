# HHBA Precomputed Bilingual JD — rollout and safety

- Original English JD is fetched from the vetted public ATS endpoint by a background worker and bound to its SHA-256.
- Verified machine-translated Chinese sections are retained separately in the *existing private Railway /sync-state volume*, never in GitHub Pages public job-search snapshots.
- A GET /api/jobs/:id/ready-jd returns English + Chinese in one response only when **all** segments match the current source hash and are unexpired. Incomplete Chinese returns null, never fabricated text.
- The white client never calls /translate-part during user navigation. If no precomputed document is ready, the normal verified English JD API remains the fallback; the translated version is prepared in the background.
- Six chosen real official OpenAI/Anthropic/SpaceX IDs receive first queue priority; the existing 180-chunk/day budget remains, not raised automatically. Full translations require time to prewarm.
- The same SHA source update removes old parts; missing or withdrawn listings are not returned.
- Private cache has bounded TTL and is not exported as a bulk downloadable data snapshot. Check original JD usage rights/terms before expanding public content mirroring.
- No additional cloud instance, volume, account API, or paid service is required.

Acceptance: Bun SQLite tests, white UI contracts, TypeScript build, Railway image build, then live status and 202 vs 200 integration proof.
