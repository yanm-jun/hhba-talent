# Phase 1.2 诊断

注册的第一失败为 422：`EmailStr` 拒绝 `@example.test` 保留域。第二失败为 SQLite 返回 naive `expires_at`，与 UTC aware `now()` 比较触发 TypeError；已通过 `comparable_time` 修复。第三失败为测试管理员邮箱不等于 bootstrap 管理员邮箱，审核端点正确返回 403；测试改为同一运行 UUID 的 bootstrap 邮箱。
