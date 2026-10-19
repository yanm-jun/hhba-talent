# HHBA Private Resume Matching API

The **platform administrator** configures one `DEEPSEEK_API_KEY` on this Railway backend; job seekers **never** enter or see it.

- Only consented in-memory PDF/DOCX resume extraction; redacted text is sent to DeepSeek; no raw uploads or candidate data is saved by this service.
- The candidate must check the extracted claims and match explanations. The AI does not invent employers, job links, academic qualifications, or job availability.
- Ground matches only in verified Greenhouse/Ashby/Lever position metadata and official JD audit fields from HHBA's existing public snapshot.
- Per-client and global quotas plus concurrency guards apply. This is a limited **anonymous trial** until HHBA's real candidate authentication is deployed; IP quotas are not full user accounts. Stronger production protection (verified sessions and/or anti-bot challenge) is required before broad release.
- Uploads are **not** auto-applied to employers and never appear in talent search, candidate profiles or logs.

## Railway admin configuration

Set `DEEPSEEK_API_KEY` on **this backend only** via Railway Variables. Do not enter it in the frontend, in source code or ChatGPT. Set `HHBA_ALLOWED_ORIGINS=https://yanm-jun.github.io` (default). `HHBA_DAILY_REQUEST_BUDGET=60`, `HHBA_PER_CLIENT_DAILY_LIMIT=2`, `HHBA_MAX_CONCURRENT=2`, `HHBA_DEEPSEEK_MAX_TOKENS=1600` can be adjusted by the owner. `DEEPSEEK_API_KEY` is not mandatory for a cold healthcheck, but without it `/api/v1/match/resume` returns `503 ADMIN_AI_NOT_CONFIGURED` before accepting or processing files.

## Privacy

Applicants must explicitly check consent before sending the **redacted extracted text to DeepSeek**, a third-party provider. This transfer is separate from HHBA's original private resume storage, which is not modified. Automated redaction is best effort and may not remove every identifier; applicants should upload a redacted copy if needed. Only public non-sensitive official ATS metadata is fetched. Provider processing is subject to its published data policies; HHBA should publish a privacy notice and retention details before production launch.

## API

- `GET /health`: readiness (no credentials or personal information).
- `POST /api/v1/match/resume`: multipart `file` PDF/DOCX, `consent=true`, optional `country`, `remote_only`, `role_hint`, `limit`. Response includes verified profile and candidate match reasons. Admin owns the API key.

No per-user API keys; no server-side resume persistence; no background tasks; no direct employer submissions.
