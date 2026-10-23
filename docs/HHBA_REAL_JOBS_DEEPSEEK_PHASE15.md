# HHBA Phase 1.5 — 原版招聘市场 + 真实职位来源 + DeepSeek 官网检索

## 已开发的核心变化
- 首页恢复原有「招聘市场」标题、中文/English、单一岗位搜索框、筛选条、双列岗位卡片、真实企业品牌 Logo、职位详情。
- 只展示 **OpenAI / Anthropic / SpaceX** 三家当前公开 ATS Job Board 查询中确实返回且来源 URL 校验通过的岗位。每次 GitHub 静态版发布前重新执行 `node apps/web/scripts/prepare-three-employers.mjs`。
- 来源分别为 OpenAI 的 Ashby 公开 Job Board 和 Anthropic/SpaceX 的 Greenhouse 公开 Job Board。岗位名、位置来自 ATS 原始数据，早期人工翻译仅在原始 ID 与职位元数据核验一致时使用。
- 国内企业历史快照只保留在旧工程中，不再进入新市场默认列表。国内企业官方招聘入口保存在经过整理的企业来源目录。
- 无法读取 ATS 或数据超过 24 小时：不编造旧岗位代替。如果仅部分数据源成功，则只展示成功核验的子集。
- 首页下方保留 OpenAI、Anthropic、SpaceX 已追溯的真实 Logo 展示；不提供任何企业合作的虚假声明。

## DeepSeek 新增的功能（尚未启用）
`apps/job-discovery-api/server.py` 是默认关闭的真实联网检索后端：
1. 用户在**原有搜索框**输入专业、学历、经验及地区。
2. 接口先用 DeepSeek 模型从已登记、历史核验的国内招聘企业中选取至多两家。
3. 调用 DeepSeek Search，按 **已登记招聘官网的域名** 查询岗位；只接受与官方域名严格相等的结果。
4. 使用 DeepSeek Fetch 查看至多两个网站内容，用模型提取单个明确岗位名和原文证据；岗位名、引用都必须在网页正文中逐字存在。
5. 返回 `OFFICIAL_PAGE_FOUND_STATUS_UNVERIFIED`，只能表示「招聘官网页面发现此岗位」，**不能宣称当前仍在招**。没有证据就不生成岗位。
6. 在前端添加原招聘市场内的简洁「AI 联网找国内岗位」入口，仅在安全后端状态 `enabled=true` 时出现，无第二套搜索框。
7. 资料发送 DeepSeek 前需用户明确同意；不保存求职描述；禁止暴露 Key 到前端。

官方 API 文档：https://api-docs.deepseek.com/zh-cn/guides/search/

## 暂未配置的付费服务
没有 Key，也没有可以访问的受控 Railway 环境，本阶段不进行真实 DeepSeek 请求和任何付费测试。部署在支持后端的环境后配置以下变量（**只在服务器密钥管理/Variables**）：

```env
HHBA_JOB_DISCOVERY_ENABLED=0
DEEPSEEK_API_KEY=
HHBA_JOB_DISCOVERY_MODEL=deepseek-flash
HHBA_JOB_DISCOVERY_ALLOWED_ORIGINS=https://example-preview.example.com
HHBA_JOB_DISCOVERY_QUOTA_DB=/data/hhba-job-discovery-quota.sqlite3
HHBA_JOB_DISCOVERY_RATE_SECRET=<32位以上强随机内容>
HHBA_JOB_DISCOVERY_DAILY_LIMIT=20
HHBA_JOB_DISCOVERY_CLIENT_LIMIT=2
PORT=8080
```
部署前配置持久卷 `/data` 并确保应用进程有写入权限。禁止多副本共用非共享 SQLite 文件；如需公开放量，需迁移为集中限流/账单预警并确认隐私与法律合规。CORS 不是身份验证，开放公网前还需反滥用网关与账号额度硬限制。单进程限流不代表平台绝对账单封顶。

前端**唯一公开配置**：`VITE_HHBA_JOB_DISCOVERY_API_ORIGIN=https://<your-secure-backend-host>/`（不包含 API Key）。只有受控后端完成配置后，才开启 `HHBA_JOB_DISCOVERY_ENABLED=1`。

## 零费用验收
```bash
cd apps/web && npm ci && npm run build
cd ../..
python -m unittest discover -s apps/company-match-api -p 'test_*.py'
python -m unittest discover -s apps/job-discovery-api -p 'test_*.py'
```
GitHub Pages 构建自动先检查实时 ATS 的公有开放职位列表，然后使用无 Key 的 Chromium 验证首页单搜索栏、下拉筛选、官方职位卡片、公司标识、手机端及历史国内岗位隔离。

## 状态
- 新 GitHub Pages 子目录是独立预览，**原根目录与 Railway 生产服务不修改**。
- 实际 DeepSeek 联网匹配的正确性、费用、时延以及是否可访问具体国内 ATS 页面都还需要在提供 Key 后实测。
- 不购买向量数据库，不购买大型职位数据库，不采集简历敏感信息。
