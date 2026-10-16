# HHBA 双入口首页与招聘引擎整合

日期：2026-10-16。主站前端仓库：`hhba-talent`。招聘数据子系统：`hhba-recruitment-engine`。

**主站 `/` 只显示两个主入口：我要招人、我要应聘。**

- 我要招人 → `/recruiter/register`：沿用真实企业/经办人认证、组织和人才需求流程。不能用普通岗位搜索代替企业招聘侧。
- 我要应聘 → `/candidate`：沿用私密简历、能力档案与授权；在应聘端内展示“查看招聘职位”，进入 `/candidate/jobs`；点击岗位进入 `/candidate/jobs/{job_id}`。

招聘页面是同一 React 应用的子页面，不再替代主站首页。它通过 `/recruitment/api/v1/jobs` 和 `/recruitment/api/v1/jobs/{id}` 读取独立招聘引擎的只读历史记录。无硬编码演示岗位，无虚构实时在招或申请入口。

## 本地联调

启动人才 API（既有默认 http://127.0.0.1:8003）。

在独立 `hhba-recruitment-engine` 仓库启动招聘引擎：

```powershell
py scripts/serve_jobs_api.py --master data/jobs_master.jsonl --host 127.0.0.1 --port 8765
```

在 `hhba-talent/apps/web` 执行：

```powershell
npm ci
npm run dev
```

然后访问 `http://127.0.0.1:3000/`。Vite 开发代理保留既有人才 API `/api` → 8003，同时将 `/recruitment/api` 只读请求代理 → 8765 的 `/api`；可通过 `VITE_RECRUITMENT_PROXY_TARGET` 更换本地招聘引擎地址。代理移除 Cookie 与 Authorization，请求客户端使用 `credentials: 'omit'`，不向招聘引擎传个人简历或账户信息。

**生产上线还需另外配置同源 HTTPS 反向代理**，仅允许 `/recruitment/api/v1/*` 的安全只读方法，移除用户凭据；Vite 的开发代理不能代替生产网关。没有网关时应聘端显示招聘数据不可用，而非虚构岗位。企业端仍使用人才系统原有认证和授权策略。

历史主库 3,545 条不能当作当前开放岗位；已采样的 5 条真实北森列表记录仍在隔离的待人工复核队列中，不可对外声称可申请。运营 `/ops` 仍属于招聘引擎本地管理界面，严禁作为 HHBA 企业首页公开。

## 检查

```powershell
cd apps/web
npm ci
npm run build
cd ../..
node scripts/verify-dual-entry.mjs
```

本轮修改只在 feature 分支，不合并未通过审查的认证与招聘子项目，且未更改历史岗位主库。