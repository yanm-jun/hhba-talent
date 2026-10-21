/**
 * AuthStore 的 PostgreSQL 实现骨架 —— Phase 2
 * 落点: ops/legacy-marketplace/auth/auth-store-pg.ts
 *
 * 为避免在本代码包里锁死驱动版本，这里只依赖一个最小 Queryable 接口：
 * 生产装配时传 pg.Pool（npm 包 pg 的 Pool.query 签名兼容）或 Bun.sql 的等价封装。
 * 全部 SQL 参数化，表/列与 apps/api/db/001_auth_schema.sql 一一对应。
 * 并发纪律：loginWithCode 的「读最新未消费码 → 校验 → 写回」须在同一事务中对 sms_codes 行
 * 加 FOR UPDATE（见 loginTx 注释），否则并发请求可绕过 5 次错误上限——合并时按注释落地。
 */
import type { AuthStore, UserRow, SessionRow } from "./auth-service.ts";
import type { SmsCodeRecord } from "./sms-code.ts";

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const toUser = (r: Record<string, unknown>): UserRow => ({
  id: String(r.id), phone: String(r.phone), nickname: (r.nickname as string) ?? null,
  accountRole: r.account_role as UserRow["accountRole"], status: r.status as UserRow["status"],
  isAdmin: Boolean(r.is_admin), createdAtMs: new Date(String(r.created_at)).getTime(),
  lastLoginAtMs: r.last_login_at ? new Date(String(r.last_login_at)).getTime() : null,
});

export class PgAuthStore implements AuthStore {
  constructor(private db: Queryable) {}

  async findUserByPhone(phone: string): Promise<UserRow | null> {
    const { rows } = await this.db.query("SELECT * FROM users WHERE phone=$1", [phone]);
    return rows[0] ? toUser(rows[0]) : null;
  }
  async createUser(phone: string): Promise<UserRow> {
    // ON CONFLICT 兜底并发同号注册：唯一约束保证最终只有一个账户
    const { rows } = await this.db.query(
      `INSERT INTO users(phone) VALUES($1)
       ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING *`, [phone]);
    return toUser(rows[0]);
  }
  async touchLastLogin(userId: string, nowMs: number): Promise<void> {
    await this.db.query("UPDATE users SET last_login_at=$2 WHERE id=$1", [userId, new Date(nowMs).toISOString()]);
  }
  async saveSmsCode(rec: SmsCodeRecord & { requestIp: string | null; sentVia: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO sms_codes(phone,purpose,code_hash,attempts,max_attempts,sent_via,request_ip,created_at,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [rec.phone, rec.purpose, rec.codeHash, rec.attempts, rec.maxAttempts, rec.sentVia, rec.requestIp,
       new Date(rec.createdAtMs).toISOString(), new Date(rec.expiresAtMs).toISOString()]);
  }
  async latestOpenSmsCode(phone: string, purpose: string): Promise<(SmsCodeRecord & { id: string }) | null> {
    // 合并落地时：本查询与 updateSmsCode 应包在同一事务并对行 FOR UPDATE（防并发绕过尝试上限）
    const { rows } = await this.db.query(
      `SELECT * FROM sms_codes WHERE phone=$1 AND purpose=$2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`, [phone, purpose]);
    const r = rows[0]; if (!r) return null;
    return {
      id: String(r.id), phone: String(r.phone), purpose: String(r.purpose), codeHash: String(r.code_hash),
      attempts: Number(r.attempts), maxAttempts: Number(r.max_attempts),
      createdAtMs: new Date(String(r.created_at)).getTime(), expiresAtMs: new Date(String(r.expires_at)).getTime(),
      consumedAtMs: r.consumed_at ? new Date(String(r.consumed_at)).getTime() : null,
    };
  }
  async updateSmsCode(rec: SmsCodeRecord & { id: string }): Promise<void> {
    await this.db.query("UPDATE sms_codes SET attempts=$2, consumed_at=$3 WHERE id=$1",
      [rec.id, rec.attempts, rec.consumedAtMs ? new Date(rec.consumedAtMs).toISOString() : null]);
  }
  async logSmsSend(e: { phone: string; provider: string; requestId: string | null; status: string; errorCode: string | null; ip: string | null }): Promise<void> {
    await this.db.query(
      `INSERT INTO sms_send_log(phone,provider,provider_request_id,status,error_code,request_ip)
       VALUES($1,$2,$3,$4,$5,$6)`, [e.phone, e.provider, e.requestId, e.status, e.errorCode, e.ip]);
  }
  async createSession(s: SessionRow): Promise<void> {
    await this.db.query(
      `INSERT INTO auth_sessions(id,user_id,token_hash,csrf_hash,created_at,expires_at)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [s.id, s.userId, s.tokenHash, s.csrfHash, new Date(s.createdAtMs).toISOString(), new Date(s.expiresAtMs).toISOString()]);
  }
  async findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query("SELECT * FROM auth_sessions WHERE token_hash=$1", [tokenHash]);
    const r = rows[0]; if (!r) return null;
    return {
      id: String(r.id), userId: String(r.user_id), tokenHash: String(r.token_hash),
      csrfHash: (r.csrf_hash as string) ?? null,
      createdAtMs: new Date(String(r.created_at)).getTime(), expiresAtMs: new Date(String(r.expires_at)).getTime(),
      revokedAtMs: r.revoked_at ? new Date(String(r.revoked_at)).getTime() : null,
    };
  }
  async revokeSession(id: string, nowMs: number): Promise<void> {
    await this.db.query("UPDATE auth_sessions SET revoked_at=$2 WHERE id=$1 AND revoked_at IS NULL", [id, new Date(nowMs).toISOString()]);
  }
  async listSavedJobIds(userId: string): Promise<string[]> {
    const { rows } = await this.db.query("SELECT job_id FROM saved_jobs_account WHERE user_id=$1 ORDER BY created_at DESC LIMIT 300", [userId]);
    return rows.map((r) => String(r.job_id));
  }
  async addSavedJob(userId: string, jobId: string): Promise<void> {
    await this.db.query("INSERT INTO saved_jobs_account(user_id,job_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [userId, jobId]);
  }
  async removeSavedJob(userId: string, jobId: string): Promise<void> {
    await this.db.query("DELETE FROM saved_jobs_account WHERE user_id=$1 AND job_id=$2", [userId, jobId]);
  }
}
