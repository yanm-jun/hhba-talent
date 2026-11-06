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
