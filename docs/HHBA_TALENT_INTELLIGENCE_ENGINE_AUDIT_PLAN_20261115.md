# HHBA Talent Intelligence Engine V1 — Audit & Technical Plan

- Date: 2026-11-15
- Repository: `yanm-jun/hhba-talent`
- Base: `main`
- Working branch: `feature/talent-intelligence-search-v1-20261115`
- Status: Phase 1 audit and technical selection; no production code changed and no deployment performed.

## 1. Product objective

Build a reusable, all-user talent and job discovery engine for mainland-China opportunities.

The system must discover specific, current job postings across the open web, read the actual job details, prove the recruiting source is official or officially authorized, evaluate the fit against a normalized candidate profile, and return traceable evidence plus the direct official application URL.

The existing enterprise directory and 17 industry libraries are **not** the search boundary and will not be required for a search to run. They are left untouched. The new engine begins with open-web discovery. Any future use of existing source records is optional enrichment/cache only, never a whitelist gate.

Non-negotiable rules:
- Do not surface BOSS Zhipin, Zhaopin, Liepin, or other third-party job-board postings as final recommendations.
- A third-party ATS vendor may be accepted only when the employer's official site or another authoritative employer-controlled source links to the exact ATS tenant/job.
- Never invent a company, job title, salary, location, hiring status, qualification, or application URL.
- Never call a job "currently hiring" unless the page provides current evidence. Otherwise label the status as unconfirmed.
- Do not bypass login, CAPTCHA, access controls, or anti-bot restrictions.
- Search providers receive normalized job/skill queries, not the raw resume or personal contact details.
- Preserve explicit user consent for resume analysis and external AI processing.

## 2. Current production path audit

### 2.1 Active user flow

The current candidate matching page uses:

`apps/web/src/pages/CandidateMatchPage.tsx`
→ `apps/web/src/services/resumeMatch.ts`
→ `POST /api/match-native/resume`
→ `apps/web/functions/api/match-native/[[path]].js`
→ `runSearchFirstMatch()` in `apps/web/functions/_lib/deepseek-search-match.js`.

The active route is therefore the Search-first native flow, not the older structured `/api/match/resume` route.

### 2.2 Active search limitations found in code

The active `deepseek-search-match.js` path currently:
- Uses DeepSeek Search/Fetch as its only independent search provider.
- Builds a small number of search directions using hard-coded role/keyword rules; the primary plan is capped at four queries.
- Requests up to 20 results per query, then caps the retained candidate pool.
- Uses a small supplemental search pass (up to two more queries) primarily when the visible result count is below the requested limit.
- Caps the first-stage candidate pool at 28 and the model candidate set at 32.
- Fetches only a small subset of candidate pages (up to eight in the current path), with short per-page timeouts.
- Does not run further search waves merely because the top results are low quality if the result count is already filled.
- Relies on heuristic domain/path classification for employer-directed sources. A careers-looking hostname or URL path is not proof of employer ownership.
- Does not independently verify every returned company/title/location/salary field against page-level evidence before the result is shown.
- Lets the model produce the primary match score; the deterministic, inspectable ranking module is not wired into this active route.

This explains why simply increasing the prompt length or changing the model is unlikely to solve the problem.

### 2.3 Additional legacy constraints discovered

The older `domestic-search-fetch.js` path is not a general open-web discovery engine:
- Its `OFFICIAL` locator map contains only four fixed employers/domains: Tencent, Huawei, Meituan, and JD.
- The default path is capped at two Search calls and three Fetch calls; the expanded path is capped at four Search calls and eight Fetch calls.
- `safeOfficialJobLocator` accepts a small set of employer-specific URL paths and ID formats, so unknown companies cannot pass this legacy verifier even if their official job pages are found.
- `domestic-match-fusion.js` uses that same fixed locator as a gate for external jobs.

The existing `resume-role-evidence.js` also contains a hard-coded list of roughly 29 career directions and returns at most six. This is a useful safety baseline for known examples, but it is not a universal career ontology and cannot be the final career-expansion engine for all occupations.

The new design must replace fixed employer and fixed occupation catalogs with dynamic evidence-based discovery:
- accept a newly discovered employer when official-domain/ATS evidence is proven;
- allow new occupations and role families when the resume contains verifiable responsibility evidence;
- require exact resume evidence snippets for each proposed career direction, rather than relying only on a hard-coded regex catalog;
- preserve strict source, Mainland location, qualification, and professional-credential gates.

### 2.4 Existing code worth reusing

The repository already contains useful components:
- `match-ranking.js`: deterministic, provider-independent ranking with fixed baseline weights (role 30, skills 30, experience 20, education 10, location 10). It explicitly requires authenticated official job provenance before ranking.
- `domestic-match-fusion.js`: a structured fusion path that expects independently fetched official job details and uses the deterministic ranking module.
- `domestic-search-fetch.js`: an official-source discovery/fetch implementation and safe job locator checks.
- Existing resume redaction, explicit consent, candidate session checks, match history, and D1/R2 storage infrastructure.

These should be audited and reused where appropriate rather than replaced wholesale. Reuse candidates include deterministic hard-gate/score components, Mainland location checks, resume redaction, credential checks, bounded parsing and audit patterns. Do **not** reuse the fixed four-employer locator map or the fixed 29-role career catalog as universal constraints.

### 2.5 Competing/legacy routes

The repository also contains:
- A standalone `/api/match/discover` preview endpoint whose response explicitly says it is not integrated into Top 10.
- An older structured `/api/match/resume` path that has profile extraction, external discovery, and fusion logic.
- A separate active `/api/match-native/resume` path used by the current candidate page.

The new work must converge these capabilities into one authoritative search-and-ranking pipeline. It must not leave a better discovery path disconnected from the user-facing page.

### 2.6 Historical V8 experiment

The branch `feature/match-v8-deepseek-dynamic-official-discovery-20261108` was inspected as prior research, not as a merge candidate.

It is substantially diverged from current `main` (254 commits ahead / 154 behind at comparison time). Its dynamic DeepSeek agent used a bounded tool loop (roughly 4 model responses, 8 searches, 20 fetches) and had multiple real test rounds. The recorded seventh-to-ninth live rounds produced zero independently verified official jobs; an earlier round also recorded a false positive where recruitment-site navigation text was mistaken for employer identity. Browser rendering was tested, but did not by itself establish successful job verification.

Conclusion: do not merge this branch wholesale and do not repeat the same single-provider agent loop. Reuse its learnings and selected isolated components only after current-main compatibility review.

## 3. New target architecture

### 3.1 Candidate profile and career graph

Parse each resume once (unless the user updates it) into a versioned structured profile:
- education and credential evidence
- experience timeline and seniority
- measurable achievements and projects
- hard skills, soft skills, management and operational capabilities
- industries and business contexts
- location/work-mode constraints
- direct target roles, adjacent roles, and transferable capability clusters

Generate a career graph from evidence, not only from resume job-title strings. Search directions are divided into:
1. Direct roles: same function and similar job family.
2. Adjacent roles: related responsibilities or operating model.
3. Transferable roles: other industries where the candidate's proven capabilities apply.

The user should not need to type target job keywords to make search work. The UI may let the user edit AI-generated directions, but they are optional suggestions, not a prerequisite. Career directions must be dynamically generated from the candidate's evidence and validated by exact source excerpts, so new or uncommon occupations are not blocked by a static list of 29 roles.

### 3.2 Search orchestration

Implement a central search planner and task queue. Agents are logical responsibilities, not six independent expensive model calls by default.

Responsibilities:
- profile/career-intent planner
- query expansion planner
- multi-provider search adapters
- candidate merger and deduplicator
- page extraction workers
- employer/source verification
- job-field evidence extraction
- deterministic ranking and explanation
- quality evaluator and next-wave planner

The planner should issue parallel searches across providers, merge results, inspect evidence gaps, and launch additional search waves when:
- too few valid job pages are found;
- the candidate pool is large but weakly relevant;
- direct-role coverage is good but adjacent/transferable coverage is missing;
- source verification fails or a newly discovered employer/ATS requires follow-up.

Stop based on verified-job yield and marginal quality, not merely because ten raw links have been collected. Never fabricate results to fill a quota.

### 3.3 Search provider adapter layer

All providers implement one internal interface and return normalized records:
`provider`, `query_id`, `title`, `url`, `snippet`, `published_at`, `source_name`, `raw_score`, `content`, `request_id`, `usage`, `errors`.

Initial benchmark shortlist:

| Provider | Proposed role | Current published pricing/limits (check before production) |
|---|---|---|
| Baidu Qianfan Agentic Search | China-web recall, query rewrite, multi-source fusion and authority signal | Official docs list ¥0.04/call, 50 free calls/day, default 3 QPS; returns URL/title/snippet/page content/date/authority score. Test alongside Baidu Search v2. |
| Baidu AI Search v2 | China-web search with site/date filters and deeper query decomposition | API docs expose standard/turbo/pro; Pro supports `query_plan_type=deep` (2–3 rounds). Pricing docs list ¥0.036/call for standard and daily free quota; a separate API page states 1,500/month distributed daily, so account quota must be confirmed. A 2026-10-30 to 2026-12-31 campaign advertises enhanced ¥4.9/1,000 and flagship ¥9.9/1,000. |
| DeepSeek Search + Fetch | Existing baseline and low-cost independent source | Official docs list $0.75 per 1,000 successful Search requests and $0.75 per 1,000 successful Fetch requests; Search supports 1–50 results, `site:`/`-site:`/language/date operators, and optional page content. The active HHBA path currently uses `count=20` and `need_content=false`; benchmark `count=50` and `need_content=true`. Keep as one provider, not the only provider. |
| Brave LLM Context | Independent global index and pre-extracted page context | Official pricing: $5/1,000 Search requests, $5 monthly free credits, 50 QPS. Test Chinese and mainland-domain coverage before selection. |
| Exa Search + Contents | Semantic discovery and page contents | Official pricing: Lite Search from $4/1,000 requests; Contents $1/1,000 pages; $10 monthly free credits. Test Chinese long-tail coverage. |
| Alibaba Cloud Model Studio web_search/web_extractor | High-quality multi-round agent search and extraction benchmark | Official docs list agent search at ¥4/1,000 calls in Beijing/selected regions, but ¥73.392381/1,000 in Singapore region. Region and workspace selection must be confirmed before enabling. |
| Tavily | Alternative agent search/extract benchmark | Free 1,000 API credits/month; pay-as-you-go $0.008/credit. Credit usage varies by endpoint and search depth. |
| SearchAPI.io Google Search / Google Jobs | Optional recall-only signal for discovering employers/job titles and official career pages | Google Jobs aggregates job boards and recruitment sites; never use its listing as final proof or final application URL. SearchAPI lists 100 free requests; Developer is $40/month for 10,000 searches ($4/1,000), with higher-volume tiers cheaper per request. Use only as a discovery signal, then independently verify on the employer site. |
| Firecrawl | Crawl/scrape and structured extraction fallback | 1 credit/page for basic scrape/crawl; Search 2 credits per 10 results. Free 1,000 credits/month; Hobby $19/month for 5,000 credits; Standard $99/month for 100,000 credits (monthly billing). |
| Cloudflare Browser Run | Selective JavaScript-rendered page fallback | Current Cloudflare docs list 10 minutes/day free; Workers Paid includes 10 browser hours/month, then $0.09/hour. Use only when fast HTML/reader extraction fails. |
| OpenAI / Anthropic web search | High-end model/search quality benchmark, not assumed production dependency | Both publish web-search tool pricing around $10/1,000 search calls plus model/content token charges. Requires separate API credentials and regional/terms review. |

Provider choice is not final. Brave exposes country and search-language parameters, but Mainland-China/Chinese coverage must be verified in a real test rather than assumed. The benchmark must use the same de-identified resume profile, query set, date window, and scoring rubric. A vendor's marketing claims are not acceptance evidence.

### 3.4 Page extraction and browser fallback

Use a tiered reader:
1. Fast HTTP fetch and structured metadata (HTML, JSON-LD `JobPosting`, canonical URL, OpenGraph).
2. Provider-native page context or DeepSeek Fetch.
3. Firecrawl or equivalent extraction for difficult pages.
4. Cloudflare Browser Run only for pages that demonstrably require JavaScript rendering.

Do not browser-render every search result. Do not bypass authentication or anti-bot controls. Respect site terms, robots policies where applicable, rate limits, and provider restrictions.

### 3.5 Official-source proof and job evidence ledger

A URL is not official merely because it contains `career`, `jobs`, or `recruitment`. The new verifier must be dynamic and cannot require a company to exist in the four-domain legacy allowlist or the existing enterprise directory.

For each employer and job, store evidence:
- legal/employer display name and normalized entity
- employer-controlled root domain and source evidence
- official careers-page link to the exact job or ATS tenant
- ATS vendor and tenant identifier, if applicable
- exact job detail URL and canonical URL
- extracted title, location, salary, education, experience, skills, responsibilities
- page evidence snippets/DOM or JSON-LD pointers for each material field
- posting/update date, last checked time, and status evidence
- verification method and confidence

Source states:
- `VERIFIED_EMPLOYER_DOMAIN`
- `VERIFIED_EMPLOYER_AUTHORIZED_ATS`
- `OFFICIAL_SOURCE_UNCONFIRMED`
- `THIRD_PARTY_BOARD_EXCLUDED`
- `CLOSED_OR_EXPIRED`
- `FETCH_FAILED`

Only the first two states can enter the primary official-job recommendation list. Unknown hiring status must remain unknown.

### 3.6 Matching and ranking

Use `match-ranking.js` after source verification, not before it. Keep the deterministic baseline and hard eligibility gates. Preserve the dual user-facing measures:
- job fit: capability/role/responsibility alignment
- application competitiveness: how strongly the resume evidences the job's stated requirements

Do not interpret a match score as probability of interview or offer. Every score dimension must be explainable from the resume and verified JD evidence. The model may extract/interpret evidence; it must not invent missing requirements or override hard gates.

### 3.7 Search quality feedback loop

Record aggregate operational and quality data:
- provider/query latency and errors
- unique employers and job pages discovered
- source verification pass rate
- page extraction success rate
- stale/closed/unknown status rate
- duplicate rate
- official application-link success rate
- Top 10 human relevance precision
- cross-industry discovery rate
- cost per verified job

Do not use click-through rate as a substitute for hiring relevance. User feedback may inform offline evaluation; ranking policy changes require review and regression tests.

## 4. Benchmark and acceptance plan

### 4.1 Test set

Build a small, diverse, consented and de-identified benchmark:
- the latest previously uploaded regional-supervisor / multi-store operations resume has now been located in the Library; use it as the first case after local redaction. Preserve conflicting source fields as explicit profile-conflict evidence rather than silently choosing one value;
- mechanical/industrial;
- software/data;
- finance/accounting;
- design/creative;
- sales/marketing/operations;
- graduate/early-career.

Use at least 6 profiles for the first benchmark; expand to 10–20 before broad rollout. No personal contact details are sent to search providers.

### 4.2 Controlled comparison

For each profile:
- identical Mainland-China scope and time window;
- same direct/adjacent/transferable intent groups;
- run each provider independently, then provider combinations;
- retain raw result IDs, provider request IDs, timestamps, and page evidence;
- have a human reviewer label relevance and source validity.

### 4.3 Initial acceptance targets

Targets, not claims of current performance:
- Top 10 relevance: at least 8/10 judged genuinely suitable by a human reviewer where ten qualifying jobs exist.
- Official-source evidence: 100% for jobs shown in the primary official recommendation list.
- Job facts: every displayed title, employer, city, salary, education and experience field supported by page evidence or explicitly marked undisclosed.
- Application URL: direct job detail/application URL, checked and traceable.
- Third-party job boards: zero in final recommendations.
- Duplicate jobs: no duplicate employer + job identity in the same result set.
- Search expansion: demonstrate additional verified jobs from adjacent/transferable directions, not just keyword variants.
- No false positive from navigation text, company directory pages, generic search snippets, or unrelated ATS pages.

If fewer than ten valid jobs exist, show fewer and explain why. Do not relax source or relevance rules to reach ten.

## 5. Privacy, safety, and operational controls

- Resume parsing is versioned and performed once per resume version.
- Raw resume content is not sent to search vendors. Search vendors receive only derived role/skill/location query terms.
- Strong-model resume interpretation requires explicit consent and provider-specific disclosure.
- Search result pages are untrusted data; ignore instructions embedded in web content.
- Validate URLs, redirects, DNS/IP destinations and content types; block localhost/private-network/metadata endpoints to prevent SSRF.
- Apply per-provider concurrency, timeout, retry/backoff, and circuit-breaker controls.
- Record usage and cost per request; configure provider-level and global hard spend ceilings to prevent runaway loops. Quality is not reduced by arbitrary low fixed limits, but calls remain bounded and auditable.
- Keep API keys in Cloudflare secrets/server environment only; never expose keys in browser code or Git history.
- Do not persist raw provider payloads containing resume text or personal data unnecessarily.

## 6. Implementation phases

### Phase 1 — Audit and technical plan
- Completed initial source-path audit.
- Created this isolated design document on a feature branch.
- No production code or data changed.

### Phase 2 — Provider proof-of-concept
- Add provider adapters in an isolated test environment.
- Benchmark Baidu Agentic Search, Baidu AI Search v2, DeepSeek Search/Fetch, Brave LLM Context, Exa, and Alibaba Model Studio web_search.
- Add SearchAPI Google Jobs only as a recall-only experiment if its output can be strictly excluded from final recommendations.
- Compare Firecrawl and Cloudflare Browser Run for page extraction fallback.
- Use the same test resumes and manually judged results.

### Phase 3 — New engine implementation
- Build the unified planner, provider adapters, query graph, task queue, evidence ledger, source verification, deterministic ranking integration, and quality metrics.
- Keep the current production path intact while the new engine is tested.
- Make the candidate UI use AI-generated job directions and real task progress; do not require manual target-role entry.

### Phase 4 — Acceptance and controlled rollout
- Regression, security, privacy, concurrency, cost, and mobile tests.
- Run shadow/canary comparisons against the existing route.
- Replace the active route only after the benchmark and user acceptance pass.
- Deploy to `hhba.work` only after explicit acceptance.

## 7. Immediate next actions

1. Complete a provider-level technical proof-of-concept and confirm account-specific pricing/quotas.
2. Retrieve the exact previously uploaded supervisor resume from the Library for the first controlled benchmark.
3. Obtain API credentials only for the providers selected for the test. Store them as Cloudflare secrets; do not paste them into source code or commit them.
4. Produce a side-by-side result report before changing the production candidate matching flow.

## 8. Official provider references

- DeepSeek Search & Fetch: https://api-docs.deepseek.com/guides/search/
- DeepSeek web tools billing: https://api-docs.deepseek.com/guides/web_tools/
- Baidu AI Search API: https://cloud.baidu.com/doc/qianfan-api/s/Jmwbl4qxs
- Baidu Agentic Search API: https://cloud.baidu.com/doc/qianfan-api/s/Zmwbl4rg5
- Baidu AI Search pricing: https://cloud.baidu.com/doc/qianfan-docs/s/Jm8r1826a
- Baidu AI Search campaign: https://cloud.baidu.com/product/AI-SEARCH/campaign.html
- Alibaba Model Studio web search: https://help.aliyun.com/zh/model-studio/web-search
- Brave LLM Context docs: https://api-dashboard.search.brave.com/documentation/services/llm-context
- Brave Search API pricing: https://brave.com/search/api/
- Exa pricing: https://exa.ai/pricing/
- Tavily pricing: https://www.tavily.com/pricing
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Cloudflare Browser Run pricing: https://developers.cloudflare.com/browser-run/pricing/
- SearchAPI Google Jobs docs: https://www.searchapi.io/docs/google-jobs
- SearchAPI pricing: https://www.searchapi.io/pricing/
- OpenAI web search guide: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- Anthropic web search tool: https://docs.anthropic.com/zh-CN/docs/agents-and-tools/tool-use/web-search-tool
