/**
 * 短信发送限流（纯逻辑，内存实现为参考；生产可换 Redis/DB 计数，接口不变）—— Phase 2
 * 落点: ops/legacy-marketplace/auth/rate-limit.ts
 *
 * 规则（任务书 5.2「不能缺少服务端限制」）:
 *   - 同手机号两次发送间隔 >= 60 秒（RESEND_INTERVAL_MS，与 sms-code.ts 同一常量来源）
 *   - 同手机号 24 小时最多 10 条；同 IP 1 小时最多 20 条（防刷短信费与撞库式枚举）
 * 数值可按阿里云短信频控（默认同号 1 条/分钟、10 条/小时、50 条/天一类规则）再收紧，
 * 但只能更严不能更松，调整须同步更新测试。
 */
import { RESEND_INTERVAL_MS } from "./sms-code.ts";

export const PHONE_DAILY_LIMIT = 10;
export const IP_HOURLY_LIMIT = 20;
const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;

export type SendDecision =
  | { allowed: true }
  | { allowed: false; reason: "resend_too_soon" | "phone_daily_limit" | "ip_hourly_limit"; retryAfterMs: number };

export class SmsRateLimiter {
  private byPhone = new Map<string, number[]>();
  private byIp = new Map<string, number[]>();

  private prune(list: number[], nowMs: number, windowMs: number): number[] {
    return list.filter((t) => nowMs - t < windowMs);
  }

  /** 检查是否可发送；不记录。发送成功（网关 accepted）后必须调用 record()。 */
  check(phone: string, ip: string, nowMs: number): SendDecision {
    const phoneHits = this.prune(this.byPhone.get(phone) ?? [], nowMs, DAY_MS);
    this.byPhone.set(phone, phoneHits);
    const last = phoneHits[phoneHits.length - 1];
    if (last !== undefined && nowMs - last < RESEND_INTERVAL_MS) {
      return { allowed: false, reason: "resend_too_soon", retryAfterMs: RESEND_INTERVAL_MS - (nowMs - last) };
    }
    if (phoneHits.length >= PHONE_DAILY_LIMIT) {
      return { allowed: false, reason: "phone_daily_limit", retryAfterMs: phoneHits[0] + DAY_MS - nowMs };
    }
    const ipHits = this.prune(this.byIp.get(ip) ?? [], nowMs, HOUR_MS);
    this.byIp.set(ip, ipHits);
    if (ipHits.length >= IP_HOURLY_LIMIT) {
      return { allowed: false, reason: "ip_hourly_limit", retryAfterMs: ipHits[0] + HOUR_MS - nowMs };
    }
    return { allowed: true };
  }

  record(phone: string, ip: string, nowMs: number): void {
    // 防无界增长：与现有 engagement/saved 模块一致的粗粒度清理策略
    if (this.byPhone.size > 20_000) this.byPhone.clear();
    if (this.byIp.size > 20_000) this.byIp.clear();
    (this.byPhone.get(phone) ?? this.byPhone.set(phone, []).get(phone)!).push(nowMs);
    (this.byIp.get(ip) ?? this.byIp.set(ip, []).get(ip)!).push(nowMs);
  }
}
