# HHBA Word：无需常驻 LibreOffice 的浏览器方案（Draft PR #431）

## 范围

只在原有的岗位匹配弹窗中运行。岗位匹配、官方申请链接和 Siri 彩虹文字保留。
目标是让用户即使没有在线 Word 渲染器，也能对本人私有的 **DOCX** 文件作精确文字替换、保存岗位独立版本以及下载 DOCX。

## 实现

1. 浏览器通过经过登录验证的 `GET /api/resume-word?action=source-docx&resume_id=...&job_id=...&revision=...` 获取当前岗位 DOCX（不公开 R2 地址）。
2. 浏览器内运行现有 `editOriginalDocxStrict`，只替换一个唯一的 `word/document.xml` 的 `w:t` 节点，保留其他 OOXML ZIP 成员的压缩字节，计算 SHA-256。采用 HHBA 自托管的 JSZip 和 Apache-2.0 `docx-preview` 在同一弹窗内进行 HTML 预览，不调用外部 CDN。
3. Cloudflare Pages Functions 重新读取属于当前登录用户的 R2 原件、验证原件 SHA、独立执行相同的受限文字修改，并将结果 SHA 与浏览器计算的 `client_docx_sha256` 做比较。
4. 后端将岗位哈希 `job_scope_sha256` 对应的 DOCX 修订与 CAS 版本清单保存到独立的私有 R2 对象。原件不覆盖，A/B/C 等岗位互不覆盖，Undo/Redo 仅变更当前岗位版本指针。
5. **无渲染器版本**清单中标注 `verification:'docx_structure_only'`，`page_count:null`、`preview_sha256:null`。这类 DOCX 可以下载，服务端明确禁止该版本的 PDF 下载与 PDF 预览；浏览器和 UI 必须提示最终分页未经专业验证。
6. **有渲染器版本**沿用旧的 `prepareVerifiedOriginalDocxExport`、LibreOffice 和 PDF 验证链。旧版数据兼容。

## 安全与发布

- 新入口必须显式设置 `HHBA_WORD_DOCX_ONLY_ENABLED=1`，默认为关闭。Preview 的 `HHBA_AUTH_ROLLOUT=preview` 与现有 R2/D1/pepper 绑定均必须具备。生产环境不会因代码合并自动启用。
- 已有的本人登录校验、R2 哈希核对、同源写入要求、版本号 compare-and-swap、每日限额、单文件 3MB 限制和原文唯一性校验持续有效。
- 不允许浏览器 HTML 预览冒充 Word 的真实分页；绝不自动将网页打印成“原版式 PDF”。
- 原始 DOCX 的格式结构保留 **不意味着** 排版、分页或视觉像素恒定。当前受限替换规则只接受长度不超过原文视觉宽度估计的单个文字节点，不能任意增加新的段落或长文本。
- 前端的 docx-preview 仅是可视化近似，真实 Word 仍须由用户检查；嵌入的外部 HTML 内容 `renderAltChunks` 被禁用。
- 测试必须包含：无渲染器时 A/B/C 岗位版本互不影响、客户端修改哈希必需且匹配、PDF 被拒绝、跨账号读写被拒绝、原件 SHA 不变；保留原有真实 LibreOffice CI 作为可选严格路径的回归基线。
- **没有完成的验收**：Cloudflare Preview 实际构建成功、浏览器中查看真实复杂 DOCX、不同浏览器字体和复杂版式视觉对比、Workers Free CPU 限制下真实 3MB 文件测试。以上均不能以 CI 通过代替。

## 预览启用步骤（由管理员在隔离 Preview 完成）

1. 先确认本 PR GitHub Actions 全部通过、Cloudflare Preview 部署成功。
2. 仅在 Cloudflare Pages 项目 `hhba-talent` **Preview** 中设置 `HHBA_WORD_DOCX_ONLY_ENABLED=1`。不要修改 Production 或覆盖已有 R2、D1 或 secrets。
3. 使用合成简历，逐个岗位完成：打开原弹窗 → Siri 定点建议 → 采纳/编辑 → 保存 → Word 下载 → A/B/C 隔离 → 撤销/重做 → 原件与字体检查。
4. 如果出现格式渲染差异、Worker CPU 超限或浏览器打开失败，保留 Draft、关闭标志并修复；不自动降级成重新排版的 Word 模板。
