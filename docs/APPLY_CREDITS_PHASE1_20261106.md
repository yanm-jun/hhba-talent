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
