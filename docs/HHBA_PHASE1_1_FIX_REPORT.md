# Phase 1.1 修复报告

原始 AssertionError 根因：原烟测将固定合成邮箱直接写入已使用的开发数据库，重复执行时注册返回 409，而断言期待 201；属于测试数据污染，不是 Cookie/CSRF 串用证据。

本轮新增：安全登出端点、成员列表/添加/移除端点、Alembic `alembic.ini` 与 `migrations/env.py`、独立迁移基线。实现仍需进一步重构并补齐测试后才能关闭 Phase 1。
