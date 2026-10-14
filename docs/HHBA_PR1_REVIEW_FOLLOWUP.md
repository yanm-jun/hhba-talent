# PR #1 审查意见修复记录

分支：`feat/phase3a1-search-hardening`
范围：仅处理 PR #1 中的 Phase 3A.1 审查意见；不合并 `main`，不进入 Phase 3B。

## 已修复

1. **不透明候选人引用**：新建投影和初始迁移均以随机 32 位引用生成。新增 `20261014_rotate_candidate_refs` 会仅轮换历史 `md5(profile_id::text)` 值，不改动已经随机的引用。
2. **分页一致性**：数据库负责筛选、稳定排序与 `OFFSET/LIMIT page_size + 1`；应用层不再在分页之后丢弃“理由为空”的行。年限理由改为与上下界 SQL 条件相同的 AND 逻辑。
3. **最小披露**：企业投影和公开名片共享拒绝式字段保护。疑似电话、邮箱、微信、身份证号或街道级地址会使整个字段被排除，不再局部替换后继续暴露。
4. **独立授权**：`search_engine_index` 的服务端状态独立于 `public_share`；关闭公开分享不会静默改变该授权，且即使公开分享关闭，用户仍可撤销搜索引擎收录授权。

## 实际验证

- `python -m pytest tests/test_phase3a1_search_hardening.py -q`：**9 passed**。覆盖随机引用稳定性和撤销、公开/企业字段拒绝、独立授权、纯年限/同义词/混合检索解释，以及 305 条合成候选人从第 1 页遍历到第 31 页的无重复、无遗漏和末页 `has_more=false`。
- `python -m pytest tests/test_phase3a_search.py -q`：**4 passed**。
- `python -m compileall -q app migrations`：通过。
- `npm run build`（`apps/web`）：通过。
- 专用 PostgreSQL 数据库 `hhba_review_candidate_ref_test`：先升级至 `20261014_phase3a1_hardening`，插入合成历史 MD5 引用，再升级到 `head`；实测输出 `rotated=True length=32 hex=True`。随后 `alembic current` 与 `alembic heads` 均为 `20261014_rotate_candidate_refs (head)`，重复 `upgrade head` 无异常。

测试数据库只含合成记录；未删除、重建或迁移 `hhba_dev`。

## 仍不改变的结论

本次修复不替代此前 Phase 3A.1 浏览器验收中未完成的无 Cookie 上下文、浏览器文件上传/Worker 解析、企业 B/移除成员浏览器路径和完整多视口截图。因此项目的既有 READY/PARTIAL 结论必须仍以这些验收项为准。
