# HHBA 34 verified ATS boards — second expansion
Date: 2026-10-18

The 30-board pilot is already deployed and sampled at 7,522 live postings, with zero board fetch failures in the latest Railway snapshot.

Next four source boards all returned native public Ashby API listings with official links and full JD data during the independent 93-source validation:
- Cognition (`ashby/cognition`), 103 at probe time
- Replit (`ashby/replit`), 65 at probe time
- PostHog (`ashby/posthog`), 10 at probe time
- ClickUp (`ashby/clickup`), 51 at probe time

Counts are preflight snapshots, not guaranteed current production totals. Never infer work authorization, salaries, or qualification requirements from the brand or job count.

Safety and performance: allowlisted fixed board slugs, six in-flight listing fetches, 10-minute list cache, official URL and job identity verification before details, private machine translator with bounded daily title processing. Platform filters and the Chinese/English UI apply automatically.

The next engineering task is to run all-board coverage audits with explicit checks on translation readiness, authentic JDs and links, mobile rendering, and rolling source availability. Do not claim 34 live before real production sync confirms it.
