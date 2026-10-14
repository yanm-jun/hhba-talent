# HHBA Phase 3A 安全测试

## 实际执行

```powershell
python -m pytest -q tests/test_frontend_ux_contract.py tests/test_phase1_p0.py tests/test_phase25_requirements.py tests/test_phase26_worker.py tests/test_phase3a_search.py -s
# 12 passed

python -m pytest -q tests/test_phase2_profile_security.py ...
# 4 passed（受本机 30 秒命令窗口限制分为两个 Docling 用例执行）
```

`test_phase3a_search.py`：4 个用例通过；`test_phase3a_postgres.py` 在专用 `hhba_phase3a_test` PostgreSQL 数据库中以容器实际执行通过。

覆盖：未登录（既有会话保护）、待审核、暂停、非成员、被移除成员；未确认档案；`public_share` 不替代 `enterprise_search`；实时撤销/陈旧投影；跨组织路径变更；CSRF；成员与组织日限流；分页上限；私密电话和解析 evidence 不出现在响应；审计不保存完整查询。

测试夹具问题已修复：Phase 2.6 的租约恢复测试完成断言后取消其合成排队任务，防止它污染后续 Docling 测试。未放宽任何生产权限或安全断言。
