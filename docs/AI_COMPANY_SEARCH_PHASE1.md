# HHBA · Phase 1.1 AI 智能找企业｜隔离开发验收

> 分支：feat/ai-company-search-phase1-20261023。PR #63 为 Draft。**绝对不自动合并和部署 Railway 生产环境。**

## 当前交付范围
- 保留原岗位搜索，增加 **AI 智能找企业** 模式；未启用 AI 时可免费搜索企业目录。
- 复用 HHBA 之前的人审企业资料 50 家，以及 hhba-recruitment-engine 截至 2026-10-15 登记的 83 家国内企业**历史官方招聘入口**。
- 两份相同的 `catalog.json` 目录存放于 `apps/company-match-api/` 和 `apps/web/src/data/`，自动化测试检查二者完全一致。
- **推荐对象是企业，而不是职位；** 不推断国内企业的当前在招状态、学历要求、专业限制或录用概率。
- 用户输入的描述通过浏览器传递到 API；客户端**不能**提交企业名单覆盖可信服务端企业目录。
- 输入需用户主动同意第三方 AI 处理；不存储求职描述或简历内容，也不写到 HTTP 访问日志。

## 零新增付费依赖的验收方式
```bash
cd apps/web
npm ci
npm run build
cd ../..
python -m unittest discover -s apps/company-match-api -p 'test_*.py' -v
python -m py_compile apps/company-match-api/server.py
```
GitHub Actions: `HHBA AI Company Search Phase1`。**该工作流没有任何真实 API 调用，也不接触 Secret。**

## 在私有测试环境接入 DeepSeek 时所需环境变量
真实 Key 不得写入 GitHub、前端 `VITE_*` 变量、浏览器日志或聊天记录。

```env
HHBA_COMPANY_MATCH_ENABLED=0
DEEPSEEK_API_KEY=
HHBA_COMPANY_MATCH_MODEL=deepseek-chat
HHBA_COMPANY_MATCH_ALLOWED_ORIGINS=https://your-preview.example.com
HHBA_COMPANY_MATCH_QUOTA_DB=/data/company-match-quota.sqlite3
HHBA_COMPANY_MATCH_RATE_SECRET=REPLACE_WITH_32_PLUS_RANDOM_CHARACTERS
HHBA_COMPANY_MATCH_DAILY_LIMIT=30
HHBA_COMPANY_MATCH_CLIENT_DAILY_LIMIT=3
PORT=8080
```
- `HHBA_COMPANY_MATCH_ENABLED=0` 是默认；启用前必须有人确认凭据、AI 模型当前支持、成本预算及各项安全闸门。
- `HHBA_COMPANY_MATCH_QUOTA_DB` 必须位于已挂载的**持久化**目录；若缺失则不应开启付费服务。服务端使用 SQLite 原子事务保存日配额，同一天同一客户端仅存 HMAC，不存 IP 原文。
- API 当前使用单实例保守限流；**多副本、反向代理共享地址或公开大流量部署必须重新设计限流与账单预警**。CORS 不是鉴权；仅凭日限额不是云平台绝对费用封顶，模型超时与网关重试仍可能产生成本。
- 同意说明、第三方 AI 数据传输、隐私政策及招聘信息展示规则需在公测前审核。
- 前端环境变量 `VITE_HHBA_COMPANY_MATCH_API_ORIGIN` 仅指向已授权的 HTTPS API Origin，不含 API Key。

## 本阶段验收 / 已知局限
1. 已具备 TypeScript 编译、静态资源打包、后端 API 单元测试和 Python 语法检查的 CI。
2. 真正调用 DeepSeek API、模拟浏览器端到端点击、Railway 关联仓库与环境核验、生产发布 **均未完成**。
3. 国内 83 家仅由历史官方入口验证支持，暂未拥有可信的逐企业职业和技能画像，不能据此宣称它们与用户专业或经验满足岗位条件。
4. 企业规模将逐步扩充，但新增企业必须有官方依据与数据审核，不能凭模型捏造。
5. 待 Railway 恢复后先核对服务、分支与构建来源；然后先在非生产环境验收，再考虑正式启用。
