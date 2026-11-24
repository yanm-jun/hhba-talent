# HHBA Agent V3 — 中转站预览环境配置（2026-11-24）

## 状态与范围

- 仅独立开发分支 `feat/hhba-agent-v3-relay-20261124` / 草稿 PR #502。
- **绝不自动切换正式站 hhba.work；V3 仍未实现全流程后台，不可作为正式服务上线。**
- Cloudflare Pages 项目 `hhba-talent` 的 **Preview 环境**已经设置中转站基础地址、模型和功能开关；原有环境变量和正式站未覆盖。
- **Token 尚未配置**：用户在聊天里提供的 Token 即使声称是假的，也不能被提交到仓库或通过日志传输；需使用 Cloudflare Secret UI 安全设置新凭据。
- API Key 可使用的能力由中转站实际支持决定；`web_search`、自定义工具、模型列表都必须分别实测。

## Preview 已添加的非密钥变量

| Name | Value |
| --- | --- |
| `HHBA_AGENT_PROVIDER` | `relay` |
| `HHBA_AGENT_BASE_URL` | `https://api-c.reqtoken.com/v1` |
| `HHBA_AGENT_MODEL` | `gpt-6.2-sol` |
| `HHBA_AGENT_REVIEW_MODEL` | `gpt-6.2-sol` |
| `HHBA_AGENT_ACTOR_AUTH` | `local-image-extension` |
| `HHBA_AGENT_V3_ENABLED` | `0` |
| `HHBA_AGENT_V3_DIAGNOSTICS_ENABLED` | `0` |

### 仅需在 Cloudflare 中安全保存密钥

打开 Cloudflare Dashboard → Workers & Pages → `hhba-talent` → Settings → Variables and Secrets → **Preview**，新增 **Encrypted / Secret**：

- 变量名：`HHBA_AGENT_RELAY_API_KEY`
- 值：从中转站后台重新生成的独立访问凭据（不要复制到 GitHub、前端或聊天里）。
- 之前聊天中出现过的 Token 视为已暴露。不要用于生产。更换后方可测试。

> 注意：`HHBA_MATCH_OPENAI_API_KEY` 是已有的另一条链路的官方 OpenAI Key 配置。**V3 relay 不能读取或复用它**，避免把官方 Key 发送到第三方中转站。

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
