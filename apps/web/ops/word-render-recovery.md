# Word PDF durable recovery
Deploy `apps/web/ops/word-render-recovery-worker.mjs` as a private scheduled Worker (not Pages).
Use a one-minute Cron Trigger. Bind the same private D1 and R2 used by the Pages
Word API, plus the existing Word renderer endpoint and shared secret and the
same Word account-hash pepper. Set the existing renderer rollout variables so
`configured(env)` is true, and set `HHBA_WORD_RENDER_RECOVERY_ENABLED=1`.
Apply D1 migration 0103 before enabling. No public route, documents, or user
identifiers are emitted by the Worker logs. The Worker reclaims only stale
pending/running rows; explicit layout failures remain retryable by the user.
Keep existing DOCX/ZIP/PDF resource and integrity protections. No paid-plan
upgrade is required by this code; verify actual account availability/usage before
deployment. If the Worker is not deployed, Pages waitUntil alone is not a
durable background execution guarantee.
