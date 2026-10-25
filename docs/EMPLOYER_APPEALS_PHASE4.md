# HHBA 企业成长系统｜模块 08：评分异议与独立复核（开发预览）

状态：**仅隔离分支与测试数据库**。未经完整鉴权/员工资格核验/申诉管理制度批准，不接收真实案例、不公开评分、不改变 Railway。

## 模块目标
企业有权质疑自身证明材料或内部评分规则，员工可以私密反映反馈者身份风险、报复风险与资格/同意流程问题。独立复核必须保护权益，同时禁止“企业申诉立刻加分”“员工举报立刻扣分”。

## 本次交付
- `infra/migrations/20261025_employer_appeals.sql`：组织隔离的申诉表、员工申诉者分离映射表、只追加事件流水（数据库触发器拒绝修改/删除）。员工报送不接受自由文本，不存姓名、岗位、具体评论；员工信息仅记录在额外限制读取的映射表。
- `apps/api/appeals_domain.py`：企业四类争议原因，员工四类流程问题，严格状态和独立复核角色冲突校验。
- `apps/api/appeals_store.py`：只允许申诉本企业的真实证据/内部评分快照；员工每企业每季度每类问题最多一次；所有处理决议保留操作流水；企业列表只显示企业案件，员工只看本人案件；管理员队列不得返回员工身份；独立人员不能处理自己的旧审核/评分、自己提交的案件或任职企业案件。
- `apps/api/appeals_routes.py`：路由工厂，只有可信身份与员工关系 resolver 注入后才能挂载。请求体不能伪造用户身份或审核权限。
- `apps/api/scoring_store.py`：评分存储允许注入 appeal repository。企业尚有活动申诉时，新评分候选值被置为 `pending_appeal` 且数值为 null；读取旧候选快照时同样遮蔽数值；状态转变进入新指纹，下次重算另记历史。**真实接入时必须注入 appeals repository，旧评分服务未接此依赖不能上线。**
- 三个前端页面：`/employer/appeals/`、`/employee/privacy-concerns/` 和 `/admin/employer-appeals/`。个人隐私入口结构化、无文字评论，静态预览禁止提交；所有真实写入只允许安全后端及 feature flag 启用后才可操作。

## 当前状态机
- `submitted` → `needs_more_info`（可由企业补充事实说明）→ `submitted`。
- `submitted` / `needs_more_info` → `rejected`（原结论经复核维持）。
- `submitted` / `needs_more_info` → `correction_required`（独立复核认可争议，但**不会直接改分/发布/加单**）。
- `correction_required` 的最终纠正完成、第二人独立检查、评分重算及公布批准需完成后续治理和真正生产集成；当前保持 pending_appeal，不让未完成纠正的争议自动消失。
- 无真实评分公共发布能力：评分公共接口仍只返回 pending，不能因为申诉通过而直接变为 HHBA 正式认证。

## 上线前强制条件
1. 本仓库 `apps/api/main.py` 仍只有健康检查骨架：先找到并接入 HHBA 已经验证的组织、员工、管理员会话/CSRF 服务，按最新组织权限隔离读取；必须使用服务端 session 验证，不接受浏览器自报账号、权限。
2. 独立实际核实员工在职/关联关系；当前 `verify_employment` 限当前员工，离职人员纠纷及法律求助范围另需经过法务/隐私审核。
3. 安全限流、私有敏感日志去标识化、数据库只读角色隔离、正式举报响应和升级路径、监管要求、保留和删除政策都需完成；不能对企业透露员工私密案件数量。
4. 本版员工入口只受理**结构化隐私/流程异议**；不作为未核实劳动侵权事实的公开举报或法律裁决渠道。
5. 案件 `correction_required` 后的重新评估、公示复核、异议通知期、发布撤销、纠正证据以及申诉二次审核需要单独上线验收。不得绕开这些环节使分数公开。
6. 企业评分与员工善待值的规则权重仍是试点草案，不能作为正式排名、融资宣传或商业扶持资格结论。
7. 生产端必须把 scorer 构造与 appeals repository 绑定，且在业务中间件和数据层强制执行权限与审计。严格隔离 DB 凭据；静态页面仅为演示，不含员工信息。
8. `VITE_HHBA_APPEALS_API_ENABLED=0`，真实认证和独立审核未接入不得开启。

## 验收
```bash
python -m pip install -r apps/api/requirements-evidence-dev.txt
HHBA_EVIDENCE_TEST_PG_DSN=postgresql://.../isolated_test_db python -m unittest discover -s apps/api/tests -v
node --test apps/web/scripts/employer-appeals.contract.test.mjs
```
包括：真实 PostgreSQL 跨组织 IDOR、防止原审核人自审、隐私身份映射分离、申诉重复请求、状态流转、申诉暂停候选评分、纠正历史不可修改、原招聘/员工反馈回归、深链接/移动端浏览器。

下一阶段模块 09：独立核实的企业改善事实及成长时间线，不凭分数提升造假。
