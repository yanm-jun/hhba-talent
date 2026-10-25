# HHBA 企业证据核验模块 V0.1 — 实施与上线边界

状态：**隔离分支研发 / 尚未接生产认证服务 / 不接收真实敏感材料**

## 1. 项目现状
- 本仓库 `apps/api/main.py` 目前仅有 `/healthz`。不能将 `apps/web/src/services/api.ts` 已定义的招聘接口误认为现有 FastAPI 已实现。
- 原有招聘页面 `/employer/workspace`、企业认证 `/recruiter/onboarding` 保持不变；新证据模块必须接到**同一经过验证的组织及管理员身份系统**，而不是另建账号、相信浏览器传来的用户 ID。
- GitHub Pages `/preview-employer/` 是仅用于前端验收的静态网站；`VITE_HHBA_ACCOUNT_API_ENABLED=0`、`VITE_HHBA_EVIDENCE_API_ENABLED=0`，文件选择、审核及提交按钮均不可用。
- 不会自动生成任何企业评分，更不会因上传材料直接加分。

## 2. 本次交付
- `infra/migrations/20261025_employer_evidence.sql`：加法式 PostgreSQL 迁移。企业证据、审核意见、只追加的历史流水，跨企业查询必带 `organization_id`。
- `apps/api/evidence_domain.py`：权限与审查规则、文件大小/类型校验、禁止自审和不可重复审核。
- `apps/api/evidence_store.py`：事务型 PostgreSQL 仓库；私有文件保管库，生成不透明路径，不放到 web/public/dist。
- `apps/api/evidence_routes.py`：企业上传、企业列表、受控下载、管理员待审队列、管理员审核；通过 `build_evidence_router(resolve_actor=..., repository=..., vault=...)` 注入真实会话验证器，**没有**不安全的 header/password 回退。
- `apps/web/src/pages/EmployerEvidencePage.tsx`：企业证据页 + 管理员审核队列 UI。只有独立启用的可信 API 才允许实际上传/审核。企业公开页面只看到未来允许公开的已核验结果。

## 3. 后端接入前的硬性条件（未完成）
1. 先定位并确认实际服务中的 `/api/v1/auth/me` 会话系统、CSRF、组织成员权限，以及管理员身份验证；每个请求**实时**查成员和审核权限。
2. 审核模块单独部署在上述可信后端内部，提供 `resolve_actor` 依赖，必须由服务器构造 `Principal`。不能直接信任 `X-User-ID`、`X-Org-ID`、浏览器角色声明或未经验证的 JWT。
3. 在真实业务数据库完成备份、核对迁移、执行迁移并测试回滚策略。现有 SQL 故意不建立跨数据库组织外键，部署时还需审计组织生命周期和数据归属。
4. 私有证据存储必须使用加密的持久化卷或受控私有对象存储，关闭公开静态访问，设置访问审计、异地备份、数据保留与删除策略；员工个人工资表、身份证和敏感健康数据应被避免、脱敏或另行处理。
5. **独立文件安全扫描尚未接入**：上传后 `security_status=pending_scan`；安全状态非 `clean` 时，不允许下载或通过审核。只有受信任的后台扫描服务才可更新检查结论，不能新增普通用户或管理员可直接标记 `clean` 的公开 HTTP 接口。
6. 在独立 reviewer 账号和文档安全扫描上线前，不开启 `VITE_HHBA_EVIDENCE_API_ENABLED=1`。
7. 接入严格的 rate limit、上传临时文件生命周期、恶意 PDF/图像扫描、数据最小化、企业知情同意以及可审计的删除/保留政策，且保留企业和员工的异议申请通道。

## 4. 状态约束与隐私
- 提交 → `pending_review` + `pending_scan`。扫描确认安全后独立审核方可给 `verified`；`needs_more_info`、`rejected` 会保留审核记录。
- 材料原文及二进制仅企业授权成员或独立核验人员可见。访问其他组织统一返回 404，避免泄露企业存在性。
- 上传者不得审核自己的材料，即使其有审核管理员权限。
- `hhba_evidence_reviews` 与 `hhba_evidence_audit` 使用数据库触发器禁止 UPDATE/DELETE；正式审计环境还要使用独立数据库权限与不可变备份。
- `status_updated_at` 和审核流水只记录真实状态，**不**产生虚构信誉值、善待值、员工反馈或商业订单。

## 5. 本地验收
```bash
python -m pip install -r apps/api/requirements-evidence-dev.txt
python -m unittest discover -s apps/api/tests -v
node --test apps/web/scripts/employer-evidence.contract.test.mjs
```
需 PostgreSQL 完整测试时设定隔离测试库 `HHBA_EVIDENCE_TEST_PG_DSN`；**不要**指向真实数据库。

## 6. 下一模块
员工反馈/匿名隔离 + 评分规则版本与申诉复核。需要单独的最小样本保护阈值、证据质量规则和严格的跨角色数据可见性。评分上线前继续显示「待评估」。
