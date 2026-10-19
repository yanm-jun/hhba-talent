# HHBA Private Resume Matching API

The **platform administrator** configures one `DEEPSEEK_API_KEY` on this Railway backend; job seekers **never** enter or see it.

- Only consented transient PDF/DOCX processing; redacted text is sent to DeepSeek. Multipart input might temporarily spool to ephemeral disk, but original documents are not persisted on the private Railway volume or in candidate databases.
- The candidate must check the extracted claims and match explanations. The AI does not invent employers, job links, academic qualifications, or job availability.
- Ground matches only in verified Greenhouse/Ashby/Lever position metadata and official JD audit fields from HHBA's existing public snapshot.
- Per-client and global quotas plus concurrency guards apply. This is a limited **anonymous trial** until HHBA's real candidate authentication is deployed; IP quotas are not full user accounts. Stronger production protection (verified sessions and/or anti-bot challenge) is required before broad release.
- Uploads are **not** auto-applied to employers and never appear in talent search, candidate profiles or logs.

## Railway admin configuration

The **owner** sets `DEEPSEEK_API_KEY` exactly once on this backend using Railway Variables. Job seekers never provide a key. Place the service in its own Railway process with repository root directory `/apps/resume-match-api` and attach a private SQLite usage-quota volume at `/sync-state`. Configure `HHBA_MATCH_PUBLIC_ENABLED=1` only after the private volume exists; all other platform options can be set by the operator: `HHBA_ALLOWED_ORIGINS=https://yanm-jun.github.io`, `HHBA_DAILY_REQUEST_BUDGET=60`, `HHBA_PER_CLIENT_DAILY_LIMIT=2`, `HHBA_MAX_CONCURRENT=2`, `HHBA_DEEPSEEK_MAX_TOKENS=1600`. Before the key, explicit enablement or persistent quota is available, `/api/v1/match/resume` safely fails closed. The front-end must only contain the **public service URL** under `VITE_HHBA_MATCH_API_ORIGIN`, never a DeepSeek token. The intended workflow remains a single shared platform key, not user-specific keys.

## Privacy

Applicants must explicitly check consent before sending the **redacted extracted text to DeepSeek**, a third-party provider. This transfer is separate from HHBA's original private resume storage, which is not modified. Automated redaction is best effort and may not remove every identifier; applicants should upload a redacted copy if needed. Only public non-sensitive official ATS metadata is fetched. Provider processing is subject to its published data policies; HHBA should publish a privacy notice and retention details before production launch.

## API

- `GET /health`: readiness and public-enabled status (no credentials or personal information).
- `GET /api/v1/match/status`: whether the operator has enabled the private-quota-backed service.
- `POST /api/v1/match/resume`: multipart `file` PDF/DOCX, `consent=true`, optional `country`, `remote_only`, `role_hint`, `limit`. Response includes verified profile and candidate match reasons. Admin owns the API key.

No per-user API keys; no server-side resume persistence; no background tasks; no direct employer submissions.
The global daily usage budget is recorded in the SQLite file on `/sync-state` and survives container restarts. The API remains disabled by default and the owner must explicitly opt in to enable the paid public pilot. One platform-owned key is shared on the backend, never handed out to users.


If Railway reports an account-level service provision limit, do not overwrite an existing market or translation service. Wait for the owner to authorize freeing an unused slot or expanding the Railway plan.
