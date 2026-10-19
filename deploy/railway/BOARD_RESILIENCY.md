# HHBA board outage resiliency (2026-10-18)

Observed failure after adding Cognition, Replit, PostHog, ClickUp to reach 34 boards: Anduril's 2,536-job Greenhouse source timed out on a 12-second read, and the first aggregate sync returned 5,215 jobs, 33/34 successful boards, down from 7,522 with 30 boards. This is a **source timeout**, not evidence that those roles were removed.

Changes:
- Allow 30s timeout for the verified high-volume Anduril board; 19s for other boards.
- Retry a board once only for a transient network fault, HTTP 429 or HTTP 5xx, with bounded backoff.
- Keep strict native ATS JSON, original URL, and job ID checks; do not count an invalid/empty response as a healthy board when it contained candidate rows.
- Failures shorten overall listing cache TTL to 60 seconds instead of 10 minutes, so healthy boards aren't stuck missing for ten minutes.
- Never invent slots or reuse stale data as verified current openings. The frontend reports failures transparently.

Deploy acceptance requires real Railway logs of 34/34 successful board reads and new total, plus a browser check for Anduril, Cognition, Replit, PostHog and ClickUp. React production deployment remains separate.
