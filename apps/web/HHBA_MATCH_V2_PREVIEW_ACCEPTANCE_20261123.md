# HHBA Clean Match V2 — isolated provider acceptance preview

Preview branch: `feat/clean-v2-provider-acceptance-20261123` (based on production commit `e110256`).
This branch exists only to trigger an isolated Cloudflare Pages preview deployment with the same Clean V2 backend as production.

## Gate contract

- Production `HHBA_MATCH_CLEAN_V2_ENABLED` must remain **unset/off**.
- Preview `HHBA_MATCH_V2_PREFLIGHT_ENABLED=1` permits **only** authenticated candidate `GET /api/match-next/provider-check`; it must not unlock `POST /api/match-next/resume`.
- The preflight tests DeepSeek balance, Search, Responses JSON and Fetch against public test content without sharing any résumé or user URL.
- A successful preflight is not proof that real jobs can be found or that Word optimization is fully verified.

## Release checklist

- [ ] Preview deployment success, correct commit and preview-bound environment.
- [ ] `GET /api/match-next/status` reports `enabled:false`, `preflight_available:true`.
- [ ] Without a valid candidate session, the preflight returns `SESSION_INVALID` and makes no provider calls.
- [ ] Authorized candidate preflight succeeds for actual provider Search/Fetch/Responses or reports a precise error.
- [ ] Multiple synthetic (not personal) résumé-to-JD tests confirm recall, reasons and no made-up official URLs.
- [ ] Official JD verified archive and Word editing acceptance verified separately.
- [ ] Only then evaluate enabling production Clean V2.

No keys or candidate bearer tokens belong in GitHub issues, logs, commits or ChatGPT.
