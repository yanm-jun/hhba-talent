# HHBA Frontend UX V1 实施记录

## 已修改文件

- `apps/web/src/pages/HomePage.tsx`：保留双入口结构，移除开发演示文案，修正入口描述。
- `apps/web/src/pages/CandidatePages.tsx`：拖放/选择文件、登录前暂存、任务恢复、面向用户的三阶段解析、摘要优先核对、名片三步流程、发布确认与独立授权。
- `apps/web/src/pages/EmployerPage.tsx`：两阶段“描述 → 整理需求”流程、键盘提交、会话草稿恢复、组织选择、需求时间信息与编辑。
- `apps/web/src/styles.css`：统一 token、状态卡片、响应式网格、键盘焦点、移动端布局与 reduced-motion。
- `apps/web/index.html`：正式页面 title 和描述。
- `apps/web/src/services/api.ts`：补充恢复接口类型。
- `apps/api/app/main.py`：新增本人简历列表、本人授权读取，扩展已有档案读取返回展示名称；无迁移、无授权扩张。
- `apps/api/tests/test_frontend_ux_contract.py`：合成身份的恢复与默认拒绝契约测试。

## 安全保持

上传仍需会话 + CSRF；简历读取仍按 owner 校验；公开档案仍只返回白名单字段；撤销分享仍由服务端立即清空 slug；企业需求仍用组织成员关系校验。没有改动 Docker Worker、Docling、pgvector、公开 API 或 Phase 3 搜索。

## 本地启动/复验

```powershell
Set-Location C:\Users\Lenovo\Documents\Codex\2026-10-13\hhba-hhba-phase-0-2026-10\HHBA\apps\api
..\..\.tooling\python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003

Set-Location ..\web
npm run dev -- --port 3003
```

请在停止旧 HHBA API 后再启动上述命令，确保浏览器加载新的恢复接口。不要读取、打印或提交 `.env`。
