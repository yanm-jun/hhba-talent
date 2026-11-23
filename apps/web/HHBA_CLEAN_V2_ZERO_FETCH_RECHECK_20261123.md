# Clean V2 zero-Fetch recheck (isolated preview)

This branch is based on merged main `908b331` and exists only to validate Search-result recall with the approved fixed synthetic résumé. It must never activate public production matching.

The previous live preview returned 0/10 jobs, 16 successful Search requests, zero Fetch attempts, and insufficient source diagnostics. The new test distinguishes raw Search hits from official detail URL candidates and explains rejection causes. It runs a bounded second wave of searches targeting six supported official employer detail-page patterns, while preserving exact JD proof checks and server-side synthetic QA quotas.

Acceptance still requires actual authorized login and a user-triggered request. Mocked CI success is not real Search-result evidence.
