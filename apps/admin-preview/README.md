# HHBA Management Console · Phase 1

这是独立的 **HHBA 内部管理后台（第一阶段）**，当前是一个仅限本机的只读可交互前端。原有 HHBA 网站、Railway 生产 Dockerfile、用户登录页面和数据库均未修改。

## 使用

需要 Node.js 22 或以上，不依赖 npm 安装：

```bash
node apps/admin-preview/server.mjs
```

然后在开发电脑打开 `http://127.0.0.1:4318/`。本服务只监听 `127.0.0.1`；其他机器无法访问。不要把此目录作为无身份认证的互联网服务直接发布。

验收：

```bash
node --test apps/admin-preview/tests/*.test.mjs
node --check apps/admin-preview/dashboard.js
```

## 已完成

- 白色简洁 SaaS 控制台：侧栏、导航、顶栏、4 张 KPI 卡、趋势占位、来源质量、投资人专用展示和移动端布局。
- 时间选择：今日、7 天、30 天及自定义日期；只改变未来历史指标的展示上下文，**不**伪造时间序列。公开招聘索引目前仅有最新快照。
- `GET /api/overview`：本机只读网关只请求固定的 HHBA 公开 `/api/jobs/page?limit=1&offset=0`，解析 `allJobs`、`boards`、`failures` 和 `updated`，附数据口径及新鲜度检查。**这些值不代表招聘合作企业数、申请转化或用户增长。**
- 源数据不可用、同步失败、快照超过 24 小时时隐藏不能支撑的核心数字，不降级为演示假数据。
- 融资展示模式和只导出真实快照的 CSV；未接入的用户指标、访问行为、营收显示 `—`。

## 尚未实现

- 正式管理员登录、角色授权（RBAC）及投资人专用访问链接。
- 真实注册、DAU/MAU、留存、搜索漏斗、岗位外链申请转化、营收与服务器成本。
- 日快照存储、趋势曲线、审计轨迹，以及写入型岗位/企业/用户管理。

以上功能不能用浏览器本地密码代替真正的服务器访问控制。未来上线时先在服务器端完成 **身份认证 + 最小权限 + 隔离只读的聚合接口 + 审计日志**，然后才允许通过管理域名访问。任何投资人数据应进一步加入授权范围、到期时间、敏感指标审核与导出审计。

## API 合约示例（展示结构，非真实数据）

```json
{
  "kind": "HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V1",
  "sourceType": "PUBLIC_INDEX_METADATA",
  "asOf": "ISO 8601 timestamp",
  "observedAt": "ISO 8601 timestamp",
  "quality": "current | partial | stale",
  "counts": {
    "indexedJobs": null,
    "successfulJobBoards": null,
    "failedJobBoards": 0
  },
  "future": {
    "totalRegisteredUsers": null,
    "activeUsers30d": null,
    "applyOutboundClicks": null,
    "revenueCny": null,
    "retention30d": null,
    "trafficSeries": null
  }
}
```

该示例中的 `null` 是未采集或无法验证，不是零。真实响应从 HHBA 当前公开索引读取，并明确标示口径、失败来源数和统计时间。
