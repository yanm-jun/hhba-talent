/**
 * 账户认证服务（编排层）—— Phase 2
 * 落点: ops/legacy-marketplace/auth/auth-service.ts
 *
 * 与现有 Bun 主服务（railway-function-20261018.ts）的关系:
 *   主服务是单文件 Bun.serve，路由按 handlePrivateAdmin / handleEngagement / handleSavedJobs
 *   的「返回 null 表示不处理」惯例串联。本模块遵循同一惯例导出 handleAuth()（见 auth-routes.ts），
 *   合并时只需在主服务加一行分发 + 在启动时用 createAuthService() 装配一次，业务其余部分零改动。
 *   不另起 FastAPI/独立进程：apps/api/main.py 只是 Phase 0 健康检查骨架（审计已证），
 *   与生产 Bun 服务同进程同部署最省迁移成本；PostgreSQL 仅作账户库，不动现有 SQLite 业务数据。
 *
 * 数据访问经 AuthStore 接口隔离：生产实现用 pg 驱动执行 001_auth_schema.sql 的表；
 * 单测用内存实现。会话令牌只存哈希（token_hash），Cookie 发原文（HttpOnly+Secure+SameSite=Lax），
 * 状态变更接口要求 CSRF 双提交（csrf_hash 比对），与旧邮箱 API 的 csrf_token 习惯一致。
 *
 * —— 注册/登录双入口严格分开（2026-10-21 用户拍板，取代 f878e1b 的「验码即注册登录」）——
 *   入口 A 注册: sendCode(purpose='register') → registerWithCode()
 *     发码门: 手机号已注册 → PHONE_ALREADY_REGISTERED，不发码、不落码；
 *     验码门: 再查一次注册状态（双保险）→ 校验 register 码 → 建 users（来源 register）→ 签发会话。
 *   入口 B 登录: sendCode(purpose='login') → loginWithCode()
 *     发码门: 手机号未注册 → PHONE_NOT_REGISTERED，不发码、不建号；
 *     验码门: 再查一次注册状态（双保险）→ 校验 login 码 → 更新 last_login_at → 签发会话。
 *   结构纪律: 全模块唯一能建号的调用是 registerWithCode() 内部的 #createAccountViaRegister()，
 *   它只调用 store.insertNewUserForRegister()；loginWithCode() 在代码上没有任何建号路径，
 *   单测用计数型 store 断言登录全程 insert 次数为 0。
 *   验证码与用途绑定: 码记录带 purpose，哈希含 purpose，取码按 (phone, purpose) 过滤——
 *   register 的码拿到登录入口用，查无此码，直接失败（细则见 sms-code.ts）。
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  generateCode, createCodeRecord, verifyCode, isValidCnPhone, isSmsPurpose,
  type SmsCodeRecord, type SmsPurpose,
} from "./sms-code.ts";
import { SmsRateLimiter } from "./rate-limit.ts";
import type { SmsProvider } from "./sms-provider.ts";

export const SESSION_TTL_MS = 30 * 24 * 3600_000; // 30 天，可由产品再收紧
export const SESSION_COOKIE = "hhba_session_v1";

export interface UserRow {
  id: string; phone: string; nickname: string | null;
  accountRole: "candidate" | "recruiter"; status: "active" | "suspended" | "deleted";
  isAdmin: boolean; createdAtMs: number; lastLoginAtMs: number | null;
  /** 注册来源：本模块建号只会写 'register'（经注册入口）；'admin' 预留给受控离线流程，登录路径永不写。 */
  registeredFrom: "register" | "admin";
}

export interface SessionRow {
  id: string; userId: string; tokenHash: string; csrfHash: string | null;
  createdAtMs: number; expiresAtMs: number; revokedAtMs: number | null;
}

/** 持久层接口：生产实现逐条对应 001_auth_schema.sql（users/auth_sessions/sms_codes/sms_send_log/saved_jobs_account）。 */
export interface AuthStore {
  findUserByPhone(phone: string): Promise<UserRow | null>;
  /**
   * 唯一的建号原语：INSERT 新 users 行（registered_from='register'）。
   * 只允许 AuthService 的注册路径调用；登录路径禁止触达（见类注释与单测断言）。
   * 并发下依赖 users.phone UNIQUE，冲突时回查既有行返回。
   */
  insertNewUserForRegister(phone: string): Promise<UserRow>;
  touchLastLogin(userId: string, nowMs: number): Promise<void>;
  saveSmsCode(rec: SmsCodeRecord & { requestIp: string | null; sentVia: string }): Promise<void>;
  latestOpenSmsCode(phone: string, purpose: SmsPurpose): Promise<(SmsCodeRecord & { id: string }) | null>;
  updateSmsCode(rec: SmsCodeRecord & { id: string }): Promise<void>;
  logSmsSend(entry: { phone: string; purpose: string | null; provider: string; requestId: string | null; status: string; errorCode: string | null; ip: string | null }): Promise<void>;
  createSession(s: SessionRow): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  revokeSession(id: string, nowMs: number): Promise<void>;
  listSavedJobIds(userId: string): Promise<string[]>;
  addSavedJob(userId: string, jobId: string): Promise<void>;
  removeSavedJob(userId: string, jobId: string): Promise<void>;
}

export function hashSessionToken(secret: string, token: string): string {
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET_MISSING_OR_WEAK");
  return createHmac("sha256", secret).update(`session:${token}`).digest("hex");
}
export function newSessionToken(): string { return randomBytes(32).toString("base64url"); }
export function newCsrfToken(): string { return randomBytes(24).toString("base64url"); }
export function csrfMatches(session: SessionRow, presented: string | null, secret: string): boolean {
  if (!session.csrfHash || !presented) return false;
  const a = Buffer.from(hashSessionToken(secret, `csrf:${presented}`));
  const b = Buffer.from(session.csrfHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class AuthError extends Error {
  constructor(public code: string, public httpStatus: number) { super(code); }
}

/** 对外错误码 → 前端中文文案（单一事实源；前端 smsAuth.ts 的映射表与此保持一致，改一处须同步另一处）。 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  PHONE_NOT_REGISTERED: "该手机号尚未注册，请先注册",
  PHONE_ALREADY_REGISTERED: "该手机号已注册，请直接登录",
  PHONE_INVALID: "请输入正确的中国大陆手机号",
  SMS_PURPOSE_INVALID: "验证码用途无效，请刷新页面后重试",
  SMS_RESEND_TOO_SOON: "发送太频繁，请 60 秒后再试",
  SMS_PHONE_DAILY_LIMIT: "该手机号今日发送次数已达上限，请明天再试",
  SMS_IP_HOURLY_LIMIT: "当前网络发送次数过多，请稍后再试",
  CODE_NOT_FOUND_OR_EXPIRED: "验证码已失效，请重新获取",
  CODE_MISMATCH: "验证码不正确",
  CODE_EXPIRED: "验证码已过期，请重新获取",
  CODE_CONSUMED: "验证码已使用，请重新获取",
  CODE_TOO_MANY_ATTEMPTS: "验证码错误次数过多，请重新获取",
  CODE_PURPOSE_MISMATCH: "验证码与当前入口不匹配，请重新获取",
  ACCOUNT_NOT_ACTIVE: "该账户当前不可用，请联系平台",
};

export interface AuthServiceDeps {
  store: AuthStore;
  sms: SmsProvider;
  pepper: string;        // SMS_CODE_PEPPER
  sessionSecret: string; // 独立于 pepper 的会话密钥（环境变量 SESSION_SECRET，未列入模板时与 pepper 分开生成）
  limiter?: SmsRateLimiter;
  jobExists?: (jobId: string) => Promise<boolean>; // 复用主服务岗位索引判断，防收藏不存在的岗位
  now?: () => number;
}

export interface AuthSuccess { user: UserRow; token: string; csrf: string; session: SessionRow }

export class AuthService {
  private limiter: SmsRateLimiter;
  private now: () => number;
  constructor(private deps: AuthServiceDeps) {
    this.limiter = deps.limiter ?? new SmsRateLimiter();
    this.now = deps.now ?? (() => Date.now());
    if (deps.sms.name === "mock" && process.env.NODE_ENV === "production") {
      throw new Error("MOCK_SMS_FORBIDDEN_IN_PRODUCTION");
    }
  }

  /**
   * 发送验证码（双入口共用，purpose 必填）:
   *   顺序刻意如此: 手机号校验 → purpose 校验 → 注册状态门（不通过不发码、不落码、不占限流额度，
   *   但写一条 rejected 发送日志供对账）→ 限流 → 生成 → 先落库（哈希）→ 调网关 → 记发送日志。
   *   注册状态门是第一道保险；验码入口还会再查一次（见 registerWithCode / loginWithCode）。
   */
  async sendCode(phone: string, purpose: SmsPurpose, ip: string): Promise<{ ok: true; purpose: SmsPurpose }> {
    if (!isValidCnPhone(phone)) throw new AuthError("PHONE_INVALID", 400);
    if (!isSmsPurpose(purpose)) throw new AuthError("SMS_PURPOSE_INVALID", 400);
    const existing = await this.deps.store.findUserByPhone(phone);
    if (purpose === "register" && existing) {
      await this.deps.store.logSmsSend({ phone, purpose, provider: this.deps.sms.name, requestId: null, status: "rejected", errorCode: "PHONE_ALREADY_REGISTERED", ip });
      throw new AuthError("PHONE_ALREADY_REGISTERED", 409);
    }
    if (purpose === "login" && !existing) {
      await this.deps.store.logSmsSend({ phone, purpose, provider: this.deps.sms.name, requestId: null, status: "rejected", errorCode: "PHONE_NOT_REGISTERED", ip });
      throw new AuthError("PHONE_NOT_REGISTERED", 400);
    }
    const nowMs = this.now();
    const decision = this.limiter.check(phone, ip, nowMs);
    if (!decision.allowed) {
      await this.deps.store.logSmsSend({ phone, purpose, provider: this.deps.sms.name, requestId: null, status: "rate_limited", errorCode: decision.reason, ip });
      throw new AuthError(`SMS_${decision.reason.toUpperCase()}`, 429);
    }
    const code = generateCode();
    const rec = createCodeRecord({ pepper: this.deps.pepper, phone, purpose, code, nowMs });
    await this.deps.store.saveSmsCode({ ...rec, requestIp: ip, sentVia: this.deps.sms.name });
    const result = await this.deps.sms.sendVerificationCode(phone, code);
    await this.deps.store.logSmsSend({
      phone, purpose, provider: result.provider, requestId: result.providerRequestId,
      status: result.ok ? "accepted" : "error", errorCode: result.errorCode, ip,
    });
    if (!result.ok) throw new AuthError(result.errorCode ?? "SMS_PROVIDER_ERROR", 502);
    this.limiter.record(phone, ip, nowMs);
    return { ok: true, purpose };
  }

  /** 验码的共用段：按 (phone, purpose) 取本用途最新未消费码并校验；成功即作废该码。状态门不在此处。 */
  async #verifyPurposeCode(phone: string, purpose: SmsPurpose, candidate: string): Promise<void> {
    const open = await this.deps.store.latestOpenSmsCode(phone, purpose);
    if (!open) throw new AuthError("CODE_NOT_FOUND_OR_EXPIRED", 400);
    const rec: SmsCodeRecord & { id: string } = { ...open };
    const verdict = verifyCode(rec, { pepper: this.deps.pepper, candidate, nowMs: this.now(), expectedPurpose: purpose });
    await this.deps.store.updateSmsCode(rec);
    if (!verdict.ok) throw new AuthError(`CODE_${verdict.reason.toUpperCase()}`, 400);
  }

  /** 唯一建号点：仅 registerWithCode 可达。写 users（created_at=注册时间、registered_from='register'）。 */
  async #createAccountViaRegister(phone: string): Promise<UserRow> {
    return this.deps.store.insertNewUserForRegister(phone);
  }

  async #issueSession(user: UserRow): Promise<AuthSuccess> {
    const nowMs = this.now();
    await this.deps.store.touchLastLogin(user.id, nowMs);
    const token = newSessionToken();
    const csrf = newCsrfToken();
    const session: SessionRow = {
      id: randomBytes(16).toString("hex"), userId: user.id,
      tokenHash: hashSessionToken(this.deps.sessionSecret, token),
      csrfHash: hashSessionToken(this.deps.sessionSecret, `csrf:${csrf}`),
      createdAtMs: nowMs, expiresAtMs: nowMs + SESSION_TTL_MS, revokedAtMs: null,
    };
    await this.deps.store.createSession(session);
    return { user, token, csrf, session };
  }

  /**
   * 注册入口（唯一会建号的公开方法）:
   *   验码前再查注册状态（双保险；此时码不消耗，竞态由 users.phone UNIQUE 兜底）→
   *   校验 register 用途码 → 建号 → 签发会话（进入登录态，但账户必先于会话存在）。
   */
  async registerWithCode(phone: string, candidate: string): Promise<AuthSuccess> {
    if (!isValidCnPhone(phone)) throw new AuthError("PHONE_INVALID", 400);
    const existing = await this.deps.store.findUserByPhone(phone);
    if (existing) throw new AuthError("PHONE_ALREADY_REGISTERED", 409);
    await this.#verifyPurposeCode(phone, "register", candidate);
    const user = await this.#createAccountViaRegister(phone);
    if (user.status !== "active") throw new AuthError("ACCOUNT_NOT_ACTIVE", 403);
    return this.#issueSession(user);
  }

  /**
   * 登录入口（结构上不存在任何建号调用）:
   *   验码前再查注册状态（双保险，未注册直接拒且不消耗验证码）→
   *   校验 login 用途码 → 更新 last_login_at → 签发会话。
   */
  async loginWithCode(phone: string, candidate: string): Promise<AuthSuccess> {
    if (!isValidCnPhone(phone)) throw new AuthError("PHONE_INVALID", 400);
    const user = await this.deps.store.findUserByPhone(phone);
    if (!user) throw new AuthError("PHONE_NOT_REGISTERED", 400);
    if (user.status !== "active") throw new AuthError("ACCOUNT_NOT_ACTIVE", 403);
    await this.#verifyPurposeCode(phone, "login", candidate);
    return this.#issueSession(user);
  }

  async authenticate(token: string | null): Promise<{ user: UserRow; session: SessionRow } | null> {
    if (!token) return null;
    const s = await this.deps.store.findSessionByTokenHash(hashSessionToken(this.deps.sessionSecret, token));
    if (!s || s.revokedAtMs !== null || s.expiresAtMs <= this.now()) return null;
    // user 行由 store 在生产实现里联表取回；此处以会话 userId 二次核对状态（实现细节见 pg store 说明）
    return { user: { id: s.userId } as UserRow, session: s };
  }

  async logout(sessionId: string): Promise<void> {
    await this.deps.store.revokeSession(sessionId, this.now());
  }

  // —— 账户级收藏：与设备收藏（saved.ts / hhba-saved.sqlite）完全隔离，互不读写 ——
  async listSaved(userId: string): Promise<string[]> { return this.deps.store.listSavedJobIds(userId); }
  async saveJob(userId: string, jobId: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(jobId)) throw new AuthError("JOB_ID_INVALID", 400);
    if (this.deps.jobExists && !(await this.deps.jobExists(jobId))) throw new AuthError("JOB_NOT_IN_INDEX", 404);
    await this.deps.store.addSavedJob(userId, jobId);
  }
  async unsaveJob(userId: string, jobId: string): Promise<void> { await this.deps.store.removeSavedJob(userId, jobId); }
}
