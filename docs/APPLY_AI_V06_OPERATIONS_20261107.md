# HHBA 一键网申 V0.6｜真实 AI 联调验收清单

Status: source PR only. No live API call, deployment, production D1 mutation, payment or AI enablement was performed by this change.

## Where we are
- Model contract checked against https://api-docs.deepseek.com/api/create-chat-completion/ (model deepseek-flash, non-thinking JSON mode). Peak reference prices checked against https://api-docs.deepseek.com/quick_start/pricing/ on 2026-11-07.
- Cloudflare Pages project hhba-talent currently has NO environment variable named HHBA_AI_API_KEY in either preview or production as of the project configuration inspection.
- Only extension key mapping is in scope, not complete autonomous ATS form filling.
- Product UI continues to display **HHBA AI 智能网申**, not the underlying provider name. BEFORE requesting real consent, legal disclosures must truthfully name the data recipient/processor.

## V0.6 implementation
1. Controlled provider call: 10 seconds total, max two attempts (one retried 429/selected 5xx), timeout and invalid JSON fail closed. 401/402/422 never retried.
2. Same privacy boundary: only sanitized low-risk form labels, allowed profile key NAMES and input kind. **No candidate values, passwords, phone, email, CV, login tokens or employer HTML** are given to the provider.
3. Model output is an allowlisted list of {id,key,confidence}; V0.5 browser code rehydrates values locally, and all AI suggestions default unselected.
4. D1 migration 0013 records call count, retries, status, token totals, cached input tokens and an **estimated maximum peak-rate cost** in micro-USD. It does not persist actual prompts, model response bodies, private candidate details or the API Key.
5. Server account quota 3/hour, temporary all-user cap 100/day UTC; fixed labels and server error codes only.
6. Account-only GET /api/apply/ai/status checks readiness without revealing the secret; GET /api/apply/ai/usage returns that account's sanitized daily counts and usage numbers.
7. No payment order, paid-credit consumption, auto-submit or browser extension host permission is changed.

## Owner-only configuration (after preview review and official privacy disclosure)
Use Cloudflare Dashboard -> Workers & Pages -> hhba-talent -> Settings -> Variables and Secrets (for the appropriate environment).
Never send an API Key to chat, GitHub, CI logs or a browser extension.

- Add **HHBA_AI_API_KEY** as an encrypted Secret in a restricted PREVIEW environment only, not public build args.
- Verify the preview D1 binding HHBA_PNVS_AUTH_DB and BACK UP before applying the additive migration 0013. Its predecessor migration 0011 must already be applied. Do not accidentally bind preview to the production D1.
- Verify the stable, audited Chrome/Edge extension ID and auth connection, including HHBA_APPLY_EXTENSION_ID and HHBA_APPLY_PAIRING_PEPPER as secret.
- HHBA_APPLY_PAIRING_ENABLED=1
- HHBA_APPLY_AI_ENABLED=1
- HHBA_APPLY_EXTENSION_AI_ENABLED=1
- HHBA_AI_DISCLOSURE_APPROVED=1 ONLY after final, accurate user data/processor disclosure and acceptance.
- Ensure the merchant payment and credit settlement feature switches remain OFF throughout these AI-only tests.

### Integration verification after keys/consent exist
Use ONE synthetic recruitment form with fake profile values, ordinary non-sensitive labels, and a single explicitly consented plugin session. Observe:
- account pairing cannot read website session or cross-account usage;
- GET /ai/status ready=true and /ai/usage shows a new, single request;
- DeepSeek JSON output yields only allowlisted field keys, no resume values;
- any suggestions remain unchecked until the tester explicitly selects and fills;
- incorrect/ambiguous labels are declined, existing fields and CAPTCHA untouched;
- provider 401 / insufficient balance / timeouts show safe Chinese errors;
- prompt/output usage and upper-bound costs are present in D1;
- no real fee, paid credit deduction or external form submission occurred.

### Offline review commands
From apps/web:
  node --test scripts/apply-ai-v05.contract.test.mjs scripts/apply-ai-v06.contract.test.mjs
  python3 scripts/apply_credits_schema_test.py
  npm run build

This task does **not** activate the key or flag, does not claim actual billable model requests were made, and does not authorize production go-live.
