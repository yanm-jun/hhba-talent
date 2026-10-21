/**
* Phase 2 认证核心规则单测 —— 运行: bun test ops/legacy-marketplace/auth/auth.test.ts
* 覆盖：限流、过期、错误次数、哈希不存明文、生产禁用 mock，
* 以及（2026-10-21 用户拍板）:
* 发码与验码双道注册状态门、验证码 purpose 绑定与跨用途失败、登录路径零建号。
*/
import { describe, test, expect} from "bun:test";
import { generateCode, hashCode, createCodeRecord, verifyCode, CODE_TTL_MS, MAX_VERIFY_ATTEMPTS} from "./sms-code.ts";
import { SmsRateLimiter, PHONE_DAILY_LIMIT, IP_HOURLY_LIMIT} from "./rate-limit.ts";
import { MockSmsProvider, AliyunSmsProvider, createSmsProvider, mapAliyunError} from "./sms-provider.ts";
import { AuthService, type AuthStore, type UserRow, type SessionRow} from "./auth-service.ts";
import { buildAuthHandler} from "./auth-routes.ts";
import type { SmsCodeRecord, SmsPurpose} from "./sms-code.ts";

const PEPPER = "test-pepper-at-least-16-chars";
const NOW = 1_800_000_000_000;
const PHONE = "13800138000";

describe("验证码生成与哈希存储", () => {
test("生成 6 位数字（多次采样均合规）", () => {
for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
});
test("记录中只有哈希、无明文字段，哈希不含明文码", () => {
const rec = createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "login", code: "123456", nowMs: NOW});
expect(rec.codeHash).toMatch(/^[a-f0-9]{64}$/);
expect(JSON.stringify(rec)).not.toContain("123456");
expect(rec.expiresAtMs - rec.createdAtMs).toBe(CODE_TTL_MS); // 5 分钟
expect(rec.attempts).toBe(0);
expect(rec.maxAttempts).toBe(MAX_VERIFY_ATTEMPTS);
expect(rec.purpose).toBe("login");
});
test("pepper 缺失/过弱时拒绝生成哈希（不降级明文）", () => {
expect(() => hashCode("", PHONE, "login", "123456")).toThrow();
expect(() => hashCode("short", PHONE, "login", "123456")).toThrow();
});
test("同码不同手机号哈希不同（防跨号彩虹表）", () => {
expect(hashCode(PEPPER, PHONE, "login", "123456")).not.toBe(hashCode(PEPPER, "13900139000", "login", "123456"));
});
});

describe("验证码用途绑定（纯逻辑层）", () => {
test("purpose 必填：缺失或非法用途构造记录直接抛错（无默认用途）", () => {
expect(() => createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: undefined as unknown as SmsPurpose, code: "123456", nowMs: NOW})).toThrow("SMS_PURPOSE_INVALID");
expect(() => createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "reset" as unknown as SmsPurpose, code: "123456", nowMs: NOW})).toThrow("SMS_PURPOSE_INVALID");
expect(() => hashCode(PEPPER, PHONE, "reset" as unknown as SmsPurpose, "123456")).toThrow("SMS_PURPOSE_INVALID");
});
test("同手机号同码，register 与 login 的哈希不同（哈希含用途）", () => {
expect(hashCode(PEPPER, PHONE, "register", "123456")).not.toBe(hashCode(PEPPER, PHONE, "login", "123456"));
});
test("register 码拿到 login 校验：用途断言失败，且不消耗次数、不作废原码", () => {
const rec = createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "register", code: "654321", nowMs: NOW});
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 1000, expectedPurpose: "login"}))
.toEqual({ ok: false, reason: "purpose_mismatch"});
expect(rec.attempts).toBe(0);
expect(rec.consumedAtMs).toBeNull();
// 原用途下仍可正常使用
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 2000, expectedPurpose: "register"}).ok).toBe(true);
});
test("即使不传 expectedPurpose，跨用途也失败：哈希按记录用途计算，对不上就是错码", () => {
const rec = createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "register", code: "654321", nowMs: NOW});
// 模拟错误装配：拿 register 的码当 login 校验（用 login 用途重算哈希必然不同）
const asLogin = {...rec, purpose: "login" as SmsPurpose};
expect(verifyCode(asLogin, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 1000}).ok).toBe(false);
});
});

describe("验证码校验规则", () => {
const mk = (code = "654321") => createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "login", code, nowMs: NOW});
test("正确码通过且立即失效，第二次必失败", () => {
const rec = mk();
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 1000}).ok).toBe(true);
expect(rec.consumedAtMs).not.toBeNull();
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 2000})).toEqual({ ok: false, reason: "consumed"});
});
test("过期码失败（恰好 5 分钟边界即过期）且不消耗尝试次数", () => {
const rec = mk();
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + CODE_TTL_MS})).toEqual({ ok: false, reason: "expired"});
expect(rec.attempts).toBe(0);
});
test("错误 5 次后作废，第 6 次即使用对码也失败", () => {
const rec = mk();
for (let i = 0; i < 5; i++) {
expect(verifyCode(rec, { pepper: PEPPER, candidate: "000000", nowMs: NOW + i}).ok).toBe(false);
}
expect(rec.attempts).toBe(5);
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 99}).ok).toBe(false);
});
test("错误 4 次后正确码仍可通过", () => {
const rec = mk();
for (let i = 0; i < 4; i++) verifyCode(rec, { pepper: PEPPER, candidate: "111111", nowMs: NOW + i});
expect(verifyCode(rec, { pepper: PEPPER, candidate: "654321", nowMs: NOW + 10}).ok).toBe(true);
});
test("非 6 位格式按错误尝试计数，不抛异常", () => {
const rec = mk();
expect(verifyCode(rec, { pepper: PEPPER, candidate: "abcdef", nowMs: NOW}).ok).toBe(false);
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
await expect(createSmsProvider({ provider: "mock", allowMock: "1", nodeEnv: "production"})).rejects.toThrow("MOCK_SMS_FORBIDDEN_IN_PRODUCTION");
});
test("非 production 未显式 allow 也不给 mock", async () => {
await expect(createSmsProvider({ provider: "mock", allowMock: "0", nodeEnv: "development"})).rejects.toThrow("MOCK_SMS_NOT_EXPLICITLY_ENABLED");
});
test("mock 正常路径可构造且形状正确", async () => {
const p = await createSmsProvider({ provider: "mock", allowMock: "1", nodeEnv: "test"});
const r = await p.sendVerificationCode(PHONE, "123456");
expect(r.ok).toBe(true); expect(r.provider).toBe("mock");
});
test("阿里云参数形状：手机号/签名/模板/JSON 模板变量", async () => {
const seenBox: { req: Record<string, unknown> | null} = { req: null};
const p = new AliyunSmsProvider(
{ accessKeyId: "id", accessKeySecret: "secret", signName: "HHBA", templateCode: "SMS_000"},
{ async sendSms(req: Record<string, unknown>) { seenBox.req = req; return { body: { code: "OK", requestId: "req-1"}};}},
);
const r = await p.sendVerificationCode(PHONE, "123456");
expect(r.ok).toBe(true); expect(r.providerRequestId).toBe("req-1");
expect(seenBox.req).toEqual({ phoneNumbers: PHONE, signName: "HHBA", templateCode: "SMS_000", templateParam: JSON.stringify({ code: "123456"})});
});
test("阿里云错误码映射到内部码", async () => {
expect(mapAliyunError("isv.BUSINESS_LIMIT_CONTROL")).toBe("SMS_PROVIDER_RATE_LIMITED");
expect(mapAliyunError("isv.SMS_SIGNATURE_ILLEGAL")).toBe("SMS_SIGNATURE_NOT_APPROVED");
expect(mapAliyunError("whatever.NEW")).toBe("SMS_PROVIDER_ERROR");
const p = new AliyunSmsProvider(
{ accessKeyId: "id", accessKeySecret: "secret", signName: "HHBA", templateCode: "SMS_000"},
{ async sendSms() { return { body: { code: "isv.AMOUNT_NOT_ENOUGH"}};}},
);
const r = await p.sendVerificationCode(PHONE, "123456");
expect(r.ok).toBe(false); expect(r.errorCode).toBe("SMS_BALANCE_INSUFFICIENT");
});
test("阿里云配置缺失 fail-fast", () => {
expect(() => new AliyunSmsProvider(
{ accessKeyId: "", accessKeySecret: "s", signName: "H", templateCode: "T"},
{ async sendSms() { return {};}},
)).toThrow("ALIYUN_SMS_CONFIG_MISSING");
});
});

// —— AuthService 编排：内存 store + 固定时钟，验证双入口分开的全部语义 ——
class MemoryStore implements AuthStore {
users = new Map<string, UserRow>();
codes = new Map<string, (SmsCodeRecord & { id: string})[]>();
sessions = new Map<string, SessionRow>();
saved = new Map<string, Set<string>>();
logs: Parameters<AuthStore["logSmsSend"]>[0][] = [];
insertCalls = 0; // 建号原语被调用次数：登录路径必须全程为 0 增量
private seq = 0;
async findUserByPhone(phone: string) { return [...this.users.values()].find((u) => u.phone === phone)?? null;}
async insertNewUserForRegister(phone: string) {
this.insertCalls += 1;
const u: UserRow = {
id: `u${++this.seq}`, phone, nickname: null, accountRole: "candidate", status: "active",
isAdmin: false, createdAtMs: NOW, lastLoginAtMs: null, registeredFrom: "register",
};
this.users.set(u.id, u); return u;
}
async touchLastLogin(id: string, nowMs: number) { const u = this.users.get(id); if (u) u.lastLoginAtMs = nowMs;}
async saveSmsCode(rec: SmsCodeRecord & { requestIp: string | null; sentVia: string}) {
const arr = this.codes.get(rec.phone)?? []; arr.push({...rec, id: `c${++this.seq}`}); this.codes.set(rec.phone, arr);
}
async latestOpenSmsCode(phone: string, purpose: SmsPurpose) {
const arr = this.codes.get(phone)?? [];
// 按用途取码：与 PgAuthStore 的 WHERE phone=$1 AND purpose=$2 同语义
return [...arr].reverse().find((c) => c.consumedAtMs === null && c.purpose === purpose)?? null;
}
async updateSmsCode(rec: SmsCodeRecord & { id: string}) {
const arr = this.codes.get(rec.phone)?? [];
const i = arr.findIndex((c) => c.id === rec.id); if (i >= 0) arr[i] = rec;
}
async logSmsSend(e: Parameters<AuthStore["logSmsSend"]>[0]) { this.logs.push(e);}
async createSession(s: SessionRow) { this.sessions.set(s.tokenHash, s);}
async findSessionByTokenHash(h: string) { return this.sessions.get(h)?? null;}
async revokeSession(id: string, nowMs: number) { for (const s of this.sessions.values()) if (s.id === id) s.revokedAtMs = nowMs;}
async listSavedJobIds(userId: string) { return [...(this.saved.get(userId)?? new Set<string>())];}
async addSavedJob(userId: string, jobId: string) { (this.saved.get(userId)?? this.saved.set(userId, new Set()).get(userId)!).add(jobId);}
async removeSavedJob(userId: string, jobId: string) { this.saved.get(userId)?.delete(jobId);}
}

function build() {
const store = new MemoryStore();
const sent: { phone: string; code: string}[] = [];
const sms = { name: "mock" as const, async sendVerificationCode(phone: string, code: string) { sent.push({ phone, code}); return { ok: true, provider: "mock" as const, providerRequestId: "m1", errorCode: null, rawCode: "OK"};}};
const nowRef = { t: NOW};
const svc = new AuthService({ store, sms, pepper: PEPPER, sessionSecret: "session-secret-at-least-16", now: () => nowRef.t, jobExists: async (id) => id!== "missing-job"});
return { store, svc, sent, nowRef};
}
/** 走完一次完整注册（register 发码 → register 验码建号），返回 AuthSuccess。 */
async function registerFully(ctx: ReturnType<typeof build>, phone = PHONE, ip = "1.2.3.4") {
const before = ctx.sent.length;
await ctx.svc.sendCode(phone, "register", ip);
return ctx.svc.registerWithCode(phone, ctx.sent[before].code);
}

describe("注册入口", () => {
test("全流程：register 发码→验码建号（来源=register）→会话可查→退出后失效", async () => {
const { store, svc, sent} = build();
const { user, token, session} = await registerFully({ store, svc, sent, nowRef: { t: NOW}});
expect(user.phone).toBe(PHONE);
expect(user.registeredFrom).toBe("register");
expect(user.createdAtMs).toBe(NOW);
expect(store.users.size).toBe(1);
expect(store.insertCalls).toBe(1);
// 库中不存在明文码
expect(JSON.stringify([...store.codes.values()])).not.toContain(sent[0].code);
// 落库的码记录用途是 register
expect([...store.codes.values()][0][0].purpose).toBe("register");
// 会话库存哈希而非明文 token
expect([...store.sessions.keys()][0]).not.toBe(token);
expect((await svc.authenticate(token))?.session.id).toBe(session.id);
await svc.logout(session.id);
expect(await svc.authenticate(token)).toBeNull();
});
test("已注册号走 register 发码：被拒、不发短信、不落新码", async () => {
const ctx = build();
await registerFully(ctx);
ctx.nowRef.t += 61_000;
const sentBefore = ctx.sent.length;
const codesBefore = [...ctx.store.codes.values()].flat().length;
await expect(ctx.svc.sendCode(PHONE, "register", "1.2.3.4")).rejects.toThrow("PHONE_ALREADY_REGISTERED");
expect(ctx.sent.length).toBe(sentBefore); // 网关没被调用
expect([...ctx.store.codes.values()].flat().length).toBe(codesBefore); // 没有新码落库
expect(ctx.store.users.size).toBe(1);
expect(ctx.store.insertCalls).toBe(1);
});
test("已注册号绕过发码直接 register 验码：验码门再拒一次（双保险），且不建第二个号", async () => {
const ctx = build();
await registerFully(ctx);
await expect(ctx.svc.registerWithCode(PHONE, "123456")).rejects.toThrow("PHONE_ALREADY_REGISTERED");
expect(ctx.store.users.size).toBe(1);
expect(ctx.store.insertCalls).toBe(1);
});
test("注册错码失败且不建号；60 秒内重发被限流", async () => {
const { store, svc, sent} = build();
await svc.sendCode(PHONE, "register", "1.2.3.4");
await expect(svc.sendCode(PHONE, "register", "1.2.3.4")).rejects.toThrow("SMS_RESEND_TOO_SOON");
const wrong = sent[0].code === "000000"? "000001": "000000";
await expect(svc.registerWithCode(PHONE, wrong)).rejects.toThrow("CODE_MISMATCH");
expect(store.users.size).toBe(0);
expect(store.insertCalls).toBe(0);
});
});

describe("登录入口（未注册不能登录、且永不建号）", () => {
test("未注册号走 login 发码：被拒、不发短信、不落码、不建号", async () => {
const { store, svc, sent} = build();
await expect(svc.sendCode(PHONE, "login", "1.2.3.4")).rejects.toThrow("PHONE_NOT_REGISTERED");
expect(sent.length).toBe(0);
expect(store.codes.get(PHONE)?? []).toEqual([]);
expect(store.users.size).toBe(0);
expect(store.insertCalls).toBe(0);
// 拒绝有对账日志（status=rejected）
expect(store.logs.some((l) => l.errorCode === "PHONE_NOT_REGISTERED" && l.status === "rejected")).toBe(true);
});
test("未注册号绕过发码直接 login 验码：验码门再拒一次（双保险），用户数不变", async () => {
const { store, svc} = build();
await expect(svc.loginWithCode(PHONE, "123456")).rejects.toThrow("PHONE_NOT_REGISTERED");
expect(store.users.size).toBe(0);
expect(store.insertCalls).toBe(0);
expect(store.sessions.size).toBe(0);
});
test("注册成功后 login 全流程成功：不建新号、更新 last_login_at", async () => {
const ctx = build();
const reg = await registerFully(ctx);
await ctx.svc.logout(reg.session.id);
ctx.nowRef.t += 61_000;
const sentBefore = ctx.sent.length;
await ctx.svc.sendCode(PHONE, "login", "1.2.3.4");
const { user, token} = await ctx.svc.loginWithCode(PHONE, ctx.sent[sentBefore].code);
expect(user.id).toBe(reg.user.id); // 同一个账户
expect(ctx.store.users.size).toBe(1);
expect(ctx.store.insertCalls).toBe(1); // 登录全程没有新增建号调用
expect(user.lastLoginAtMs).toBe(ctx.nowRef.t);
expect((await ctx.svc.authenticate(token))?.user.id).toBe(reg.user.id);
});
test("login 错码失败，不建号、不签发会话", async () => {
const ctx = build();
await registerFully(ctx);
ctx.nowRef.t += 61_000;
const sentBefore = ctx.sent.length;
await ctx.svc.sendCode(PHONE, "login", "1.2.3.4");
const code = ctx.sent[sentBefore].code;
const wrong = code === "000000"? "000001": "000000";
const sessionsBefore = ctx.store.sessions.size;
await expect(ctx.svc.loginWithCode(PHONE, wrong)).rejects.toThrow("CODE_MISMATCH");
expect(ctx.store.users.size).toBe(1);
expect(ctx.store.insertCalls).toBe(1);
expect(ctx.store.sessions.size).toBe(sessionsBefore);
});
});

describe("验证码跨用途使用必须失败", () => {
test("未注册号的 register 码拿去 login：先被登录状态门拒；且不消耗该码，随后注册仍可完成", async () => {
const ctx = build();
await ctx.svc.sendCode(PHONE, "register", "1.2.3.4");
const registerCode = ctx.sent[0].code;
await expect(ctx.svc.loginWithCode(PHONE, registerCode)).rejects.toThrow("PHONE_NOT_REGISTERED");
expect(ctx.store.users.size).toBe(0);
// 码没有被登录尝试消耗掉
const rec = [...ctx.store.codes.values()][0][0];
expect(rec.consumedAtMs).toBeNull();
const { user} = await ctx.svc.registerWithCode(PHONE, registerCode);
expect(user.phone).toBe(PHONE);
expect(ctx.store.users.size).toBe(1);
});
test("已注册用户残留的 register 码拿去 login 验码：按用途取码查无此码，失败且不消耗", async () => {
const ctx = build();
await registerFully(ctx);
// 人工构造一条 register 用途的未消费码（模拟状态门之外残留的注册码）
const leftover = createCodeRecord({ pepper: PEPPER, phone: PHONE, purpose: "register", code: "246810", nowMs: ctx.nowRef.t});
await ctx.store.saveSmsCode({...leftover, requestIp: "1.2.3.4", sentVia: "mock"});
await expect(ctx.svc.loginWithCode(PHONE, "246810")).rejects.toThrow("CODE_NOT_FOUND_OR_EXPIRED");
const rec = [...ctx.store.codes.values()].flat().find((c) => c.purpose === "register" && c.consumedAtMs === null);
expect(rec).toBeDefined();
expect(rec!.attempts).toBe(0); // 登录路径没有消耗 register 码的尝试次数
});
test("login 码拿去 register 验码：已被注册状态门拒（已注册），未注册场景下 register 也取不到 login 码", async () => {
const ctx = build();
await registerFully(ctx);
ctx.nowRef.t += 61_000;
const sentBefore = ctx.sent.length;
await ctx.svc.sendCode(PHONE, "login", "1.2.3.4");
const loginCode = ctx.sent[sentBefore].code;
await expect(ctx.svc.registerWithCode(PHONE, loginCode)).rejects.toThrow("PHONE_ALREADY_REGISTERED");
expect(ctx.store.users.size).toBe(1);
expect(ctx.store.insertCalls).toBe(1);
});
});

describe("账户收藏隔离（双入口注册的两个用户）", () => {
test("两用户收藏互不可见", async () => {
const ctx = build();
const a = await registerFully(ctx, PHONE, "1.2.3.4");
const phoneB = "13900139000";
ctx.nowRef.t += 1000;
const b = await registerFully(ctx, phoneB, "5.6.7.8");
await ctx.svc.saveJob(a.user.id, "job-1");
expect(await ctx.svc.listSaved(a.user.id)).toEqual(["job-1"]);
expect(await ctx.svc.listSaved(b.user.id)).toEqual([]);
await expect(ctx.svc.saveJob(a.user.id, "missing-job")).rejects.toThrow("JOB_NOT_IN_INDEX");
});
test("非法手机号/非法用途在发码与两个验码入口都被拒", async () => {
const { svc} = build();
await expect(svc.sendCode("12345", "login", "1.1.1.1")).rejects.toThrow("PHONE_INVALID");
await expect(svc.sendCode(PHONE, "reset" as unknown as SmsPurpose, "1.1.1.1")).rejects.toThrow("SMS_PURPOSE_INVALID");
await expect(svc.loginWithCode("22345678901", "123456")).rejects.toThrow("PHONE_INVALID");
await expect(svc.registerWithCode("22345678901", "123456")).rejects.toThrow("PHONE_INVALID");
});
});

describe("HTTP 路由双入口", () => {
function buildHandler() {
const ctx = build();
const handle = buildAuthHandler(ctx.svc, {
validOrigin: () => true, sessionSecret: "session-secret-at-least-16", clientIp: () => "1.2.3.4",
});
const post = async (path: string, body: unknown) => {
const req = new Request(`http://localhost${path}`, {
method: "POST", headers: { "Content-Type": "application/json"}, body: JSON.stringify(body),
});
return handle(req, new URL(req.url));
};
return {...ctx, post};
}
test("sms/send 缺 purpose → 400 SMS_PURPOSE_INVALID", async () => {
const { post} = buildHandler();
const r = await post("/api/v1/auth/sms/send", { phone: PHONE});
expect(r!.status).toBe(400);
expect((await r!.json() as { error: string}).error).toBe("SMS_PURPOSE_INVALID");
});
test("sms/send purpose=login 且未注册 → 400 PHONE_NOT_REGISTERED，不建号", async () => {
const { post, store} = buildHandler();
const r = await post("/api/v1/auth/sms/send", { phone: PHONE, purpose: "login"});
expect(r!.status).toBe(400);
expect((await r!.json() as { error: string}).error).toBe("PHONE_NOT_REGISTERED");
expect(store.users.size).toBe(0);
});
test("HTTP 全链路：register 发码→/register 建号 201→/login 发码→/login 200；重复 /register → 409", async () => {
const { post, sent, nowRef} = buildHandler();
let r = await post("/api/v1/auth/sms/send", { phone: PHONE, purpose: "register"});
expect(r!.status).toBe(200);
r = await post("/api/v1/auth/register", { phone: PHONE, code: sent[0].code});
expect(r!.status).toBe(201);
expect(r!.headers.get("set-cookie")).toContain("hhba_session_v1=");
nowRef.t += 61_000;
r = await post("/api/v1/auth/sms/send", { phone: PHONE, purpose: "login"});
    expect(r!.status).toBe(200);
    r = await post("/api/v1/auth/login", { phone: PHONE, code: sent[1].code });
    expect(r!.status).toBe(200);
    r = await post("/api/v1/auth/register", { phone: PHONE, code: "123456" });
    expect(r!.status).toBe(409);
    expect((await r!.json() as { error: string }).error).toBe("PHONE_ALREADY_REGISTERED");
  });
});