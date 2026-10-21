# /api/admin/growth 增加 users 段 —— 合并补丁

目标文件: `ops/legacy-marketplace/admin-console.ts`
依赖文件: `ops/legacy-marketplace/admin-growth-contract.ts`（本代码包已备好，含
unavailableUsersSection / buildUsersSection 纯函数与契约单测）
契约要点（细则见该文件头）: 增量扩展 `HHBA_PRIVATE_GROWTH_V1`，老字段一律不动；
PG 未接入/查询异常 → `users` 全 null + `quality:'unavailable'`；接入后真实 0 显示 0；
`unavailable.registeredUsers` 与 `users.registeredUsers` 始终同步（向后兼容旧前端）；
登录活跃用跨日 distinct 单独查询，禁止每日 distinct 相加。

## 现状

admin-console.ts 的 `privateGrowth(period)` 是同步函数，返回对象里写死
`unavailable:{registeredUsers:null,dau:null,mau:null,revenueCny:null}`，
路由行为 `json(privateGrowth(normalizePeriod(...)))`。下面三处改动把它升级为
「同步基座 + 异步 users 段」两层，老行为在 PG 不可用时完全复现。

## 1. 顶部 import 增补

```ts
import { unavailableUsersSection, buildUsersSection, type AdminUsersSection } from "./admin-growth-contract.ts";
```

## 2. 新增查询与组装函数（放在 privateGrowth() 之后、handlePrivateAdmin 之前）

```ts
/** users 表聚合的最小查询接口（生产装配传 pg.Pool 的 query；未配 DATABASE_URL 时传 null）。 */
export interface AdminUsersQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** 按契约执行三类查询并组装 users 段；任何异常向上抛，由调用方吞成 unavailable。 */
export async function queryAdminUsersSection(
  db: AdminUsersQueryable,
  period: { days: number; from: string; today: string },
): Promise<AdminUsersSection> {
  const total = await db.query(`SELECT COUNT(*)::int AS n FROM users WHERE status <> 'deleted'`);
  const daily = await db.query(
    `SELECT created_at::date AS day, COUNT(*)::int AS n
       FROM users WHERE status <> 'deleted'
        AND created_at::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    [period.from, period.today]);
  const activeDaily = await db.query(
    `SELECT created_at::date AS day, COUNT(DISTINCT user_id)::int AS n
       FROM auth_sessions WHERE created_at::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    [period.from, period.today]);
  const active7 = await db.query(
    `SELECT COUNT(DISTINCT user_id)::int AS n FROM auth_sessions
      WHERE created_at::date BETWEEN ($2::date - 6) AND $2`,
    [period.from, period.today]);
  const actByDay = new Map(activeDaily.rows.map((r) => [String(r.day), Number(r.n)]));
  return buildUsersSection({
    totalRegistered: Number(total.rows[0]?.n ?? 0),
    loginActive7dDistinct: Number(active7.rows[0]?.n ?? 0), // 跨日 distinct 单独查，见契约
    rows: daily.rows.map((r) => ({
      day: String(r.day), newUsers: Number(r.n), loginActive: actByDay.get(String(r.day)) ?? 0,
    })),
    period,
  });
}

/**
 * 路由用的组装层：基座照旧（同步、真实 SQLite 数据），users 段异步附加。
 * db 为 null（未启用账户库）或查询抛错 → users=unavailable，绝不让整个 growth 500。
 */
export async function privateGrowthWithUsers(
  period: { days: number; from: string; today: string },
  db: AdminUsersQueryable | null,
): Promise<Record<string, unknown>> {
  const base = privateGrowth(period) as unknown as Record<string, unknown>;
  let users = unavailableUsersSection();
  if (db) {
    try { users = await queryAdminUsersSection(db, period); }
    catch { users = unavailableUsersSection(); }
  }
  const unavailable = { ...(base.unavailable as Record<string, unknown>), registeredUsers: users.registeredUsers };
  return { ...base, users, unavailable };
}
```

## 3. 路由行替换（handlePrivateAdmin 内）

原行:

```ts
 if(path==='/api/admin/growth'&&req.method==='GET')return json(privateGrowth(normalizePeriod(url.searchParams.get('days'),new Date(),url.searchParams.get('from'),url.searchParams.get('to'))));
```

改为（`adminUsersDb` 在模块装配处按 DATABASE_URL 构造 pg.Pool 适配，未配置时为 null；
Pool 的 query 返回 {rows} 与本补丁的 AdminUsersQueryable 形状兼容）:

```ts
 if(path==='/api/admin/growth'&&req.method==='GET')return json(await privateGrowthWithUsers(normalizePeriod(url.searchParams.get('days'),new Date(),url.searchParams.get('from'),url.searchParams.get('to')), adminUsersDb));
```

装配参考（放模块顶部单例区，与 handlePrivateAdmin 同文件）:

```ts
let adminUsersDb: AdminUsersQueryable | null = null;
// 合并时在主服务启动装配处调用一次（DATABASE_URL 缺失则保持 null，后台显示未接入）:
//   adminUsersDb = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export function setAdminUsersDb(db: AdminUsersQueryable | null) { adminUsersDb = db; }
```

注: 现有 `privateGrowth()` 导出保持不变（其单测与既有行为不受影响）；dau/mau 继续返回 null，
契约用的是 `loginActive7d` 口径，不得把活跃数改名成 DAU/MAU 展示。

## 4. Dockerfile.hhba 补 COPY

在 `COPY ops/legacy-marketplace/admin-console.ts ./admin-console.ts` 后加:

```dockerfile
COPY ops/legacy-marketplace/admin-growth-contract.ts ./admin-growth-contract.ts
```

（如同时套用 auth 模块补丁，Dockerfile 还需 COPY auth/ 目录全部文件与装配所需的 pg 依赖，
以 auth-routes.ts 文件头装配说明为准，两处 COPY 清单合并去重后一次落。）

## 5. 验收（合并后）

1. 未配 DATABASE_URL: /api/admin/growth 响应含 `users.quality='unavailable'`、各项 null，
   `unavailable.registeredUsers=null`，traffic/bookmarks 与改前逐字段一致。
2. 配好 PG 且 users 表为空: `users.registeredUsers=0`（不是 null），页面显示 0 而非「未接入」。
3. 用注册入口建 2 个账户、其中 1 个再登录一次: total=2、newToday=2、loginActive7d=2
   （注册即签发会话也算一次登录活跃——口径以契约为准，前端文案写「近 7 日登录活跃账户」，
   不得写作 DAU/MAU）。
4. 人为停掉 PG 再请求: 其余指标照常返回，只有 users 段降级 unavailable，HTTP 仍 200。
