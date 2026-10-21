/**
 * 短信验证码核心规则（纯逻辑，无 IO，可单测）—— Phase 2
 * 落点: ops/legacy-marketplace/auth/sms-code.ts
 *
 * 规则（任务书 5.2，与 schema 001_auth_schema.sql 的 sms_codes 表一一对应）:
 *   - 6 位数字验证码（密码学随机，含前导零，按字符串处理）
 *   - 有效期 5 分钟；重发间隔 60 秒（限流在 rate-limit.ts）
 *   - 最多 5 次错误尝试，达到上限即作废
 *   - 成功验证后立即失效（consumed_at 置位）
 *   - 数据库只存 HMAC-SHA256(pepper, phone|purpose|code)，不存明文；
 *     pepper 来自环境变量 SMS_CODE_PEPPER（见 sms-provider / auth-service 装配处）
 *   - 比较使用 timingSafeEqual 防时序侧信道
 *
 * 注册/登录双入口（2026-10-21 用户拍板，取代旧「验码即注册登录」统一入口）:
 *   - 每条验证码记录强制绑定用途 purpose ∈ {'register','login'}，发码时必填、无默认值；
 *   - purpose 进入 HMAC 输入：同一串数字在另一用途下哈希不同，天然不可跨用途使用；
 *   - 存储层查询按 (phone, purpose) 取码，验码时再断言 record.purpose === 期望用途（双保险）。
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 5 * 60_000;
export const RESEND_INTERVAL_MS = 60_000;
export const MAX_VERIFY_ATTEMPTS = 5;

export const CN_PHONE_RE = /^1[3-9]\d{9}$/;
export function isValidCnPhone(phone: unknown): phone is string {
  return typeof phone === "string" && CN_PHONE_RE.test(phone);
}

/** 验证码用途：与注册/登录两个独立入口一一对应。任何发码/验码调用都必须显式给出，缺失即非法。 */
export type SmsPurpose = "register" | "login";
export const SMS_PURPOSES: readonly SmsPurpose[] = ["register", "login"];
export function isSmsPurpose(value: unknown): value is SmsPurpose {
  return value === "register" || value === "login";
}

/** 生成 6 位数字验证码字符串（000000–999999 均匀分布，保留前导零）。 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, "0");
}

/** 验证码的存储形态：只输出哈希。pepper 缺失直接抛错——宁可发不出码，不可降级存明文。 */
export function hashCode(pepper: string, phone: string, purpose: SmsPurpose, code: string): string {
  if (!pepper || pepper.length < 16) throw new Error("SMS_CODE_PEPPER_MISSING_OR_WEAK");
  if (!isSmsPurpose(purpose)) throw new Error("SMS_PURPOSE_INVALID");
  return createHmac("sha256", pepper).update(`${phone}|${purpose}|${code}`).digest("hex");
}

export interface SmsCodeRecord {
  phone: string;
  purpose: SmsPurpose;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  createdAtMs: number;
  expiresAtMs: number;
  consumedAtMs: number | null;
}

/** 由明文码构造待入库记录；明文只应交给短信网关发送，调用方不得落库/打日志。
 *  purpose 必填：不给默认值是刻意的——任何一处漏传用途在类型层就过不了。 */
export function createCodeRecord(args: {
  pepper: string; phone: string; purpose: SmsPurpose; code: string; nowMs: number;
}): SmsCodeRecord {
  const purpose = args.purpose;
  if (!isSmsPurpose(purpose)) throw new Error("SMS_PURPOSE_INVALID");
  return {
    phone: args.phone,
    purpose,
    codeHash: hashCode(args.pepper, args.phone, purpose, args.code),
    attempts: 0,
    maxAttempts: MAX_VERIFY_ATTEMPTS,
    createdAtMs: args.nowMs,
    expiresAtMs: args.nowMs + CODE_TTL_MS,
    consumedAtMs: null,
  };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "consumed" | "expired" | "too_many_attempts" | "mismatch" | "purpose_mismatch" };

/**
 * 校验一次尝试。就地更新 record（attempts / consumedAtMs），
 * 调用方负责把更新后的记录写回 DB（同一事务/行锁内完成，避免并发绕过次数上限）。
 * 顺序刻意如此：已消费/已过期优先于比对，过期不消耗尝试次数，错误尝试达上限立即作废。
 */
export function verifyCode(
  record: SmsCodeRecord,
  args: { pepper: string; candidate: string; nowMs: number; expectedPurpose?: SmsPurpose },
): VerifyResult {
  // 用途断言（双保险的第二道）：正常路径已按 (phone, purpose) 取码、且哈希本身含 purpose，
  // 这里再显式比对一次，任何装配错误都会以失败收场而不是串用途放行。不消耗尝试次数、不作废。
  if (args.expectedPurpose !== undefined && record.purpose !== args.expectedPurpose) {
    return { ok: false, reason: "purpose_mismatch" };
  }
  if (record.consumedAtMs !== null) return { ok: false, reason: "consumed" };
  if (args.nowMs >= record.expiresAtMs) {
    record.consumedAtMs = args.nowMs;
    return { ok: false, reason: "expired" };
  }
  if (record.attempts >= record.maxAttempts) {
    record.consumedAtMs = args.nowMs;
    return { ok: false, reason: "too_many_attempts" };
  }
  const candidate = String(args.candidate ?? "");
  const expected = Buffer.from(record.codeHash, "hex");
  let match = false;
  if (/^\d{6}$/.test(candidate)) {
    const actual = Buffer.from(hashCode(args.pepper, record.phone, record.purpose, candidate), "hex");
    match = actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  if (match) {
    record.consumedAtMs = args.nowMs; // 成功即失效
    return { ok: true };
  }
  record.attempts += 1;
  if (record.attempts >= record.maxAttempts) record.consumedAtMs = args.nowMs;
  return { ok: false, reason: "mismatch" };
}
