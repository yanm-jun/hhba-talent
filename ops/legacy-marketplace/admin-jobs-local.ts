/**
 * /api/admin/jobs 本地化改造草案 —— Phase 3
 * 落点: ops/legacy-marketplace/admin-jobs-local.ts（合并时替换 admin-console.ts 中
 *       「fetch GitHub Pages overview.json 透传」的整段实现，鉴权/路由位置不变）
 *
 * 现状（审计已证）: 线上 /api/admin/jobs 运行时拉
 *   https://yanm-jun.github.io/hhba-talent/admin-preview/data/overview.json
 * 校验 kind=HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2 后透传——是外部静态快照，不是本服务数据，
 * 阿里云内地访问 github.io 亦不稳定。改造后全部指标只来自两处本服务数据源：
 *   1. 岗位索引 jobs.json —— 经现有 read-official-index.mjs 的 readNativeIndex("/sync-state/public-index","jobs.json")
 *      读取（与 /api/jobs/page 同一口径：线上实测 total=12775）；
 *   2. JD 同步库 overseas-jd.sqlite —— 经现有 jd-sync-store.mjs 的 coverage()（states 计数）
 *      与 jobs 表 error 列聚合（失败/待复核）。
 *
 * 真实性纪律（任务书 6.3）:
 *   - 索引里没有「已确认在招」这个事实字段：国内 observed 记录在主服务里明确标
 *     currentApplicationVerified=false / 「招聘状态待核实」。因此本接口不输出 confirmedOpen 数字，
 *     只输出 displayable（可展示）与 pendingVerification（待核验），禁止把索引总量说成在招数；
 *   - 关闭数只取 JD 同步库 state='REMOVED'（源站已下架的海外岗位），其余来源无关闭事实时为 null 而非 0 编造；
 *   - 索引不可读时整体返回 quality='unavailable' + counts=null，前端显示「数据源未接入」，绝不回退到 Pages 快照。
 */

export interface IndexJobRow {
  id?: string; company?: string; title?: string; url?: string;
  platform?: string; source?: string;
  domestic?: boolean; recruitmentType?: string;
  currentApplicationVerified?: boolean;
}
export interface OfficialIndexFile {
  jobs?: IndexJobRow[];
  updated?: string;       // 索引生成时间（readNativeIndex 的 manifest/文件内字段）
  failures?: number;      // 索引构建失败的招聘板数量（文件内字段，缺失则 null）
  boards?: number;
}
/** jd-sync-store.mjs coverage() 的返回形状（节选） + 失败聚合（合并时用一条 SQL 补齐）。 */
export interface JdSyncStats {
  available: boolean;
  states?: Record<string, number>;  // QUEUED/WORKING/TRANSLATING/COMPLETE/RETRY/NEEDS_REVIEW/REMOVED
  totalCurrent?: number;
  lastCheckedAt?: string | null;    // MAX(checked_ms)
  failureJobs?: number;             // state IN ('RETRY','NEEDS_REVIEW') 的岗位数
}

export interface AdminJobsLocal {
  kind: "HHBA_ADMIN_JOBS_LOCAL_V1";
  quality: "current" | "partial" | "unavailable";
  asOf: string;
  source: { index: "local-public-index"; indexUpdated: string | null; jdSync: "local-overseas-jd" | "unavailable" };
  counts: null | {
    total: number;            // 索引记录总数（与 /api/jobs/page 的 allJobs 同口径）
    displayable: number;      // 可展示：id/title 合法且 url 为 https —— 定义写死在此，改定义须同步前端文案
    pendingVerification: number; // 国内 observed 且未确认当前可申请（currentApplicationVerified !== true）
    closed: number | null;    // 仅 JD 同步库 REMOVED；无同步库时 null（未知，不是 0）
    domestic: number;
    overseas: number;
    byRecruitmentType: { CAMPUS: number; SOCIAL: number; INTERNSHIP: number; UNKNOWN: number };
    companies: number;        // 索引内 distinct company 数（不是「已入驻企业」，前端文案禁止混用）
    lastSyncAt: string | null;   // max(索引 updated, JD 同步 lastCheckedAt)
    syncFailures: number | null; // 索引 failures + JD 同步 failureJobs；任一来源缺失时为已知的部分和并标 partial
  };
  definitions: Record<string, string>;
}

const DEFINITIONS = {
  total: "本服务岗位索引 jobs.json 的记录总数，与 /api/jobs/page 的 allJobs 同口径",
  displayable: "id 与 title 非空且 url 为 https 的记录数；可展示不等于已确认当前在招",
  pendingVerification: "国内官方列表观测记录（招聘状态待核实），未逐条确认当前可申请",
  closed: "海外 JD 同步库中源站已下架（state=REMOVED）的岗位数；其他来源无关闭事实时为 null",
  companies: "索引中出现的企业名去重数，是岗位覆盖企业，不是已注册/已认证入驻企业",
  syncFailures: "索引构建失败板数 + JD 同步处于 RETRY/NEEDS_REVIEW 的岗位数",
};

function isDisplayable(j: IndexJobRow): boolean {
  if (!j.id || !j.title?.trim()) return false;
  try { return new URL(j.url ?? "").protocol === "https:"; } catch { return false; }
}

/** 纯函数：注入索引与同步统计即可单测。生产装配见下方 loadAdminJobsLocal()。 */
export function computeAdminJobsLocal(index: OfficialIndexFile | null, sync: JdSyncStats, now = new Date()): AdminJobsLocal {
  const base = {
    kind: "HHBA_ADMIN_JOBS_LOCAL_V1" as const,
    asOf: now.toISOString(),
    source: {
      index: "local-public-index" as const,
      indexUpdated: index?.updated ?? null,
      jdSync: (sync.available ? "local-overseas-jd" : "unavailable") as "local-overseas-jd" | "unavailable",
    },
    definitions: DEFINITIONS,
  };
  if (!index || !Array.isArray(index.jobs)) {
    return { ...base, quality: "unavailable", counts: null };
  }
  const jobs = index.jobs;
  const byType = { CAMPUS: 0, SOCIAL: 0, INTERNSHIP: 0, UNKNOWN: 0 };
  let domestic = 0, displayable = 0, pendingVerification = 0;
  const companies = new Set<string>();
  for (const j of jobs) {
    if (j.domestic) domestic += 1;
    if (isDisplayable(j)) displayable += 1;
    if (j.domestic && j.currentApplicationVerified !== true) pendingVerification += 1;
    const t = (j.recruitmentType ?? "").toUpperCase();
    if (t === "CAMPUS" || t === "SOCIAL" || t === "INTERNSHIP") byType[t] += 1; else byType.UNKNOWN += 1;
    if (j.company) companies.add(j.company);
  }
  const indexFailures = typeof index.failures === "number" ? index.failures : null;
  const syncFailures = sync.available && typeof sync.failureJobs === "number" ? sync.failureJobs : null;
  const failureKnown = indexFailures !== null || syncFailures !== null;
  const lastSyncAt = [index.updated ?? null, sync.lastCheckedAt ?? null]
    .filter((x): x is string => !!x).sort().at(-1) ?? null;
  const partial = !sync.available || indexFailures === null;
  return {
    ...base,
    quality: partial ? "partial" : "current",
    counts: {
      total: jobs.length,
      displayable,
      pendingVerification,
      closed: sync.available ? (sync.states?.REMOVED ?? 0) : null,
      domestic,
      overseas: jobs.length - domestic,
      byRecruitmentType: byType,
      companies: companies.size,
      lastSyncAt,
      syncFailures: failureKnown ? (indexFailures ?? 0) + (syncFailures ?? 0) : null,
    },
  };
}

/**
 * 生产装配（合并时放进 admin-console.ts 的 /api/admin/jobs 分支，鉴权之后）:
 *
 *   import { readNativeIndex } from "./read-official-index.mjs";
 *   import { openJobSyncStore } from "./jd-sync-store.mjs";
 *   let index: OfficialIndexFile | null = null;
 *   try {
 *     const native = await readNativeIndex("/sync-state/public-index", "jobs.json");
 *     if (native) index = JSON.parse(new TextDecoder().decode(native.bytes));
 *   } catch { index = null; }
 *   let sync: JdSyncStats = { available: false };
 *   try {
 *     const store = openJobSyncStore("/sync-state/overseas-jd.sqlite");
 *     const cov = store.coverage();
 *     const fail = store.db.query(
 *       "SELECT COUNT(*) n FROM jobs WHERE state IN ('RETRY','NEEDS_REVIEW')").get() as any;
 *     const last = store.db.query("SELECT MAX(checked_ms) m FROM jobs").get() as any;
 *     sync = { available: true, states: cov.states, totalCurrent: cov.total_current,
 *              failureJobs: Number(fail?.n ?? 0),
 *              lastCheckedAt: last?.m ? new Date(Number(last.m)).toISOString() : null };
 *     store.close();
 *   } catch { sync = { available: false }; }
 *   return json(computeAdminJobsLocal(index, sync));
 *
 * 注意：openJobSyncStore 会建表（CREATE TABLE IF NOT EXISTS），在只读巡检场景可接受；
 * 若要严格只读，改为 bun:sqlite readonly 打开后手写等价聚合 SQL（coverage 的 states 口径不得变）。
 */
export const __docOnly = true;
