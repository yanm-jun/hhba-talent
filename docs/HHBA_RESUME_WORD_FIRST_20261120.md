# HHBA 简历编辑战略调整：Word-first（2026-11-20）

## 用户确认的产品路线

- **唯一的新上传、可编辑源文件为 Word .docx**（最多 3 MiB）；旧 .doc 暂不支持，要求先转换为 .docx。
- **PDF 只作为最终导出物**：服务端以用户已确认、版式检查通过的原版式 Word 生成 PDF。不得将新建 HTML 简历模板打印成 PDF 冒充原始 Word 版式。
- 停止拓展原生 PDF 字体/CID 逆向写入、ToUnicode 及复杂 PDF 编辑工作；不承诺 PDF 字体原位替换。
- 已经存在于本人私有简历库中的旧 PDF 继续允许**查看、下载和删除**；新上传接口返回 415 `PDF_UPLOAD_DISABLED`。
- Siri 彩虹预览只表示**尚待本人确认**；最终文件绝不能包含 Siri 渐变、模拟字体或 HTML 操作控件。
- **AI 只能建议修改，不得凭空新增岗位、经历、数字、技能或资格**；修改必须由本人审阅并确认。匹配分是同一规则下的参考分，不是录用概率。

## 本次实际已改动的路径

| 功能 | 关键路径 |
| --- | --- |
| 新文件上传前后端 DOCX 限制 | `src/components/PrivateResumeVault.tsx`、`src/services/privateResumes.ts`、`functions/api/resumes/[[path]].js` |
| 中文岗位匹配上传前端 | `src/pages/CandidateMatchPage.tsx`、`src/services/resumeMatch.ts` |
| 备用岗位匹配上传前端 | `src/pages/ResumeMatchPage.tsx`、`src/services/resumeMatching.ts` |
| Word 源格式展示/局部编辑/用户确认 | `src/components/OriginalWordViewer.tsx`、`functions/api/resume-word.js` |
| 验证后 Word 与 PDF 双格式下载 | `src/services/originalWordApi.ts`、`functions/api/resume-word.js` |
| 历史 PDF 只读隔离 | `src/components/LegacyPdfReadOnlyViewer.tsx`、`src/components/OriginalResumeViewer.tsx` |
| 防止模板 PDF 被误认原样式 | `src/components/TargetedResumeOptimization.tsx` |
| 端点权限/哈希/文件格式与 Chromium QA | `scripts/resume-word.route.test.mjs`、`scripts/private-resumes.security.test.mjs`、`scripts/resume-browser.qa.mjs` |

以上路径相对于 `apps/web/`。

## 正确交付链路

1. 本人主动上传 DOCX，私有 R2 保留原件，D1 保留拥有者及源文件哈希。
2. 本人打开原 Word；仅通过私有 Word 渲染服务生成**原文件排版**的 PDF 页面供 PDF.js 显示。这一 PDF 是**预览产物，不是上传/编辑源文件**。
3. AI 修改建议应与**唯一的原 Word 文字位置**绑定；不唯一、跨 run 拆分、长度无法容纳、含未知字体时拒绝伪造原版式修改。
4. 本人逐条确认事实、文字及处理授权。后端修改源 DOCX 的可验证文本节点，严验修改前后其他页面/位置未变。
5. 经验证的 DOCX 存在私有 R2；私有渲染器以**这份已修改 DOCX**生成 PDF，服务端保存 PDF 哈希。
6. 下载 Word 是 `action=download`，下载 PDF 是 `action=download-pdf`，原 Word 预览是 `action=preview`，已修改版预览是 `action=edited-preview`。所有文件按当前账户验证、受授权保护，PDF 下载检查保存的 SHA-256，不能用前端 HTML 打印代替。
7. 用户删除原文件，应同时删除它的所有私有预览、Word 修改版、PDF 导出版和元数据。

## 验收/上线不可跳过的限制

- Word 渲染器代码已存在于 `services/word-renderer`，**但线上渲染器尚未部署和联通**。Cloudflare Pages 的 `HHBA_WORD_RENDER_ENABLED` 默认关闭。浏览器在未启用时只能读取 Word 文字，不能宣称已提供原版式编辑与双格式下载。
- 仅允许在独立 Preview 环境先部署隔离的 Word 渲染器，再配置 `HHBA_WORD_RENDER_ENDPOINT`、加密 `HHBA_WORD_RENDER_SHARED_SECRET`、`HHBA_WORD_RENDER_ENABLED=1`。密钥不得进入浏览器、GitHub 日志或仓库。
- DOCX 原版式编辑目前仍是一处安全文本节点的保守版本：当用户选择**已保存的 DOCX 进行岗位匹配**时，AI 建议在本人确认后可作为**仅同原文完全相同的唯一 Word 节点**的预填内容，原 Word 页面还需要用户再次确认才能保存。未实现任意复杂 Word 的多段自动映射和多次连续保存。岗位优化界面的 Word 模板导出已经明确标为“新排版草稿”，不能混同“保留原版式 Word”。
- 需要补真实 Word 原文件（多字体、表格、双栏、页眉、中文、长文档）的 Preview 沙盒测试、缺失字体的拒绝测试、转换前后页数/非编辑区域像素验证，和真实登录用户同一会话的全链路。
- 原 PDF 文字改写 API 在本阶段只是**停止扩展和在生产 UI 下线**；后续单独清点相关 Worker 路由和已存储派生结果再有序撤除，避免误删历史文件。
- 生产 `hhba.work`、`main`、生产 D1、生产 R2 及正式密钥未在本次改动中变更。Draft PR 只有验收门槛达成才能转正并计划上线。

## 建议的后续拆分

1. Preview Word 渲染器部署、凭证和字体白名单，成功的真实 DOCX→PDF 转换。
2. 优化建议绑定到原版式 DOCX 的正确文本节点，支持逐条确认、连续修改、撤销和版本历史。
3. 从搜索结果“针对这个岗位优化简历”到本人上传的 Word，形成无模板混淆的统一工作流。
4. 浏览器桌面/手机验收，查明字体替换、表格分页、页数变化等问题，再进行生产迁移/灰度。

> 原则：**编辑可靠性高于覆盖率**。无法保证原样式的 Word 可以生成清晰的新排版草稿，但不得静默把这种草稿当成原版式版本交付。