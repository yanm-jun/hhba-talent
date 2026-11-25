# HHBA Cloud Apply: isolated experiment

Status: **local Chromium CDP proof of concept, not a production cloud-apply service**.

Independent HHBA implementation. All profile data in this prototype is fictional. There is no payment, API key, resume upload, employer-site access or automatic submission. Craft Anything is a separate research and comparison tool, not the browser executor; this delivery does not claim to have run Craft Anything.

## Test commands

- Node.js 22+ required
- Chromium installed as 'chromium' (otherwise set CHROMIUM_PATH)
- Run 'node --test tests/core.test.mjs'
- Run 'node src/run-local.mjs'

The browser smoke test writes an embedded synthetic form into an isolated about:blank Chromium session over local Chrome DevTools Protocol. It makes no external page navigation. The implementation only fills precisely matched, non-sensitive blank fields, dispatches change events and reads values back. It must end at 'review' with 'submitted: false'.

Validated by author on Node 22 + Chromium in an isolated environment on 2026-11-07: 3/3 core tests; 6/6 known fields read back; 10 scanned fields, 4 skipped, no submit.

## Not ready for production

1. Local Chromium does not equal Cloudflare Browser Run. Production integration, account isolation, cost/timeout and country access are unverified.
2. Do not expose Chrome DevTools endpoint or '--remote-allow-origins=*' to any network, user or public service. This local-only flag is not a production security pattern.
3. Real ATS sites need authorized, site-specific adapter tests, iframe handling, dropdowns, multi-step flows and user-visible browser control.
4. Unknown, sensitive, consent and CAPTCHA fields require user involvement. Final submission must require explicit approval and verified employer receipt.
5. Integrate with existing HHBA authenticated resume store and credits only after server authorization, privacy review and exactly-once billing.
6. Do not use the experiment to attempt to bypass target-site security mechanisms or access restrictions.

See docs/PHASE1_RESEARCH.md for evidence and next gate.
