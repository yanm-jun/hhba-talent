# HHBA cloud apply: Phase 1 research and execution gates

Date: 2026-11-07
Source branch: main at ef2fa2730e4ea6ffa9d9ecceb2e8a62ac97b2fbb

## Public behavior sources and limitations

- Craft Anything https://github.com/storytold/craft-anything : README documents Clean Room, Deep, site study, rebuild, comparison, CLI and MCP. It is labeled early alpha. Its CLI was **not installed or run** here: no cargo runtime and no direct network clone path. No private site internals were obtained.
- Jinliqiuzhi public pages https://jinliqiuzhi.com/ and https://jinliqiuzhi.com/auto-apply describe cloud browser sessions, resume reuse, task lists, multi-task flows, user intervention and employer receipt checks. These are self-reported product descriptions, **not third-party evidence** that the closed service actually works. No authenticated application dashboard was accessed.
- HHBA main has an experimental Edge browser extension, a private R2 resume storage path, and a prepaid credits/orders foundation. Earlier HHBA implementation documents expressly say real ATS compatibility, paid billing activation and AI processing are not yet completed.

## Feature plan and acceptance gates

| Priority | Feature | Verification gate |
|---|---|---|
| P0 | Deterministic resume field mapping | Only known, confirmed facts are filled |
| P0 | Local Chromium browser controller | A real browser reads back all six synthetic fields; no form submitted |
| P0 | Cloudflare Browser Run CDP | Equivalent isolated cloud test after explicit environment validation |
| P0 | Human review and intervention | Only owner can view/intervene; CAPTCHA, login and missing profile data pause |
| P0 | User approval before irreversible actions | Upload, consent and final submit never occur automatically |
| P1 | Durable task state + retry | Idempotent job transitions survive browser disconnects |
| P1 | Employer proof capture | Verify a matching employer receipt or mark result unverified |
| P1 | Real ATS adapter matrix | Authorized samples from Feishu recruitment, Moka, Beisen; no compatibility claims before tests |
| P2 | Multiple independent tasks + credits | Isolation, spend limit and exactly-once settlement |
| P2 | UI / production deployment | Preview acceptance and security review before main merge |

## Current actual implementation

Experimental code under experiments/cloud-apply contains Node22 CDP controller, in-browser scanner, readback writer, safe mapping/state logic, synthetic form and tests. It runs only against about:blank injected with a fictional form and has no connection to production accounts.

Observed tests: 3/3 core unit tests passed. A Chromium CDP test on synthetic browser DOM verified 6 known fields, skipped 4 restricted/manual fields and left submission false. This is **not** a cloud-browser test and does **not** prove real job-site integration.

## Production design and unresolved risks

- Cloudflare Browser Run: validate plan limits, session timeouts, live-view user control, isolated browser contexts, data transfer and reachable domains before adopting.
- China recruitment sites: Cloudflare exit region, bot policies and login flows may require a separate containerized browser runner. Do not evade website authentication or CAPTCHA.
- All user-provided destination URLs and redirects need strict SSRF / private-IP checks; isolate origin storage and session cookies for each user.
- No recording of passwords/OTP. Sensitive session data encrypted, access-logged, retained briefly and deleted appropriately.
- Explicit resume processing/third-party disclosure and per-user permissions. Do not infer that R2 storage consent permits model processing or employer submission.
- Existing Apply Credits and Alipay draft do not establish verified settlement; do not enable charging before testing and consent.

Next: evaluate Cloudflare Browser Run connection from a non-production environment, repeat the synthetic field test, then conduct one authorized ATS form audit. No main deployment without user acceptance.
