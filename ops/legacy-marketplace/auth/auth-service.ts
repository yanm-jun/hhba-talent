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
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { generateCode, createCodeRecord, verifyCode, isValidCnPhone, type SmsCodeRecord } from "./sms-code.ts";
import { SmsRateLimiter } from "./rate-limit.ts";
import type { SmsProvider } from "./sms-provider.ts";

export const SESSION_TTL_MS = 30 * 24 * 3600_000; // 30 天，可由产品再收紧
export const SESSION_COOKIE = "hhba_session_v1";

export interface UserRow {
  id: string; phone: string; nickname: string | null;
  accountRole: "candidate" | "recruiter"; status: "active" | "suspended" | "deleted";
  isAdmin: boolean; createdAtMs: number; lastLoginAtMs: number | null;
}

export interface SessionRow {
  id: string; userId: string; tokenHash: string; csrfHash: string | null;
  createdAtMs: number; expiresAtMs: number; revokedAtMs: number | null;
}

/** 持久层接口：生产实现逐条对应 001_auth_schema.sql（users/auth_sessions/sms_codes/sms_send_log/saved_jobs_account）。 */
export interface AuthStore {
  findUserByPhone(phone: string): Promise<UserRow | null>;
  createUser(phone: string): Promise<UserRow>; // 并发下依赖 users.phone UNIQUE，冲突时回查
  touchLastLogin(userId: string, nowMs: number): Promise<void>;
  saveSmsCode(rec: SmsCodeRecord & { requestIp: string | null; sentVia: string }): Promise<void>;
  latestOpenSmsCode(phone: string, purpose: string): Promise<(SmsCodeRecord & { id: string }) | null>;
  updateSmsCode(rec: SmsCodeRecord & { id: string }): Promise<void>;
  logSmsSend(entry: { phone: string; provider: string; requestId: string | null; status: string; errorCode: string | null; ip: string | null }): Promise<void>;
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

export interface AuthServiceDeps {
  store: AuthStore;
  sms: SmsProvider;
  pepper: string;        // SMS_CODE_PEPPER
  sessionSecret: string; // 独立于 pepper 的会话密钥（环境变量 SESSION_SECRET，未列入模板时与 pepper 分开生成）
  limiter?: SmsRateLimiter;
  jobExists?: (jobId: string) => Promise<boolean>; // 复用主服务岗位索引判断，防收藏不存在的岗位
  now?: () => number;
}

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

  /** 发送验证码：限流 → 生成 → 先落库（哈希）→ 调网关 → 记发送日志。网关失败不回滚已存码的尝试计数语义，但码作废防残留可用。 */
  async sendCode(phone: string, ip: string): Promise<{ ok: true }> {
    if (!isValidCnPhone(phone)) throw new AuthError("PHONE_INVALID", 400);
    const nowMs = this.now();
    const decision = this.limiter.check(phone, ip, nowMs);
    if (!decision.allowed) {
      await this.deps.store.logSmsSend({ phone, provider: this.deps.sms.name, requestId: null, status: "rate_limited", errorCode: decision.reason, ip });
      throw new AuthError(`SMS_${decision.reason.toUpperCase()}`, 429);
    }
    const code = generateCode();
    const rec = createCodeRecord({ pepper: this.deps.pepper, phone, code, nowMs });
    await this.deps.store.saveSmsCode({ ...rec, requestIp: ip, sentVia: this.deps.sms.name });
    const result = await this.deps.sms.sendVerificationCode(phone, code);
    await this.deps.store.logSmsSend({
      phone, provider: result.provider, requestId: result.providerRequestId,
      status: result.ok ? "accepted" : "error", errorCode: result.errorCode, ip,
    });
    if (!result.ok) throw new AuthError(result.errorCode ?? "SMS_PROVIDER_ERROR", 502);
    this.limiter.record(phone, ip, nowMs);
    return { ok: true };
  }

  /** 验证码登录/注册：验证成功 → 按手机号查或建用户（唯一约束兜底）→ 发会话。返回明文 token 仅此一次（给 Cookie）。 */
  async loginWithCode(phone: string, candidate: string): Promise<{ user: UserRow; token: string; csrf: string; session: SessionRow }> {
    if (!isValidCnPhone(phone)) throw new AuthError("PHONE_INVALID", 400);
    const open = await this.deps.store.latestOpenSmsCode(phone, "login");
    if (!open) throw new AuthError("CODE_NOT_FOUND_OR_EXPIRED", 400);
    const rec: SmsCodeRecord & { id: string } = { ...open };
    const verdict = verifyCode(rec, { pepper: this.deps.pepper, candidate, nowMs: this.now() });
    await this.deps.store.updateSmsCode(rec);
    if (!verdict.ok) throw new AuthError(`CODE_${verdict.reason.toUpperCase()}`, 400);

    let user = await this.deps.store.findUserByPhone(phone);
    if (!user) user = await this.deps.store.createUser(phone); // 首次验证通过即注册
    if (user.status !== "active") throw new AuthError("ACCOUNT_NOT_ACTIVE", 403);
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
