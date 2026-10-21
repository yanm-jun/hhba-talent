/**
 * /api/admin/growth 增加「真实注册用户」段的接口契约 —— Phase 3
 * 落点: ops/legacy-marketplace/admin-growth-contract.ts
 *
 * 现状（admin-console.ts 的 privateGrowth()）: traffic（engagement.sqlite）与
 * bookmarks（saved.sqlite，设备级）均为真实数据；注册用户相关明确返回
 *   unavailable: { registeredUsers: null, dau: null, mau: null, revenueCny: null }
 * 前端显示「未接入」。这是诚实状态，本契约只规定「接入后长什么样」，接入前行为不变。
 *
 * 契约（在 HHBA_PRIVATE_GROWTH_V1 响应上增量扩展，老字段一律不动）:
 *   users: {
 *     quality: 'collected' | 'unavailable',       // 数据源（PostgreSQL）不可达/未启用 → 'unavailable'
 *     registeredUsers: number | null,  // users 表 status<>'deleted' 总数；仅 quality='collected' 时为数字（可为真实 0）
 *     newToday / new7d / new30d: number | null,   // 按 created_at 的 UTC 日切分，与 traffic 的 UTC 口径一致
 *     loginActive7d: number | null,    // 近 7 日有成功登录（auth_sessions 新建）的 distinct user 数；不叫 DAU/MAU 防口径混用
 *     series: { date, newUsers, loginActive }[] | [],  // 与 traffic.series 同区间同粒度，前端可同图叠加
 *     scope: 'REGISTERED_ACCOUNTS_ONLY'  // 演示账户/设备访客永不计入，字面量写死防误读
 *   }
 *   unavailable.registeredUsers 保留并与 users.registeredUsers 同步（向后兼容旧前端），二者不得出现一有一无。
 *
 * 禁止事项落实：数据源未接入时继续返回 null + quality='unavailable'，任何情况下不许用
 * 设备数、PV 或估算值填充注册用户数字（任务书 6.3 / 禁止事项 4）。
 *
 * 生产查询（PostgreSQL，合并时在 privateGrowth 的 PG 分支执行；$1=from, $2=today，UTC 日期）:
 *   total:      SELECT COUNT(*) FROM users WHERE status <> 'deleted';
 *   new per day:SELECT created_at::date AS day, COUNT(*) FROM users
 *                WHERE status <> 'deleted' AND created_at::date BETWEEN $1 AND $2 GROUP BY 1;
 *   active:     SELECT created_at::date AS day, COUNT(DISTINCT user_id) FROM auth_sessions
 *                WHERE created_at::date BETWEEN $1 AND $2 GROUP BY 1;  （loginActive7d = 区间求和前的 distinct 口径见定义，
 *                跨日 distinct 须单独查 COUNT(DISTINCT user_id) over 区间，不得把每日 distinct 相加冒充）
 */

export interface AdminUsersSection {
  quality: "collected" | "unavailable";
  registeredUsers: number | null;
  newToday: number | null;
  new7d: number | null;
  new30d: number | null;
  loginActive7d: number | null;
  series: { date: string; newUsers: number; loginActive: number }[];
  scope: "REGISTERED_ACCOUNTS_ONLY";
}

/** 数据源未接入时的唯一合法形态。Phase 2 上线前，/api/admin/growth 应原样并入此段。 */
export function unavailableUsersSection(): AdminUsersSection {
  return {
    quality: "unavailable",
    registeredUsers: null, newToday: null, new7d: null, new30d: null, loginActive7d: null,
    series: [], scope: "REGISTERED_ACCOUNTS_ONLY",
  };
}

export interface UsersDailyRaw { day: string; newUsers: number; loginActive: number }

/** 由 PG 日粒度查询结果组装 users 段（纯函数，可单测）。rows 覆盖区间内有数据的日期即可，缺日补 0。 */
export function buildUsersSection(args: {
  totalRegistered: number;
  loginActive7dDistinct: number; // 单独查的跨日 distinct，禁止用每日之和代替
  rows: UsersDailyRaw[];
  period: { days: number; from: string; today: string };
}): AdminUsersSection {
  const byDay = new Map(args.rows.map((r) => [r.day, r]));
  const series: AdminUsersSection["series"] = [];
  for (let i = 0; i < args.period.days; i++) {
    const day = new Date(Date.parse(args.period.from + "T00:00:00Z") + i * 86400_000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    series.push({ date: day, newUsers: r?.newUsers ?? 0, loginActive: r?.loginActive ?? 0 });
  }
  const sumNew = (n: number) => series.slice(-n).reduce((s, r) => s + r.newUsers, 0);
  return {
    quality: "collected",
    registeredUsers: args.totalRegistered,
    newToday: series.at(-1)?.newUsers ?? 0,
    new7d: sumNew(Math.min(7, args.period.days)),
    new30d: sumNew(Math.min(30, args.period.days)),
    loginActive7d: args.loginActive7dDistinct,
    series,
    scope: "REGISTERED_ACCOUNTS_ONLY",
  };
}

/**
 * 合并进现有 privateGrowth() 返回值的参考实现（合并时调用）:
 *   const base = privateGrowth(period);               // 现有函数，行为不变
 *   let users = unavailableUsersSection();
 *   if (authDbEnabled) { try { users = buildUsersSection(await queryUsers(pg, period)); } catch { users = unavailableUsersSection(); } }
 *   return { ...base, users, unavailable: { ...base.unavailable, registeredUsers: users.registeredUsers } };
 * PG 查询异常必须吞成 unavailable（后台其余真实指标照常展示），不得让整个 /api/admin/growth 500。
 */
export const __docOnly = true;
