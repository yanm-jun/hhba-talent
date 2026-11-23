# HHBA Clean Match V2 — OpenAI 官方 API 独立重构（2026-11-23）

## 本次范围
重做现有 `/api/match-next`，不创建 V3，不重写 HHBA 的用户账号、简历库、历史记录、Word 编辑器、财务系统或 D1/R2。
V2 不允许调用 DeepSeek，不使用「兼容 OpenAI」的第三方网关，也不接收原先聊天里公开过的 API 密钥。

## 架构

1. 已登录候选人上传 PDF/DOCX：客户端优先本地解析；实在无法解析时，需明确授权经服务端把原始文件发送至官方 OpenAI Responses `input_file`。`/api/match-next/ocr` 要求 `X-HHBA-OCR-Consent: openai-resume-ocr-v2`，仅响应脱敏文本。
2. 已脱敏简历通过隔离 `resume-jd-match-openai-v2.js` 获取可逐字回查的事实 ID，不能虚构学历、技能、年限、经历或资质。
3. 模型规划岗位方向与城市；模型使用 **官方** `web_search`；只从服务端响应的 `web_search_call.action.sources` 或正式 `url_citation` 中提取网址，模型自行写出的链接不算来源。**私有简历内容不交给公共 web_search**。
4. 拒绝第三方招聘站、境外/非大陆岗位、非单个职位页；对候选企业岗位 URL 用有限超时、有限内容长度的 HTTPS GET 读取。不携带 OpenAI API Key 请求企业网站，不跟随重定向。
5. 逐条提取岗位名称、企业身份、明确的工作城市、JD 职责/要求原文；没有支持证据则不制造有效岗位或随机评分。
6. 匹配评分必须能对上本次简历事实 ID 和真实 JD 原文。独立 JD 归档核验仍是解锁可信 Word 优化的前提。缺少证据返回 `null`，不可冒充录用概率。
7. 返回阶段进度、Search 来源数量、被拒绝链接计数、网页读取数和失败阶段；虚构简历运行不保存真实个人匹配历史。

## 服务端配置

仅在 Cloudflare Pages **预览环境**安装新密钥：
- `HHBA_MATCH_OPENAI_API_KEY`：**Secret**，来自 `https://platform.openai.com/` 的新创建 API key，不放浏览器、仓库、PR、README 或聊天内容；历史公开过的旧密钥应撤销。
- `HHBA_MATCH_OPENAI_MODEL`：可选纯文本环境变量，默认 `gpt-6.2-astra`，需要官方账号实际拥有该模型的调用权限。
- `HHBA_MATCH_SERVICE_ENABLED=1` 和授权登录的 D1 绑定。
- `HHBA_PREVIEW_AI_DIAG_ENABLED=1`：仅用于 Cloudflare **preview hostname** 的明确授权诊断。
- `HHBA_MATCH_CLEAN_V2_ENABLED=0`：验收前在**生产**保持关闭。**不要将预览诊断设置复制到正式站。**

V2 官方接口固定到 `https://api.openai.com/v1/responses`；其它 provider 不会被自动回退调用。V2 部署不要求/读取 `HHBA_MATCH_DEEPSEEK_KEY`。原本停用的旧匹配后端文件未被删除，以免影响不相关遗留服务。

## 验收状态与边界

- 当前独立 PR / 分支仅表示代码提交；GitHub CI 模拟数据测试，不等同于官方 OpenAI 付费调用成功，也不等同于实际找到 10 条可投递岗位。
- `/api/match-next/provider-check` 只验证一次实际 OpenAI JSON 与联网搜索的公开来源；`fetch_content_verified=false` 是诚实表示该检查**没有**读取企业 JD。
- `/api/match-next/synthetic-check`：预览域、候选登录、自愿授权、固定虚构简历；只有真实网页成功读取并得到证据时才算岗位候选。
- 正式发布前要求：至少 3 类真实非个人简历画像、10 个可打开的**具体单岗官方 URL**目标、完整 JD 核验、速度和错误日志验收，且优化简历对应的**共享 Word 优化后端模型**需要单独完成 OpenAI-only 迁移与回归，不允许误称整站已经彻底替换 DeepSeek。
- 没有确认模型可用、搜索来源和完整 JD 时，不将 V2 生产开关置 1。

## 代码入口与隔离
- `apps/web/functions/api/match-next/[[path]].js`
- `apps/web/functions/_lib/openai-match-v2-provider.js`
- `apps/web/functions/_lib/resume-jd-match-openai-v2.js`
- `apps/web/functions/_lib/resume-ocr-openai-v2.js`
- `apps/web/functions/_lib/clean-match-v2.js`
- `apps/web/scripts/clean-match-v2-openai.contract.test.mjs`

新模块独立，禁止从 V2 路由调用旧 DeepSeek 识别/搜索工具。`HHBA_MATCH_CLEAN_V2_ENABLED` 保持生产关闭是发布门槛，不是待修功能。
