# HHBA — AI 根据目标岗位主动撰写整份简历（2026-11-20）

## 产品目标

用户上传并授权分析一份 Word，经正式岗位匹配后，点击「AI 针对岗位重写整份简历」。
系统读取完整**可提取的**简历证据，按真实岗位要求规划、撰写、复核整份内容。
用户只需核对真实事实、回答必要的补充问题，确认后下载真实可编辑的 Word。
旧的「最多五条局部建议」接口保留兼容，但**不再是主要 AI 创作能力**。

## 当前 Draft PR #405 代码

- `/api/resume-rewrite`：新求职者私有接口，正式环境默认关闭；严格同源、会话、候选人权限和第三方 AI 数据处理授权。
- `resume-rewrite-provider.js`：整份简历规划（一次）→ 按实际长度分组独立撰写（多个）→ 每组复核（多个）；支持 DeepSeek/OpenAI/Anthropic/Gemini/Qwen 等已配置的 provider，可选不同模型分别撰写和审核。
- `resumeWholeRewriteSource.ts`：使用用户当前已经提取并确认的原始 Word 文本；不再套用十二个、每个一千六百字的旧短建议片段。原文超过当前单次请求容量则明确拒绝假冒「整份」。
- `WholeResumeRewriteReview.tsx`：输出每个段落的完整前后对比；可以一次确认整份草稿；缺失真实性信息时 AI 提问，用户可以补充真实经历后重新撰写。
- `resumeWholeRewriteExport.ts`：整份已确认草稿可在浏览器生成真实可编辑 OOXML `.docx`，无服务器 Word 渲染依赖；文件明确标注**新排版**，绝不声称覆盖/完全保留上传原 Word 的版式。
- `OriginalWordViewer`：较短且渲染位置唯一匹配的事实改动，可继续显示在原 Word 对应位置并应用现有保真流程。长文本与跨表格/跨页改写不能无校验地伪装为已写入原版式 Word。
- Chrome 手机/桌面合成 QA 检查九段整体改写、事实确认、完整 DOCX 下载、ZIP 内最后一段存在、原 Word 仍未修改。后端模拟 19 个来源段落的规划/撰写/复核，不再有五条限制；拒绝虚构数值、外部敏感信息及缺少证据的文字。

## 配置（全部为服务端，不发送给浏览器）

在隔离 Preview 设置：

```text
HHBA_AUTH_ROLLOUT=preview
HHBA_RESUME_REWRITE_ENABLED=1
HHBA_AI_RESUME_REWRITE_PROVIDER=openai
HHBA_AI_OPENAI_API_KEY=(通过 Cloudflare 的密钥管理配置)
HHBA_AI_OPENAI_MODEL=(管理员选择的支持结构化输出的模型)
HHBA_AI_RESUME_REVIEWER_PROVIDER=anthropic
HHBA_AI_ANTHROPIC_API_KEY=(通过 Cloudflare 的密钥管理配置)
HHBA_AI_ANTHROPIC_MODEL=(管理员选择的审查模型)
```

如果未配置专用 provider，则使用 `HHBA_AI_DEFAULT_PROVIDER`；已有 DeepSeek 服务端 key 可复用。配置不同审核模型不是强制条件。服务端单次多阶段模型调用费用没有人工设置一个低价硬上限；仍保留网络超时、有效负载上限、候选人会话与权限校验、真实性保护。**不把「不设预算上限」误解成允许任意匿名用户无限刷付费 API。**

生产环境需要另外开启 `HHBA_RESUME_REWRITE_PRODUCTION_ALLOWED=1`；目前禁止直接打开。

## 真实性与隐私

- 不把「岗位要求」当作求职者已具备的技能。模型的 `sourceQuotes` 必须逐字对应当前来源段落，单独审核模型必须完成审查；新增数字必须在来源文本中出现。系统审核不保证识别所有语义性编造，用户最终仍需核对。
- 常见手机号、邮件、证件号在发送给第三方前脱敏；但无法保证自动脱敏覆盖所有识别性信息，故需要单独授权。
- 未通过核实的段落保持原文，不将模型虚构内容写入 DOCX；缺失事实变成具体追问。
- 一次确认整份内容不等于改写上传的 Word，也不等于提高真实岗位匹配分；只有真实保存的 Word 和经过审核的同岗位评分标准才能复评。
- 原始 Word 私有保存不覆盖，所有 Word 字体、页数和局部改动的原版式校验继续保留。

## 尚未完成的上线依赖

1. **完整真实岗位 JD 输入**：当前匹配结果可能只有若干核心岗位要求而非完整官方 JD；需要从已审核的招聘记录进一步读取完整职位文本，不能仅用概括关键词代替完整岗位。
2. **跨段落原版式写回**：新排版 Word 可以立即完整导出；但任意长文、跨 run/复杂表格自动回写到用户原 Word，仍需独立真实 OOXML 和 LibreOffice 保真验证，绝不能靠 CSS 动效认定文件已经保存。
3. **Cloudflare Free 真实模型联调**：目前 GitHub 测试使用合成 AI 返回，不产生真实模型账单；需要在独立 Preview 用真实服务端模型密钥验证实际多阶段输出、处理时间和成本。
4. **复杂真实简历验收**：中文混排、不同字体/字号、表格、图片、页眉页脚、多页原 Word，连同手机 Safari/Edge 等实际设备。
5. **长任务可靠性**：多模型分组撰写可能超过单次 Cloudflare Free 请求的墙钟时间；需要分段继续执行与私有进度持久化，不能保证目前单一 HTTP 请求适用于所有极长简历。

当前仅提交 Draft PR #405，不合并 `main`，不修改正式 `hhba.work` 的数据库、R2、模型密钥或服务计费开关。
