# HHBA employer/candidate accounts — Railway migration gate (2026-10-20)

The **working implementation** of the Phase 5 backend was recovered from
`feat/phase5-candidate-applications-20261020` into this isolated development branch.
It is **not deployed** to the public `hhba-web` recruitment-only Railway service.

## Why it must remain disabled in the public frontend for now

- The existing `hhba-web` image runs **Bun ATS/JD APIs** and has no Python ASGI account server.
- The recovered FastAPI code uses PostgreSQL via `DATABASE_URL`, Alembic migrations,
  private file upload roots, application roles, CSRF-protected sessions and recruitment review.
- There is no confirmed production PostgreSQL database, persistent private-document store,
  migration execution history or authenticated API currently attached to this Railway project.
- Its current CORS origin allowlist only covers local development and must be adjusted narrowly
  to `https://hhba-web-production-024c.up.railway.app` before production.
- `apps/api/Dockerfile` starts `app.docling_worker` (the resume worker), **not** the HTTP
  API. The HTTP service needs its own verified start command and health check.
- Browser account APIs **must not** be switched on until a production-safe HTTPS API exists.
  They deliberately fail closed now.

## Release gates

1. Provision durable PostgreSQL; review backup, migrations and rollback before touching user data.
2. Provision private uploads (not public `/data/*.json` or the translation volume).
3. Build the Python HTTP API separately from the worker, test Postgres-backed auth,
   org verification, consents, job posting, cross-org isolation and withdrawal.
4. Configure CSRF session cookies / SameSite / origin allowlist for the final Railway hostname.
5. Only then enable `VITE_HHBA_ACCOUNT_API_ENABLED=1` and point the white frontend
   to the authenticated `/api/v1` service. Keep the public ATS read APIs separate.

All test users and records must be synthetic. Never expose resumes, verification
documents, private contact fields, credentials or tokens in CI or public source snapshots.
