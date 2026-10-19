# HHBA V0.4-01 — Unified same-origin local staging

**Goal:** Keep HHBA's one React website with exactly two entrance choices, followed by the real-data recruitment market. The two private backends remain independently operated: HHBA talent (identity/resumes/employers) and HHBA recruitment (official-source historical jobs). This is an isolated, **loopback-only** integration exercise, NOT public deployment.

## Topology

```text
Browser http://127.0.0.1:8088
  ├─ GET /, /candidate, /recruiter/register, /candidate/jobs ... -> apps/web/dist
  ├─ /api/v1/* -> 127.0.0.1:8003 existing talent API
  │     retains existing session cookie and X-CSRF-Token (no bypass)
  └─ GET /recruitment/api/v1/marketplace, jobs, jobs/{id}, stats
       -> 127.0.0.1:8765 recruitment engine
       forced GET/HEAD; strips Cookie, Authorization, CSRF, Origin, Referer
       **never routes /ops or /api/v1/review**
```

## Run both real backends (separate local checkouts)

Do not confuse the two repositories. Both are private and each has its own feature branches; neither is automatically deployed from a PR.

- Start talent API `hhba-talent/apps/api` on **127.0.0.1:8003**, with its existing private database and appropriate migrations. Do not use synthetic fixtures with real user accounts.
- Start recruitment API in **`hhba-recruitment-engine`**, branch `feat/v01-job-search-preview`, on **127.0.0.1:8765**:

```powershell
py scripts/serve_jobs_api.py --master data/jobs_master.jsonl --host 127.0.0.1 --port 8765
```

- In `hhba-talent/apps/web`, execute `npm ci` and `npm run build`.
- From `hhba-talent` project root, start:

```powershell
py scripts/run_staging_gateway.py --host 127.0.0.1 --port 8088 --talent http://127.0.0.1:8003 --recruitment http://127.0.0.1:8765
```

Visit `http://127.0.0.1:8088/`: “我要应聘”, “我要招人” at top, **recruitment market underneath**; click to candidate jobs, historical detail, and recruiter auth. Failure of either upstream is explicit; no sample jobs are injected. Candidate/resume PII must NEVER be shared with recruitment API.

## Testing

```powershell
py -m unittest discover -s scripts -p test_staging_gateway.py -v
```

CI additionally builds the actual React app and runs **real Chromium** against this gateway, with deterministic synthetic upstreams. In CI screenshots and browser tests any positions are **explicitly synthetic**, and must not be presented as real recruiting. Real-market evidence comes separately from the recruitment repo's own 3,545-record historical master and its origin-verification tests.

Production is **not yet deployed**. The local Python gateway does not provide TLS, infrastructure auth, durable monitoring, persistent secrets management, or public ingress security. It refuses network binds other than 127.0.0.1. Do not expose `/ops` or `/api/v1/review` through a future public reverse proxy.

## Verifiable launch gates

1. Frontend compiles with `npm ci && npm run build`.
2. Gateway integration: safe static deep links, talent CSRF/session cookies retained, recruitment credentials stripped and only public read routes forwarded.
3. Actual Chromium: opens homepage two roles and market, recruiter register, candidate area, search and detail on mobile and desktop.
4. Both **real** services exercised locally (separately checked out private repos) against official-source historical data before staging sign-off.
5. At least one real current official job-level title/detail/apply entrance observed, independently reviewed, before a job may be marketed **currently open**. No such production admission is claimed by this integration test.

## V0.4-03｜准确的官方岗位投递直达

首页的招聘市场和应聘端岗位卡已经根据招聘 API 的三个状态显示不同操作：

- `VERIFIED_DIRECT` 且 `current_application_verified=true`、`application_url` 是合规 HTTPS 地址：**去官方投递 ↗**。职位卡标题也直达同一个企业官方**具体岗位**的申请入口，默认新窗口并带 `noopener noreferrer`。
- 只有 `OFFICIAL_DETAIL_ONLY`：显示**官网核对 · 投递未确认 ↗**，没有“立即投递”误导。
- `UNAVAILABLE`：不展示官网跳转按钮，也不拼造首页或详情 URL。

新后端 `hhba-recruitment-engine/hhba_pipeline/apply_links.py` 默认不允许任何岗位被认定 `VERIFIED_DIRECT`；必须由仓库外的逐岗浏览器证据、截图 SHA、原始职位身份匹配、72 小时内观察和人工批准共同支持，且证据变化时自动撤销展示。必须通过独立外部 `--apply-registry` 参数启用。

**当前真实主库仍没有已经取得本轮申请按钮证据的正式开放岗位**。CI 的直接投递链接测试仅使用明确标注为合成的 `example.org` fixture；不代表“小米济南销售”或任何实际企业岗位已核验。上线前必须由真人逐岗审核真实证据并保护审批文件访问权限，保持“打开官网投递”而非 HHBA 自动提交简历。
