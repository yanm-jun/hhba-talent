# HHBA Agent V3 — 中转站预览环境配置（2026-11-24）

## 状态与范围

- 仅独立开发分支 `feat/hhba-agent-v3-relay-20261124` / 草稿 PR #502。
- **绝不自动切换正式站 hhba.work；V3 仍未实现全流程后台，不可作为正式服务上线。**
- Cloudflare Pages 项目 `hhba-talent` 的 **Preview 环境**已经设置中转站基础地址、模型和功能开关；原有环境变量和正式站未覆盖。
- **Preview Token 已配置**：Cloudflare Preview 已识别到 `HHBA_AGENT_RELAY_API_KEY` 加密 Secret；没有读取或导出密钥内容。
- API Key 可使用的能力由中转站实际支持决定；`web_search`、自定义工具、模型列表都必须分别实测。

## Cloudflare Free：仅保留一个 V3 新环境变量

Cloudflare Pages Functions 的 Workers Free 每个 Worker 最多 64 个文本变量/加密密钥/绑定。原先 V3 新增多个非密钥变量后，共达到 70 个，部署因超额失败。已从 Preview 移除本次新增的 7 个普通环境变量，同时完整保留原有项目变量及唯一新增的加密密钥。

**当前 Preview 只有一个 V3 新增变量**：`HHBA_AGENT_RELAY_API_KEY`（`secret_text`），其余全部使用 V3 服务端的固定安全默认值：

- 服务商：`relay`，当且仅当 V3 专有 Relay Secret 配置存在；绝不拿正式 OpenAI Key 给中转站。
- API 域名：`https://api-c.reqtoken.com/v1`（固定可信主机，不接受用户输入）。
- 模型和审核模型：`gpt-6.2-sol`。
- 中转站非标准头：`x-openai-actor-authorization: local-image-extension`。
- 启用和诊断开关：默认关闭，正式环境和未授权预览不会执行付费调用。

源代码不包含密钥内容，运行日志也不记录密钥或用户简历；Cloudflare 预览构建使用匿名合成内容单独检查 `/models`、`/responses` 和 `web_search`。如果发现中转站不支持某项能力，要如实报告，不得冒称验收成功。

### 如需将来更换 Secret

Cloudflare Dashboard → Workers & Pages → `hhba-talent` → Settings → Variables and Secrets → **Preview** → 加密 Secret：`HHBA_AGENT_RELAY_API_KEY`。不要复制到 GitHub、前端或聊天里。

> 曾在聊天中公开的凭据应当轮换。Cloudflare 无法保证第三方中转站遵守 OpenAI 官方的隐私和数据保留规则；真实简历发送前还应完成第三方告知与同意。

## 对应配置的正确解释

- `model_provider = OpenAI`、`base_url`、`model`、`review_model` → V3 服务端传输配置。
- `wire_api = responses` → 使用 `POST /v1/responses`，并强制 `store:false`。
- `model_catalog_url` → 诊断 `GET /v1/models`，只报告用户实际可用的模型列表信息。
- `http_headers` 中的 `x-openai-actor-authorization` 仅对可信 relay 显式配置，不发送给官方 OpenAI。
- `disable_response_storage` 不保证第三方中转站不记录数据，只表示 HHBA 请求中关闭 OpenAI 的存储选项。应审核中转站隐私政策后再发真实个人简历。
- `web_search = live`、`network_access=enabled`、`[features]`、Windows/WSL 选项属于客户端或平台配置，**不是将同名字段复制给 API 就能启用的功能**。

## 新 V3 API（独立于 V2）

- `GET /api/agent-v3/status`：显示配置名称/模型/启用状态，不发付费请求、不暴露 Key。
- `POST /api/agent-v3/provider-check`：只有 Pages 独立预览域、独立诊断开关打开、同源、已登录候选人、明确同意且固定合成诊断请求，才检查模型目录、JSON Responses、`web_search`。
- `POST /api/agent-v3/analyze`：只在独立预览域和 V3 功能开关启用后，分析用户已授权的脱敏简历，返回原文证据、职业方向、行业、城市与不确定性。它会**停在等待用户选择方向**，不会直接搜索。

**上线剩余工作**：V3 自主工具循环、真实岗位搜索、JD 数据核验、任务恢复、Word 版本管理、对原前端接口的无视觉变更对接、实际中转站的联网工具验收。完成这些之前保持两个 V3 开关为 `0`。
