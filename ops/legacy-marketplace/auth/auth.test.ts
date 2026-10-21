/**
 * Phase 2 认证核心规则单测 —— 运行: bun test ops/legacy-marketplace/auth/auth.test.ts
 * 覆盖任务书点名项：限流、过期、错误次数、哈希不存明文、生产禁用 mock。
 */
import { describe, test, expect } from "bun:test";
import { generateCode, hashCode, createCodeRecord, verifyCode, CODE_TTL_MS, MAX_VERIFY_ATTEMPTS } from "./sms-code.ts";
import { SmsRateLimiter, PHONE_DAILY_LIMIT, IP_HOURLY_LIMIT } from "./rate-limit.ts";
import { MockSmsProvider, AliyunSmsProvider, createSmsProvider, mapAliyunError } from "./sms-provider.ts";
import { AuthService, type AuthStore, type UserRow, type SessionRow } from "./auth-service.ts";
import type { SmsCodeRecord } from "./sms-code.ts";

const PEPPER = "test-pepper-at-least-16-chars";
const NOW = 1_800_000_000_000;
const PHONE = "13800138000";

describe("验证码生成与哈希存储", () => {
  test("生成 6 位数字（多次采样均合规）", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  test("记录中只有哈希、无明文字段，哈希不含明文码", () => {
    const rec = createCodeRecord({ pepper: PEPPER, phone: PHONE, code: "123456", nowMs: NOW });
    expect(rec.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rec)).not.toContain("123456");
    expect(rec.expiresAtMs - rec.createdAtMs).toBe(CODE_TTL_MS); // 5 分钟
    expect(rec.attempts).toBe(0);
    expect(rec.maxAttempts).toBe(MAX_VERIFY_ATTEMPTS);
  });
  test("pepper 缺失/过弱时拒绝生成哈希（不降级明文）", () => {
    expect(() => hashCode("", PHONE, "login", "123456")).toThrow();
    expect(() => hashCode("short", PHONE, "login", "123456")).toThrow();
  });
  test("同码不同手机号哈希不同（防跨号彩虹表）", () => {
    expect(hashCode(PEPPER, PHONE, "login", "123456")).not.toBe(hashCode(PEPPER, "13900139000", "login", "123456"));
  });
});

describe("验证码校验规则", () => {
  const mk = (code = "654321") => createCodeRecord({ pepper: PEPPER, phone: PHONE, code, nowMs: NOW });
  test("正确码通过且立即失效，第二次必失败", () => {
    const rec = mk();
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 1000 }).ok).toBe(true);
    expect(rec.consumedAtMs).not.toBeNull();
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 2000 })).toEqual({ ok: false, reason: "consumed" });
  });
  test("过期码失败（恰好 5 分钟边界即过期）且不消耗尝试次数", () => {
    const rec = mk();
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + CODE_TTL_MS })).toEqual({ ok: false, reason: "expired" });
    expect(rec.attempts).toBe(0);
  });
  test("错误 5 次后作废，第 6 次即使用对码也失败", () => {
    const rec = mk();
    for (let i = 0; i < 5; i++) {
      expect(verifyCode(rec, { pepper: PEPPER, candidate: "000000", nowMs: NOW + i }).ok).toBe(false);
    }
    expect(rec.attempts).toBe(5);
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 99 }).ok).toBe(false);
  });
  test("错误 4 次后正确码仍可通过", () => {
    const rec = mk();
    for (let i = 0; i < 4; i++) verifyCode(rec, { pepper: PEPPER, candidate: "111111", nowMs: NOW + i });
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 10 }).ok).toBe(true);
  });
  test("非 6 位格式按错误尝试计数，不抛异常", () => {
    const rec = mk();
    expect(verifyCode(rec, { pepper: PEPPER, candidate: "abcdef", nowMs: NOW }).ok).toBe(false);
    expect(rec.attempts).toBe(1);
  });
});

describe("发送限流", () => {
  test("60 秒内重发被拒，61 秒后放行", () => {
    const lim = new SmsRateLimiter();
    expect(lim.check(PHONE, "1.2.3.4", NOW).allowed).toBe(true);
    lim.record(PHONE, "1.2.3.4", NOW);
    const again = lim.check(PHONE, "1.2.3.4", NOW + 30_000);
    expect(again.allowed).toBe(false);
    if (!again.allowed) expect(again.reason).toBe("resend_too_soon");
    expect(lim.check(PHONE, "1.2.3.4", NOW + 61_000).allowed).toBe(true);
  });
  test("同手机号 24 小时上限", () => {
    const lim = new SmsRateLimiter();
    for (let i = 0; i < PHONE_DAILY_LIMIT; i++) lim.record(PHONE, "1.2.3.4", NOW + i * 61_000);
    const d = lim.check(PHONE, "1.2.3.4", NOW + PHONE_DAILY_LIMIT * 61_000);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("phone_daily_limit");
  });
  test("同 IP 1 小时上限（换手机号也拦）", () => {
    const lim = new SmsRateLimiter();
    for (let i = 0; i < IP_HOURLY_LIMIT; i++) lim.record(`139000000${String(i).padStart(2, "0")}`, "9.9.9.9", NOW + i * 1000);
    const d = lim.check("13700137000", "9.9.9.9", NOW + IP_HOURLY_LIMIT * 1000);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("ip_hourly_limit");
  });
});

describe("短信网关与生产防线", () => {
  test("production 环境拒绝 mock（即使显式 allow）", async () => {
    await expect(createSmsProvider({ provider: "mock", allowMock: "1", nodeEnv: "production" })).rejects.toThrow("MOCK_SMS_FORBIDDEN_IN_PRODUCTION");
  });
  test("非 production 未显式 allow 也不给 mock", async () => {
    await expect(createSmsProvider({ provider: "mock", allowMock: "0", nodeEnv: "development" })).rejects.toThrow("MOCK_SMS_NOT_EXPLICITLY_ENABLED");
  });
  test("mock 正常路径可构造且形状正确", async () => {
    const p = await createSmsProvider({ provider: "mock", allowMock: "1", nodeEnv: "test" });
    const r = await p.sendVerificationCode(PHONE, "123456");
    expect(r.ok).toBe(true); expect(r.provider).toBe("mock");
  });
  test("阿里云参数形状：手机号/签名/模板/JSON 模板变量", async () => {
    const seenBox: { req: Record<string, unknown> | null } = { req: null };
    const p = new AliyunSmsProvider(
      { accessKeyId: "id", accessKeySecret: "secret", signName: "HHBA", templateCode: "SMS_000" },
      { async sendSms(req: Record<string, unknown>) { seenBox.req = req; return { body: { code: "OK", requestId: "req-1" } }; } },
    );
    const r = await p.sendVerificationCode(PHONE, "123456");
    expect(r.ok).toBe(true); expect(r.providerRequestId).toBe("req-1");
    expect(seenBox.req).toEqual({ phoneNumbers: PHONE, signName: "HHBA", templateCode: "SMS_000", templateParam: JSON.stringify({ code: "123456" }) });
  });
  test("阿里云错误码映射到内部码", async () => {
    expect(mapAliyunError("isv.BUSINESS_LIMIT_CONTROL")).toBe("SMS_PROVIDER_RATE_LIMITED");
    expect(mapAliyunError("isv.SMS_SIGNATURE_ILLEGAL")).toBe("SMS_SIGNATURE_NOT_APPROVED");
    expect(mapAliyunError("whatever.NEW")).toBe("SMS_PROVIDER_ERROR");
    const p = new AliyunSmsProvider(
      { accessKeyId: "id", accessKeySecret: "secret", signName: "HHBA", templateCode: "SMS_000" },
      { async sendSms() { return { body: { code: "isv.AMOUNT_NOT_ENOUGH" } }; } },
    );
    const r = await p.sendVerificationCode(PHONE, "123456");
    expect(r.ok).toBe(false); expect(r.errorCode).toBe("SMS_BALANCE_INSUFFICIENT");
  });
  test("阿里云配置缺失 fail-fast", () => {
    expect(() => new AliyunSmsProvider(
      { accessKeyId: "", accessKeySecret: "s", signName: "H", templateCode: "T" },
      { async sendSms() { return {}; } },
    )).toThrow("ALIYUN_SMS_CONFIG_MISSING");
  });
});

// —— AuthService 编排：内存 store + 固定时钟，验证「注册→登录→会话→收藏隔离」闭环 ——
class MemoryStore implements AuthStore {
  users = new Map<string, UserRow>();
  codes = new Map<string, (SmsCodeRecord & { id: string })[]>();
  sessions = new Map<string, SessionRow>();
  saved = new Map<string, Set<string>>();
  logs: unknown[] = [];
  private seq = 0;
  async findUserByPhone(phone: string) { return [...this.users.values()].find((u) => u.phone === phone) ?? null; }
  async createUser(phone: string) {
    const u: UserRow = { id: `u${++this.seq}`, phone, nickname: null, accountRole: "candidate", status: "active", isAdmin: false, createdAtMs: NOW, lastLoginAtMs: null };
    this.users.set(u.id, u); return u;
  }
  async touchLastLogin(id: string, nowMs: number) { const u = this.users.get(id); if (u) u.lastLoginAtMs = nowMs; }
  async saveSmsCode(rec: SmsCodeRecord & { requestIp: string | null; sentVia: string }) {
    const arr = this.codes.get(rec.phone) ?? []; arr.push({ ...rec, id: `c${++this.seq}` }); this.codes.set(rec.phone, arr);
  }
  async latestOpenSmsCode(phone: string) {
    const arr = this.codes.get(phone) ?? [];
    return [...arr].reverse().find((c) => c.consumedAtMs === null) ?? null;
  }
  async updateSmsCode(rec: SmsCodeRecord & { id: string }) {
    const arr = this.codes.get(rec.phone) ?? [];
    const i = arr.findIndex((c) => c.id === rec.id); if (i >= 0) arr[i] = rec;
  }
  async logSmsSend(e: never) { this.logs.push(e); }
  async createSession(s: SessionRow) { this.sessions.set(s.tokenHash, s); }
  async findSessionByTokenHash(h: string) { return this.sessions.get(h) ?? null; }
  async revokeSession(id: string, nowMs: number) { for (const s of this.sessions.values()) if (s.id === id) s.revokedAtMs = nowMs; }
  async listSavedJobIds(userId: string) { return [...(this.saved.get(userId) ?? new Set<string>())]; }
  async addSavedJob(userId: string, jobId: string) { (this.saved.get(userId) ?? this.saved.set(userId, new Set()).get(userId)!).add(jobId); }
  async removeSavedJob(userId: string, jobId: string) { this.saved.get(userId)?.delete(jobId); }
}

describe("AuthService 闭环", () => {
  function build() {
    const store = new MemoryStore();
    const sent: { phone: string; code: string }[] = [];
    const sms = { name: "mock" as const, async sendVerificationCode(phone: string, code: string) { sent.push({ phone, code }); return { ok: true, provider: "mock" as const, providerRequestId: "m1", errorCode: null, rawCode: "OK" }; } };
    const nowRef = { t: NOW };
    const svc = new AuthService({ store, sms, pepper: PEPPER, sessionSecret: "session-secret-at-least-16", now: () => nowRef.t, jobExists: async (id) => id !== "missing-job" });
    return { store, svc, sent, nowRef };
  }
  test("发码→正确码注册并登录→会话可查→退出后会话失效", async () => {
    const { store, svc, sent } = build();
    await svc.sendCode(PHONE, "1.2.3.4");
    expect(sent.length).toBe(1);
    // 库中不存在明文码
    expect(JSON.stringify([...store.codes.values()])).not.toContain(sent[0].code);
    const { user, token, session } = await svc.loginWithCode(PHONE, sent[0].code);
    expect(user.phone).toBe(PHONE);
    expect(store.users.size).toBe(1);
    // 会话库存哈希而非明文 token
    expect([...store.sessions.keys()][0]).not.toBe(token);
    expect((await svc.authenticate(token))?.session.id).toBe(session.id);
    await svc.logout(session.id);
    expect(await svc.authenticate(token)).toBeNull();
  });
  test("同手机号二次登录不建新账户（唯一账户语义）", async () => {
    const { store, svc, sent, nowRef } = build();
    await svc.sendCode(PHONE, "1.2.3.4");
    await svc.loginWithCode(PHONE, sent[0].code);
    nowRef.t += 61_000; // 过重发间隔
    await svc.sendCode(PHONE, "1.2.3.4");
    await svc.loginWithCode(PHONE, sent[1].code);
    expect(store.users.size).toBe(1);
  });
  test("错码登录失败且不建账户；60 秒内重发被限流", async () => {
    const { store, svc, sent } = build();
    await svc.sendCode(PHONE, "1.2.3.4");
    await expect(svc.sendCode(PHONE, "1.2.3.4")).rejects.toThrow("SMS_RESEND_TOO_SOON");
    const wrong = sent[0].code === "000000" ? "000001" : "000000";
    await expect(svc.loginWithCode(PHONE, wrong)).rejects.toThrow("CODE_MISMATCH");
    expect(store.users.size).toBe(0);
  });
  test("两用户收藏互不可见（账户隔离）", async () => {
    const { svc, sent, nowRef } = build();
    await svc.sendCode(PHONE, "1.2.3.4");
    const a = await svc.loginWithCode(PHONE, sent[0].code);
    const phoneB = "13900139000";
    nowRef.t += 1000;
    await svc.sendCode(phoneB, "5.6.7.8");
    const b = await svc.loginWithCode(phoneB, sent[1].code);
    await svc.saveJob(a.user.id, "job-1");
    expect(await svc.listSaved(a.user.id)).toEqual(["job-1"]);
    expect(await svc.listSaved(b.user.id)).toEqual([]);
    await expect(svc.saveJob(a.user.id, "missing-job")).rejects.toThrow("JOB_NOT_IN_INDEX");
  });
  test("非法手机号在发码与登录入口都被拒", async () => {
    const { svc } = build();
    await expect(svc.sendCode("12345", "1.1.1.1")).rejects.toThrow("PHONE_INVALID");
    await expect(svc.loginWithCode("22345678901", "123456")).rejects.toThrow("PHONE_INVALID");
  });
});
