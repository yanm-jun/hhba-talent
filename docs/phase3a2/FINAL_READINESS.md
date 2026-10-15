# Phase 3A.2 就绪状态

**状态：PARTIAL。**

已完成：双业务身份后端基础、服务端统一招聘门控、企业/经办人认证数据模型及 API、私有凭证基础校验、人工复核和平台开关、独立 PostgreSQL 迁移验证、前端独立求职者/招聘方注册入口；以及可持久化的四步认证向导（企业信息、私有材料、经办人关系、提交确认）和绑定特定招聘者的邀请/接受 API。审核动作现在必须携带当前证据快照 ID 与申请版本，避免陈旧页面覆盖新证据。

最近一次定向验证：`apps/api/tests/test_phase3a2_identity_verification.py` 为 6 passed；Web production build 通过；专用 PostgreSQL 库 `hhba_phase3a2_test` 已迁移至 `20261015_phase3a2_recruiter_invitations (head)`，重复 `upgrade head` 无异常。为兼容早期基线的 `alembic_version VARCHAR(32)`，迁移启动前安全扩展其版本元数据列至 64；未触碰业务数据或历史记录。

未完成的 P0/P1：管理员审核工作台前端、成员邀请接受与复审 UI、文件安全扫描服务（当前只能记录受控人工检查状态，不能声称已完成恶意文件扫描）、真实浏览器闭环和多视口截图、全套 Phase 1–3A.1 状态化回归适配、生产运营合规材料。因此不能标记 READY，也不能进入 Phase 3B。
