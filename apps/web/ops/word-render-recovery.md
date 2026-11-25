# Word PDF durable recovery

The standalone private Worker `apps/web/ops/word-render-recovery-worker.mjs`
uses a one-minute Cron Trigger and a separate randomly generated 256-bit
`HHBA_WORD_RECOVERY_TOKEN` secret. Store the same secret in Pages production
and the scheduler Worker. Do not commit or log it. The scheduler does not need
D1/R2 bindings or the renderer's shared secret: the authenticated fixed-action
Pages route reuses the current production renderer and account-hash secrets.

Apply migration 0103, deploy the updated Pages API, and then enable
`HHBA_WORD_RENDER_RECOVERY_ENABLED=1` on both services. Disable the scheduler's
workers.dev and preview URLs. It calls only the fixed recovery endpoint with a
dedicated token, and the endpoint returns aggregate counts, never candidate
data or credentials. Each invocation reclaims one stale task to bound runtime;
successive invocations work through the backlog. The task lease protects
concurrent invocations. Explicit layout failures remain retryable by users.

No paid-plan upgrade or rotation of existing credentials is required. Verify
production health, actual free-plan usage, authenticated recovery and a
synthetic render before declaring the feature live.
