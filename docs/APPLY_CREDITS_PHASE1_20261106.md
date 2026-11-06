# HHBA 一键网申：次数购买与支付 Phase 1 (2026-11-06)

## Delivered in the feature branch
- Reuses four-card workbench PR #270 and old browser-extension recovery PR #257, without changing main.
- Click the fourth card to view the product, video placeholder, prices, usage ledger, orders, and disclosed limitations.
- Packages: 10 uses = ¥3; 20 = ¥6; 50 = ¥15; 100 = ¥30. Always ¥0.30 / use. Service usage counts are not cash or transferable balances.
- The AI provider is not named in marketing UI. Before remote processing is enabled, separately and accurately disclose processors and data use in the privacy policy.
- Browser cannot invent paid balance or label a payment successful.

## Database (not yet deployed)
Run d1/0009_apply_credits_orders.sql on HHBA_PNVS_AUTH_DB after backup and preview verification.
The existing login and real candidate data is preserved. No seeded fake users or paid orders.
Paid orders are the source of purchased credits; tasks are the source of reserved and consumed credits.

purchased = SUM(uses WHERE orders.status = paid)
consumed = COUNT(tasks.status = completed)
reserved = COUNT(tasks.status = reserved)
available = purchased - consumed - reserved

Paid-order granting is an idempotent conditional transition, requiring a verified Alipay notification, matched merchant ID, app ID, order ID, amount and transaction ID.
There is no public grant-money/mark-paid endpoint.

## API
GET /api/apply/config: public availability and canonical package prices.
GET /api/apply/wallet: authenticated own balance.
GET /api/apply/orders and /tasks: authenticated own records.
GET /api/apply/orders/:uuid: authenticated own order only.
POST /api/apply/orders: disabled unless explicitly enabled, same-origin verified session, computed price; precreate order using Alipay.
POST /api/apply/alipay/notify: raw form POST, RSA2 signature verification and conditional pending-to-paid, returns plain-text success on accepted payment.
POST /api/apply/tasks/reserve: deliberately refuses while agent handshake and settlement are not built.

Cloudflare Secrets (never put values into Git):
ALIPAY_APP_ID
ALIPAY_SELLER_ID
ALIPAY_PRIVATE_KEY_PKCS8 (merchant PKCS#8 PEM)
ALIPAY_PUBLIC_KEY (Alipay-provided SPKI PEM)
HHBA_ALIPAY_NOTIFY_URL = https://hhba.work/api/apply/alipay/notify
HHBA_APPLY_PAYMENTS_ENABLED = 1 (explicit final release switch)

Even after new orders are switched off, valid callback notifications for existing orders must still be processed.

## Required work before taking live money
1. Confirm Alipay F2F merchant eligibility for a fully online digital service, not just limit figures.
2. Onsite local QR drawing is included (MIT-licensed Project Nayuki QR generator, license in the vendored TypeScript header). Validate real-world scan behavior, then implement gateway query/reconciliation, cancelled/expired orders, refund and chargeback process.
3. Test authentic merchant private key, Alipay public key, callbacks, payment-retry and replay behaviors with real sandbox or controlled small transactions.
4. Review price/usage/refund/expiry disclosure, consumer legal obligations and the AI processor privacy notice.
5. Back up and migrate D1 in preview, run verified browser tests, then review production migration.
6. Roll out only after authorized owner explicitly sets flags. This commit does not activate payment.

## AI and browser plugin
Legacy V0.2 is a manual-confirmed assistant, not fully automated AI form completion.
No private resumes are forwarded to AI by this phase and no automatic submission is claimed.
Never activate task usage until the browser-to-server authentication handshake, successful-fill evidence, reservation, technical-failure release, exactly-once settlement, and supported ATS adapters are verified.
User handles CAPTCHA, declarations, attachments where needed, and final submission.

## QA and rollout
Focused CI includes a payment signature test, fixed pricing tests, SQLite D1 constraints, front-end contract and TypeScript/Vite build. This is a draft-PR change; do not silently merge into main or deploy to hhba.work before acceptance.

## Task quota core (internal, not enabled)
An atomic SQLite INSERT-SELECT reserves a paid use only when one is available. The task ID is globally unique, so retries cannot reserve twice. A conditional update transitions reserved into completed (consumed) or released (returned) at most once. The browser receives no direct settlement interface. Before deployment, implement a trusted internal producer and audited task-expiration recovery.

## Phase 2: payment recovery, cancellation and refund requests
Official Alipay transaction services support alipay.trade.query, alipay.trade.close and alipay.trade.refund.
The product now includes a signed gateway response verifier; user-initiated query checks the order, merchant, amount, trade ID and status, then conditionally settles pending -> paid/closed. The UI can query and cancel a pending order. Closing requires provider query before and after close; a provider timeout never proves cancellation, and no pending order is closed on an unknown precreate response.
Refund requests are persisted separately from the payment and credit ledger; no real refunds or credit removal occur until a complete reconciled admin refund workflow is reviewed. True provider refund, refund-query, accounting and customer support remain prerequisites before payment go-live.

## Phase 2: AI mapping prototype (no real-user activation)
Server prototype is explicitly gated by HHBA_APPLY_AI_ENABLED=1, HHBA_AI_DISCLOSURE_APPROVED=1 and a Cloudflare Secret HHBA_AI_API_KEY. A valid candidate bearer and same-origin request plus explicit per-request consent are required. AI sees field labels + permitted profile KEY NAMES only; it does not see their values. The server maps high-confidence model key choices back to caller-owned profile values; sensitive, consent, identity and unknown fields are rejected. Models cannot invent resume answers. Rate-limit 3 calls per real user per hour, only audit timestamps, never raw resumes.
Service remains disabled and is not connected to the extension; a secure browser-to-site pairing mechanism and actual AI privacy disclosure/consent must be reviewed first.

## Phase 3: browser-to-HHBA limited account pairing
Migration: d1/0012_apply_extension_pairing.sql (NOT applied to production).
Feature flag and secrets (defaults OFF):
- HHBA_APPLY_PAIRING_ENABLED=1 (only after full security QA)
- HHBA_APPLY_EXTENSION_ID: exact 32-letter Chromium extension ID from a stable, reviewed extension install
- HHBA_APPLY_PAIRING_PEPPER: long random secret >=32 chars

Account website: authenticated same-origin POST /api/apply/pair/start creates a random 12-char (60-bit) code, hashed with pepper in D1, TTL 5 minutes and max 3 codes/hour; POST /api/apply/pair/revoke revokes outstanding codes and all sessions.
Extension: explicit optional host permission for only hhba.work; requests use Origin matching exact configured Chrome extension ID. The claim is rate-limited using a salted IP hash, and a consumed code cannot be exchanged twice. A separate 12-hour randomly generated token is stored only hashed on the server and in chrome.storage.session locally.
GET /api/apply/extension/wallet is READ-ONLY and account-scoped. POST /api/apply/extension/disconnect revokes only this plugin token.
No extension endpoint grants credits, spends credits, signs in to HHBA website, uploads a resume, or runs an AI request.
Pairing is not hardware attestation; a compromised device/session can leak a bearer token. Do not enable payment mutation or irreversible side effects using this read-only token. Third-party browser extensions are not trusted; verify exact ID and release process.

## Synthetic ATS safety tests
V0.4 reuses standard input/textarea/select matching but detects custom combobox controls (Ant Design, Element UI, Arco, Semi, ByteDance-like classes), refuses to write their underlying text input, and reports manual work. CI Chromium test uses only an authored synthetic fixture, never a live enterprise recruiting site. Real ATS adaptation requires explicit authorization and independent acceptance.

## Phase 4/V0.5: AI-assisted field matching, pre-key dry-run
**Still OFF in production**. The extension and Cloudflare handler now have a narrow optional `/api/apply/extension/ai/map` boundary authenticated by the separate short-lived extension session; origin must match the configured extension ID.
The browser sends only candidate profile **field keys** (no values), unfilled non-sensitive HTML field **labels/kinds** and a one-request explicit AI consent boolean. The server rejects unknown JSON properties, oversized inputs, accidental personal values, sensitive labels and low-confidence model results. Only `{id,key,confidence}` is returned; the plugin rehydrates the actual value **locally**, applies existing profile-field and DOM safety restrictions, and always leaves suggestions **unchecked** pending the user's confirmation.
The model is instructed to treat all web labels as untrusted data. Prompt injection in a recruitment webpage never grants spending, form submission or access to secrets.
A single scoped database INSERT limits each account to three AI field mapping requests per rolling hour. Only the time and account identifier are stored, not raw labels or resume text.

**Required for real AI activation later**: candidate explicit consent, a completed accurate third-party processor/privacy notice, reviewed stable extension ID and pairing infrastructure, Cloudflare Secrets for `HHBA_AI_API_KEY`, and separate environment opt-ins `HHBA_APPLY_AI_ENABLED=1`, `HHBA_AI_DISCLOSURE_APPROVED=1`, `HHBA_APPLY_EXTENSION_AI_ENABLED=1`. Never paste the key into a chat, GitHub branch or plugin.
Model config validated against official DeepSeek 2026 API docs: `deepseek-flash`, non-thinking mode, JSON output. In the plugin user interface only HHBA AI branding appears; processor name must be given in formal privacy disclosure before go-live. Live inference cannot run without merchant-provided credentials.
The prior paid-credit settlement path remains deliberately unconnected. V0.5 is AI FIELD IDENTIFICATION, not end-to-end web application or billed completed task.


## V0.6 — authenticated DeepSeek Flash inference prelaunch

Scope: refine the existing Cloudflare Pages Function /api/apply/extension/ai/map. Do not rebuild the site, replace Cloudflare, or activate billing.

### Verified provider contract
- Official DeepSeek API: POST https://api.deepseek.com/chat/completions
- Model: deepseek-flash, thinking.type=disabled, response_format.type=json_object, max_tokens=500, no streaming.
- Source: https://api-docs.deepseek.com/api/create-chat-completion/
- The server accepts only an explicit per-request consent, the exact allowlisted Chrome extension origin and a separate short-lived extension token.
- Only field labels and permitted local profile KEY NAMES travel to the model. Names, contact details, full CVs, website credentials and values stay on the user's device.
- The response includes only vetted {id,key,confidence}. The browser rehydrates values locally and requires checkbox confirmation. No automatic submit, no billing use consumed.

### Error policy
- One short retry on HTTP 429/5xx (maximum two attempts) with a shared 10-second timeout. No retry of 400/401/402/422, network ambiguity or timeout.
- Never surface raw model errors (which might include the user's input or secret). Keep http status and safe fixed error codes only.
- Fail closed on invalid JSON, truncated output, untrusted model keys or unapproved fields.
- Absent API key and flags -> return unavailable; do not attempt a live call.

### D1 AI cost audit
- Additive migration: apps/web/d1/0013_apply_ai_usage_audit.sql (not applied to production).
- Store user account key, request ID, status, model, attempts, token usage, duration and sanitized error code; never persist prompts, response bodies or CV data.
- Per-user hourly quota: 3; initial absolute global cap: 100 per UTC day. Enforced atomically at request reservation.
- Estimated upper-bound *USD microdollars*, NOT actual billed expense. Based on published peak reference rates for Flash (2026-11-07): cache-miss input $0.30/1M, cache-hit input $0.006/1M, output $1.20/1M; update dynamically if DeepSeek changes pricing, and use actual provider invoices for accounting.
- A 200-token prompt with 50 cached tokens plus 40 generated tokens: approx 94 microdollars (under the peak-rate estimator).
- Browser gets no cost/usage metadata from provider beyond accepted matches; candidate dashboard may show own summaries.

### Cloudflare deployment prerequisites
Cloudflare Pages project hhba-talent was inspected on 2026-11-07. Neither preview nor production has the HHBA_AI_API_KEY variable name configured at this point. It must be added by the owner as a **Secret** for a restricted TEST/preview environment, not pasted into chat or committed to GitHub.

Other existing guarded flags:
- HHBA_APPLY_PAIRING_ENABLED=1
- HHBA_APPLY_EXTENSION_ID=<stable reviewed Chrome extension id>
- HHBA_APPLY_PAIRING_PEPPER=<long private secret>
- HHBA_APPLY_AI_ENABLED=1
- HHBA_AI_DISCLOSURE_APPROVED=1 only after the privacy policy accurately identifies the external processor and data categories
- HHBA_APPLY_EXTENSION_AI_ENABLED=1
- HHBA_AI_API_KEY=<secret only>

The only live integration test will be an authorized synthetic request from the restricted browser connection. A real provider call, D1 migration or source-code deployment must not be claimed complete before verified.
