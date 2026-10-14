# HHBA Phase 3A.1 代码审查与修复

状态：PARTIAL（浏览器关键路径与自动化安全回归通过；300+ 分页专项与完整 Phase 2.6 浏览器回归未在本轮重跑）。

## 审查发现与修复

| 原位置 | 问题 | 修复 |
| --- | --- | --- |
| `Consent` / 授权写接口 | 缺少 `(user_id, consent_type)` 唯一性，竞争条件可产生相互矛盾授权。 | 新迁移添加 `uq_consents_user_type`；PostgreSQL 端点改为 `INSERT .. ON CONFLICT DO UPDATE`。 |
| `sync_search_projection()` | 自由文本能进入企业投影，可能含合成电话、邮箱、微信或细粒度地址。 | 加入允许字段转换 `projection_values()`；命中疑似联系方式或详细地址时拒绝整个字段，公开名片复用同一规则；原始简历/证据不在 allow-list。 |
| `search_reasons()` | 仅工作年限筛选没有理由，结果会被后续理由过滤移除。 | 真实已确认年限产生 `work_years` 理由。 |
| `talent_search()` | 先取最近 101 条再在 Python 排序。 | 改为 SQL 条件过滤、稳定 `(indexed_at, profile_id)` 排序、受限 OFFSET 与 `page_size + 1`。 |
| `candidate_card()` | 没有稳定的后续联系定位标识，历史迁移将内部 UUID 做确定性 MD5 映射。 | 添加随机不含个人信息的 `candidate_ref`；新迁移轮换旧 MD5 值，撤销授权仍通过查询策略拒绝访问。 |
| `consume_search_quota()` | 多成员组织总额度有读取竞争。 | 先按固定顺序锁定组织行，再读取/创建成员每日计数；真实 PostgreSQL 并发测试覆盖。 |

## 迁移前只读审计

开发库在迁移前：重复 `(user_id, consent_type)` 分组为 **0**；冲突（同一组同时 true/false）为 **0**。审计命令仅查询 `consents` 的聚合列，未输出邮箱、档案或密钥。

新增迁移：`20261014_phase3a1_hardening`。历史冲突先写入 `consent_conflict_resolutions`，再全部撤销并去重；不会“选择保留最新 true”。
