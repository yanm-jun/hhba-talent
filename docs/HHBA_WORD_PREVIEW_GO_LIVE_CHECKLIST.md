# HHBA Word-first Preview 上线前清单

截至 2026-11-20：PR #405 的 Word 修订版逻辑与 GitHub CI 已覆盖多次原文修改、撤销/重做、Word→PDF、版本冲突、旧 V1 兼容、源文件删除清理，以及合成 DOCX 在真实 LibreOffice 渲染器下的像素版式比较。

本清单**不是授权部署到正式站**。所有真实用户数据操作均必须在既有私有服务与法律授权范围内执行。

## A. 已确认基础条件

- Cloudflare Pages 项目为 `hhba-talent`，Production branch = `main`。
- Cloudflare Preview 的 `HHBA_PNVS_AUTH_DB` 与 Production **不同**；Preview R2 为 `hhba-private-resumes-preview`，正式 R2 为独立资源。
- Preview D1 中已经存在 `hhba_candidate_resumes` 和 `hhba_resume_word_attempts`（只读检查通过）。
- GitHub Draft PR #405 已涵盖更新；**不要合并 main 或打开 Production 处理开关**。

## B. 私有渲染器上线要求

1. 在有可用账单/计算资源的容器托管环境，创建**独立 Preview 服务**，不要把服务配置在正式网站或正式数据库里。
2. 使用仓库**根目录作为 Docker build context**，Dockerfile 指向 `services/word-renderer/Dockerfile`。该镜像含 LibreOffice、Poppler、Noto CJK 与 Pillow。请勿设置 repo 根目录为 `services/word-renderer`，否则 COPY 原有文件路径会失败。
3. 配置 `HHBA_WORD_RENDER_SHARED_SECRET` 为至少 32 位的加密随机字符串，`PORT=8080`，health check `GET /health`；禁止把密钥写入 GitHub、打印在日志中或展示在前端。
4. 确保容器到外网使用 HTTPS 并仅通过 bearer 授权处理 `POST /v1/render`、`POST /v1/verify`，禁止原件公开 URL、下载目录、共享卷、真实文档日志、长期本地保留。
5. 先使用纯合成 Word 测试端口和证书，验证无密钥 401、无字体 422、版式发生位移拒绝、合法编辑 200 PDF。
6. 在 Cloudflare **仅 Preview** 环境通过安全方式增加：
   - `HHBA_WORD_RENDER_ENABLED=1`
   - `HHBA_WORD_RENDER_ENDPOINT=https://<preview-renderer-host>/`（必须 https，路径 /）
   - `HHBA_WORD_RENDER_SHARED_SECRET`（与服务端同一密钥，使用 secret_text）
   禁止把原有 Preview secrets 空值重新写回，也不得覆盖 Production 配置。
7. 从 Preview 检查 `GET /api/resume-word?action=status` 返回 `enabled:true`，未达到时保持 fail-closed。

## C. 端到端人工验收（使用专门的测试账号和虚构简历）

1. 上传 `.docx`，校验只有本人可以看到、预览、下载原始文件，其他账号不允许操作。
2. 在原 Word 中定位一段唯一文字。待确认的 Siri 彩虹效果不得进入导出文件；修改通过真实排版校验后字体和颜色与原文件相同。
3. 连续修改两处不同段落，再撤销、重做，逐版下载 DOCX 和 PDF 并检查版本文本及页数一致。
4. 在两个浏览器标签页同时编辑，后保存者应提示修订冲突而不是覆盖前者；重新载入正确恢复。
5. 测试中文字体、英文混排、表格、双栏、页眉、图片、多页（含长文）、字体缺失、超过原文宽度的安全拒绝。
6. 从真实的官方岗位匹配进入定向优化，确认的 AI 建议只预填唯一精确匹配的 Word 节点，必须再次确认。
7. 注销、跨账号和来源非法请求 401/403/404；文件更换/被删除后，所有衍生修订不可再下载。
8. 查看 Cloudflare Preview D1/R2 用量、费用、隐私说明、日志不包含原始简历、没有第三方文件公开 URL。
9. 通过后再计划独立生产渲染服务、备份/回滚、灰度开关和上线审批。

## D. 不能夸大的边界

- Word 本身包含复杂分页/字体/表格，**不能承诺任何 DOCX 经任意修改后绝对像素一致**。当前采用失败即拒绝导出的方法，而不是静默换字体。
- 单个保存操作只修改一个能唯一定位的 OOXML 文本节点；最多连续 8 个修订版本。拆分跨多个 run 的复杂段落及无限制扩写仍未支持。
- 本阶段不把重新排版的 Word 草稿当成保留原版式 Word，也不开放 PDF 原位编辑。
- 真实在线 Preview 登录、D1、R2、私有渲染器四方联调完成前，不得宣称正式上线可用。
