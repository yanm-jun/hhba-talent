# Phase 3A.1 PostgreSQL 验证

隔离数据库：`hhba_phase3a1_test`（创建前检查名称不存在；未重置或删除开发库）。

执行：

```powershell
$env:POSTGRES_DB='hhba_phase3a1_test'
docker compose --env-file .env -f infra/compose.yaml run --rm --no-deps --user 10001:10001 -e PYTHONPATH=/srv/hhba -v "${PWD}\apps\api:/srv/hhba:ro" worker alembic upgrade head
docker compose --env-file .env -f infra/compose.yaml run --rm --no-deps --user 10001:10001 -e PYTHONPATH=/srv/hhba -v "${PWD}\apps\api:/srv/hhba:ro" worker python /srv/hhba/tests/test_phase3a1_postgres.py
```

结果：迁移到 `20261014_phase3a1_hardening (head)`；重复 `upgrade head` 成功。开发库也已升级并查询确认 `uq_consents_user_type` 与 `ix_candidate_search_projections_candidate_ref` 存在。

真实 PostgreSQL 并发结果：`consent_rows=1`，6 个并发首次成员计数均允许，接近组织上限的 6 个请求中允许 5、拒绝 1，最终组织计数 `100`。这验证了授权 UPSERT 和组织锁配额边界。
