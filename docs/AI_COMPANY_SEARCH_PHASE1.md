# HHBA AI 企业匹配 · Phase 1 (isolated preview)

## Scope
- Use existing React/Vite frontend; two modes: AI enterprise matching, unchanged legacy job search.
- **AI recommends candidate enterprises, not positions.** User-provided background is optional to store: this preview stores nothing.
- Candidate pool is limited to bundled human-reviewed company profiles, with at most 40 sent per request.
- AI returns only company ids; the frontend resolves ids to local reviewed records, not hallucinated company names.
- Current hiring / degrees / experience thresholds cannot be asserted from editorial profiles.
- No vector database, new paid database, company API contracts, or Railway production deployment.

## Development
```bash
cd apps/web && npm ci && npm run build
python -m unittest discover -s apps/company-match-api -p 'test_*.py' -v
python apps/company-match-api/server.py
```

Environment variables on a **non-production** API instance, never in browser or GitHub:
```env
HHBA_COMPANY_MATCH_ENABLED=0
DEEPSEEK_API_KEY=
HHBA_COMPANY_MATCH_ALLOWED_ORIGINS=http://127.0.0.1:5173
HHBA_COMPANY_MATCH_DAILY_LIMIT=30
PORT=8080
```
Frontend build variable: `VITE_HHBA_COMPANY_MATCH_API_ORIGIN` (full https origin in deployed preview; localhost http is not supported by current production URL validation).

## Safety and launch gates
1. Never set ENABLED=1 without budget, legal/privacy review, persistent global rate limiting, user/session-level throttling and abuse controls. Current in-memory daily limit protects only **one process** and resets after restart; it is **not** a billing hard cap.
2. Verify the DeepSeek account's available model id and JSON-output support before enabling, or update `MODEL` accordingly.
3. Only reviewed company descriptions and known company routes may appear in results. Frontend-provided candidate metadata is **untrusted** and must be validated against a server-side allowlist or signed version of the editorial catalog before a public launch.
4. The prompt and company records must never be logged; keys must be server-side.
5. Confirm actual Railway source repo/branch/service before any merge or deployment. Production remains untouched.
6. Consent is required, and the third-party transmission is disclosed. Data minimization, retention and cross-border processing need review before public enabling.
7. For current job availability, always follow the official hiring site; no guarantees.
