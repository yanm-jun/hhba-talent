/**
 * Phase 3 后台本地化单测 —— 运行: bun test ops/legacy-marketplace/admin-local.test.ts
 * 口径 fixture 参照主服务 Job 形状与线上量级（国内 observed 含 Xiaomi 1010 条的构成）。
 */
import { describe, test, expect } from "bun:test";
import { computeAdminJobsLocal, type IndexJobRow } from "./admin-jobs-local.ts";
import { unavailableUsersSection, buildUsersSection } from "./admin-growth-contract.ts";

function job(p: Partial<IndexJobRow>): IndexJobRow {
  return { id: "x-1", company: "Acme", title: "工程师", url: "https://example.com/j/1", platform: "greenhouse", source: "acme", domestic: false, recruitmentType: "SOCIAL", ...p };
}

describe("/api/admin/jobs 本地统计", () => {
  const sync = { available: true, states: { COMPLETE: 10, REMOVED: 3, RETRY: 2, NEEDS_REVIEW: 1 }, totalCurrent: 13, lastCheckedAt: "2026-10-21T00:00:00.000Z", failureJobs: 3 };
  test("总量/国内海外/类型/企业数与索引一致，关闭数只来自同步库", () => {
    const index = { updated: "2026-10-21T01:00:00.000Z", failures: 1, jobs: [
      job({ id: "a", company: "Xiaomi", domestic: true, recruitmentType: "CAMPUS" }),
      job({ id: "b", company: "Xiaomi", domestic: true, recruitmentType: "SOCIAL", currentApplicationVerified: true }),
      job({ id: "c", company: "OpenAI", recruitmentType: "INTERNSHIP" }),
      job({ id: "d", company: "OpenAI", recruitmentType: undefined }),
      job({ id: "e", company: "Bad", title: " ", url: "http://insecure.example.com" }), // 不可展示
    ]};
    const r = computeAdminJobsLocal(index, sync, new Date("2026-10-21T02:00:00Z"));
    expect(r.kind).toBe("HHBA_ADMIN_JOBS_LOCAL_V1");
    expect(r.quality).toBe("current");
    expect(r.counts?.total).toBe(5);
    expect(r.counts?.displayable).toBe(4);
    expect(r.counts?.domestic).toBe(2);
    expect(r.counts?.overseas).toBe(3);
    expect(r.counts?.byRecruitmentType).toEqual({ CAMPUS: 1, SOCIAL: 2, INTERNSHIP: 1, UNKNOWN: 1 });
    expect(r.counts?.companies).toBe(3);
    expect(r.counts?.closed).toBe(3);
    expect(r.counts?.pendingVerification).toBe(1); // 仅国内未确认的那条
    expect(r.counts?.syncFailures).toBe(1 + 3);     // 索引 failures + 同步 failureJobs
    expect(r.counts?.lastSyncAt).toBe("2026-10-21T01:00:00.000Z");
  });
  test("索引不可读 → unavailable + counts=null（禁止回退外部快照/编造）", () => {
    const r = computeAdminJobsLocal(null, { available: false });
    expect(r.quality).toBe("unavailable");
    expect(r.counts).toBeNull();
  });
  test("同步库缺失 → partial，closed=null（未知不是 0）", () => {
    const r = computeAdminJobsLocal({ updated: "2026-10-21T01:00:00.000Z", failures: 0, jobs: [job({})] }, { available: false });
    expect(r.quality).toBe("partial");
    expect(r.counts?.closed).toBeNull();
    expect(r.counts?.syncFailures).toBe(0); // 索引 failures 已知为 0 时不因同步缺失变 null
  });
});

describe("/api/admin/growth users 段契约", () => {
  test("未接入形态：全部 null + quality=unavailable + 空 series", () => {
    const u = unavailableUsersSection();
    expect(u.quality).toBe("unavailable");
    expect(u.registeredUsers).toBeNull();
    expect(u.series).toEqual([]);
    expect(u.scope).toBe("REGISTERED_ACCOUNTS_ONLY");
  });
  test("真实 0 用户时显示 0（与未接入严格区分）", () => {
    const u = buildUsersSection({ totalRegistered: 0, loginActive7dDistinct: 0, rows: [], period: { days: 7, from: "2026-10-15", today: "2026-10-21" } });
    expect(u.quality).toBe("collected");
    expect(u.registeredUsers).toBe(0);
    expect(u.newToday).toBe(0);
    expect(u.series.length).toBe(7);
  });
  test("新增按日聚合：today/7d/30d 与 series 一致，活跃用跨日 distinct 入参", () => {
    const rows = [
      { day: "2026-10-20", newUsers: 3, loginActive: 2 },
      { day: "2026-10-21", newUsers: 2, loginActive: 4 },
    ];
    const u = buildUsersSection({ totalRegistered: 105, loginActive7dDistinct: 9, rows, period: { days: 30, from: "2026-09-22", today: "2026-10-21" } });
    expect(u.registeredUsers).toBe(105);
    expect(u.newToday).toBe(2);
    expect(u.new7d).toBe(5);
    expect(u.new30d).toBe(5);
    expect(u.loginActive7d).toBe(9); // 不是每日 loginActive 之和（2+4=6），防口径错误
    expect(u.series.length).toBe(30);
  });
});
