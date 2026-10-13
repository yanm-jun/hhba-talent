# HHBA Phase 2.5 实施记录

日期：2026-10-14。分支：`feat/dual-entry-fullstack`。

## 实际完成

- 将未提交的双入口首页保留在新分支上；首页仍保持 HHBA.、两张入口卡和 390px 单列布局。
- 增加统一 Cookie/CSRF API Client、会话恢复、注册、登录、退出及站内安全返回地址处理。
- 求职端实现本地选择、客户端 PDF/DOCX/10MB 预校验、认证后真实上传、解析状态、规则提取结果核对、档案保存、确认、公开授权、发布和撤回 UI。
- 企业端实现自然语言需求输入、会话级未登录草稿保留、组织创建/选择、真实私密需求草稿保存与查看。明确提示人才搜索属于 Phase 3，未伪造结果。
- 新增 `HiringRequirement` 实体及 `20261014_phase25_requirements` Alembic 迁移。

## 关键文件

- `apps/api/app/main.py`
- `apps/api/migrations/env.py`
- `apps/api/migrations/versions/20261014_phase25_hiring_requirements.py`
- `apps/api/tests/test_phase25_requirements.py`
- `apps/web/src/services/api.ts`
- `apps/web/src/pages/*`、`apps/web/src/components/Shell.tsx`、`apps/web/src/router.tsx`

本阶段没有修改旧 Phase 1 / Phase 2 迁移，没有上传真实简历、调用外部模型、部署或推送远程仓库。
