# HHBA 原管理后台整合｜第一阶段验收（2026-10-25）

本次只升级 **已有的** `ops/legacy-marketplace/admin-ui/`（Railway `/management/`），不是新建第二套管理后台。部署状态：**独立开发分支，未修改 Railway 正式服务**。

## 保留的原有能力
- 原密码保护的管理员会话、Cookie、同源防护、登录限流、退出。
- `/api/admin/jobs` 已核实公开岗位快照；`/api/admin/growth` 同意采集的 PV、按日 UV 合计、搜索、申请外链点击和设备收藏。
- 原「数据总览」「访问与收藏」「融资展示」视图、筛选日期、原 CSV 导出和统计口径。
- 原 HHBA 招聘前端、首页、海外岗位数据库及已有企业预览路径。

## 本次新增
- **同一侧栏**：「招聘业务」「企业档案」「审核待办」「证据核验」「员工关怀」「双评分审核」「申诉复核」「企业改善核验」「公开评分审批」「企业帮扶审批」「客户对接与订单核验」。
- 新统一企业档案导航：同一家企业未来进入各业务模块的聚合入口。暂不伪造企业名称、认证状态或私人业务记录。
- 新统一审核待办中心：八类业务按固定分类组织，随导航切换到对应工作区。未接入真实队列时保持「— / 未接入」，不能误报 0 待办。
- 新受保护的 `GET /api/admin/workspace`：只返回模块**连接状态及 null 计数**，与原 Railway 密码保护一致；不包含员工、企业、客户原始数据和审批权限，不允许任何写入。静态资产 `unified-workbench.js/.css` 仅由原 `/management/` 服务提供。
- 原仪表盘不变，仅扩展 nav handler 及重新刷新时检查私有模块目录；移动端导航仍使用原折叠机制。
- 后续对每个企业只能通过服务器授权的组织级读取聚合，不经未授权公共页面访问私密案卷。

## 现在尚未完成（不能误报）
1. 第 05—12 模块目前为隔离分支 PostgreSQL 业务原型，未接原 Railway 运营服务的真实统一组织身份和角色管理体系。`/api/admin/workspace` 报告 `not_connected`，**不是**企业统计 API。
2. 原 `/management/` 使用单一管理员密码，并非能执行多审核员回避的生产 RBAC。**不能**把这个密码当作证据核验、评分发布、员工隐私处理、帮扶审核、订单确认的授权凭据。
3. 等待真实员工关系核验、客户同意凭证、安全附件存储、企业组织授权、CSRF、数据库角色隔离、审计制度就绪后，再按模块接入**可验证数据**与真实审核按钮。
4. 审核待办数量、认证企业数量、帮扶总量、成交订单及营收未接入；现在显示「— / 待接入」而不是 0 或演示数字。
5. 不能将当前只读整合叫作「第 05—12 模块已连入正式生产数据库」。真实上线还需要细粒度角色认证、独立业务 API、保密和合规验收。

## 安全边界
- 前端**无**信用评分审核、员工反馈查看、申请批准或订单确认的真实写操作。
- 后端仅提供经过原 session 授权的工作区连接状态；`/api/admin/workspace/...` 写入路径继续返回 404。
- 无跨源客户数据请求，所有工作区导航保持在原受保护 `/management/` 内。
- 静态 JS 不注入从服务器返回的未净化 HTML，暂无敏感数据 payload；CSP 仍限制为同源脚本和请求。
- 开发分支上的更改未部署 Railway，未改线上企业数据或原招聘索引。

## 测试
- `node --check ops/legacy-marketplace/admin-ui/dashboard.js`
- `node --check ops/legacy-marketplace/admin-ui/unified-workbench.js`
- `node --test ops/legacy-marketplace/tests/unified-workbench.contract.test.mjs`
- `bun test ops/legacy-marketplace/tests/admin-console.test.ts`
- `bun test ops/legacy-marketplace/tests/unified-workbench.auth.test.ts`
- `npm ci && npm run build` in `apps/web`
- `.github/workflows/hhba-unified-admin-workbench.yml` 自动验证，全绿后即可审查。

**下一步推荐优先级**：先梳理现有正式组织与招聘鉴权，统一后台角色/认证，再为企业列表、审批队列增加第一批真实只读租户隔离聚合数据。之后接入各审核流程的有权限写操作，而不是直接用管理员密码开启按钮。
