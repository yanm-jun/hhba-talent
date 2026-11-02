// Pages Functions 短信认证的纯逻辑 + D1 存取。
// 与前端 apps/web/src/services/realAuth.ts 的契约逐项对齐，错误码保持一致，
// 以便前端在不开新开关、不改代码的前提下走通（部署时沿用已有的
// VITE_HHBA_REAL_AUTH_ENABLED=1 构建开关，见 docs/REAL_AUTH_PNVS_20261102.md）。
//
// 规则总汇（与 10 月 ECS 测试后端 apps/real-backend/server.mjs 的行为一致，
// 差异处在文档中注明）：
// - 手机号：中国大陆 11 位，1[3-9] 开头；称呼：2-20 位，首字符字母或中文，
//   其余字母、数字、下划线或中文；密码：8-64 位，同时含字母和数字。
// - 注册与登录严格分开：注册接口才建号；登录接口验码通过但无账号时报
//   USER_NOT_REGISTERED，绝不自动建号。注册码 / 登录码 / 找回密码码的
//   purpose 分开记录，互不通用；同一码成功验码一次后即消费，不可复用。
// - 验证码本身绝不入库：发码只记 hhba_sms_events，验码只记成功与否。
// - 会话：随机 token 只存 SHA-256 哈希，有效期 24 小时，登出即 revoked。
// - 风控：同手机号 60 秒内不重发，1 小时内同手机号最多 5 次、同 IP 最多 20 次；
//   同手机号同 purpose 1 小时内验码尝试超过 10 次时不再调短信商，直接限流。
// - 密码登录：5 次失败锁定 15 分钟；查无用户时同样走一次密码校验，
//   避免用耗时差别泄露账号是否存在。

export const PHONE_RE = /^1[3-9][0-9]{9}$/;
export const USERNAME_RE = /^[A-Za-z\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]{1,19}$/;
export const SEND_COOLDOWN_MS = 60 * 1000;
export const SEND_WINDOW_MS = 60 * 60 * 1000;
export const SEND_MAX_PER_PHONE_PER_HOUR = 5;
export const SEND_MAX_PER_IP_PER_HOUR = 20;
export const VERIFY_MAX_PER_HOUR = 10;
export const CODE_WINDOW_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const PW_MAX_FAIL = 5;
export const PW_LOCK_MS = 15 * 60 * 1000;

export const okPhone = (phone) => typeof phone === 'string' && PHONE_RE.test(phone);
export const okUsername = (username) =>
  typeof username === 'string' && USERNAME_RE.test(username.trim());
export const okPassword = (password) =>
  typeof password === 'string' &&
  password.length >= 8 &&
  password.length <= 64 &&
  /[A-Za-z]/.test(password) &&
  /[0-9]/.test(password);

export class AuthError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const hex = (bytes) =>
  Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return hex(digest);
}

export function randomToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

// 密码哈希：Workers 无 scrypt，改用 PBKDF2-SHA-256（10 万次）。
// 格式 pbkdf2$100000$<salt hex>$<hash hex>。与测试后端 scrypt 格式不同，
// 两边用户库不互通，属预期差异（见文档）；密码只用于本 Pages 后端。
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$100000$${hex(salt)}$${hex(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    const salt = new Uint8Array(parts[2].match(/../g).map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256,
    );
    return hex(bits) === parts[3];
  } catch {
    return false;
  }
}

// ---- 纯决策函数（可单测，不依赖 D1） ----

// 发码风控：返回 { allowed, reason }；reason 为 'COOLDOWN' | 'PHONE_LIMIT' | 'IP_LIMIT'。
export function decideSend({ lastSendAtMs, phoneCountLastHour, ipCountLastHour }, nowMs) {
  if (lastSendAtMs != null && nowMs - lastSendAtMs < SEND_COOLDOWN_MS) {
    return { allowed: false, reason: 'COOLDOWN' };
  }
  if (phoneCountLastHour >= SEND_MAX_PER_PHONE_PER_HOUR) return { allowed: false, reason: 'PHONE_LIMIT' };
  if (ipCountLastHour >= SEND_MAX_PER_IP_PER_HOUR) return { allowed: false, reason: 'IP_LIMIT' };
  return { allowed: true, reason: null };
}

// 会话有效性：过期或已撤销一律无效。
export function sessionValid(sessionRow, nowMs) {
  if (!sessionRow || sessionRow.revoked) return false;
  return Date.parse(sessionRow.expires_at) > nowMs;
}

// 登录短信决策：验码通过是必要条件，但不是建号条件。
// codeOk=true 且无账号时必须拒绝（USER_NOT_REGISTERED），绝不建号。
export function decideLoginSms({ codeOk, user }) {
  if (!codeOk) return { error: 'CODE_INVALID_OR_EXPIRED', status: 401 };
  if (!user) return { error: 'USER_NOT_REGISTERED', status: 403 };
  return { error: null, status: 200 };
}

// ---- D1 存取（D1 绑定由 handler 传入，缺失时 handler 直接报 503） ----

const iso = (ms) => new Date(ms).toISOString();

export async function getUserByPhone(db, phone) {
  return db.prepare('SELECT * FROM hhba_auth_users WHERE phone=?').bind(phone).first();
}
export async function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM hhba_auth_users WHERE username=?').bind(username).first();
}
export async function createUser(db, { phone, username, passwordHash, nowMs }) {
  await db
    .prepare('INSERT INTO hhba_auth_users(phone, username, password_hash, role, created_at) VALUES(?,?,?,?,?)')
    .bind(phone, username, passwordHash, 'candidate', iso(nowMs))
    .run();
}
export async function touchLogin(db, phone, nowMs) {
  await db
    .prepare('UPDATE hhba_auth_users SET last_login_at=? WHERE phone=?')
    .bind(iso(nowMs), phone)
    .run();
}

export async function lastSendAtMs(db, phone) {
  const row = await db
    .prepare("SELECT created_at FROM hhba_sms_events WHERE phone=? AND status='sent' ORDER BY id DESC LIMIT 1")
    .bind(phone)
    .first();
  return row ? Date.parse(row.created_at) : null;
}
export async function countRecent(db, table, whereSql, params, sinceMs) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${whereSql} AND created_at>=?`)
    .bind(...params, iso(sinceMs))
    .first();
  return Number(row?.n || 0);
}
export async function recordSmsEvent(db, { phone, purpose, provider, status, bizId, ipHash, nowMs }) {
  await db
    .prepare('INSERT INTO hhba_sms_events(phone, purpose, provider, status, biz_id, ip_hash, created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(phone, purpose, provider, status, bizId || null, ipHash || null, iso(nowMs))
    .run();
}
// 最近一次未消费的发码记录（5 分钟窗口内）；无记录则不调短信商验码。
export async function latestUnconsumedSend(db, phone, purpose, nowMs) {
  return db
    .prepare('SELECT * FROM hhba_sms_events WHERE phone=? AND purpose=? AND status=? AND consumed=0 AND created_at>=? ORDER BY id DESC LIMIT 1')
    .bind(phone, purpose, 'sent', iso(nowMs - CODE_WINDOW_MS))
    .first();
}
export async function consumeSend(db, id, nowMs) {
  await db.prepare('UPDATE hhba_sms_events SET consumed=1, consumed_at=? WHERE id=?').bind(iso(nowMs), id).run();
}
export async function recordVerifyAttempt(db, phone, purpose, success, nowMs) {
  await db
    .prepare('INSERT INTO hhba_auth_verify_events(phone, purpose, success, created_at) VALUES(?,?,?,?)')
    .bind(phone, purpose, success ? 1 : 0, iso(nowMs))
    .run();
}

// 验码：先查本地发码窗口与尝试上限，再调短信商；成功后消费该次发码。
// 返回 true / false；调用方按 purpose 与账号存在性再做注册 / 登录决策。
export async function verifySmsCode(db, provider, phone, purpose, code, nowMs) {
  const attempts = await countRecent(
    db,
    'hhba_auth_verify_events',
    'phone=? AND purpose=?',
    [phone, purpose],
    nowMs - SEND_WINDOW_MS,
  );
  if (attempts >= VERIFY_MAX_PER_HOUR) throw new AuthError('RATE_LIMITED', 429);
  const sendRow = await latestUnconsumedSend(db, phone, purpose, nowMs);
  if (!sendRow) {
    await recordVerifyAttempt(db, phone, purpose, false, nowMs);
    return false;
  }
  let ok = false;
  try {
    ok = await provider.verifyCode(phone, code);
  } catch {
    ok = false;
  }
  await recordVerifyAttempt(db, phone, purpose, ok, nowMs);
  if (ok) await consumeSend(db, sendRow.id, nowMs);
  return ok;
}

export async function createSession(db, phone, nowMs) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await db
    .prepare('INSERT INTO hhba_auth_sessions(token_hash, phone, created_at, expires_at) VALUES(?,?,?,?)')
    .bind(tokenHash, phone, iso(nowMs), iso(nowMs + SESSION_TTL_MS))
    .run();
  return token;
}
export async function sessionOfBearer(db, request, nowMs) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT * FROM hhba_auth_sessions WHERE token_hash=?')
    .bind(tokenHash)
    .first();
  if (!sessionValid(row, nowMs)) return null;
  await db
    .prepare('UPDATE hhba_auth_sessions SET last_seen_at=? WHERE token_hash=?')
    .bind(iso(nowMs), tokenHash)
    .run();
  return row;
}
export async function revokeBearer(db, request, bodyToken, nowMs) {
  const auth = request.headers.get('authorization') || '';
  const token = bodyToken || (auth.startsWith('Bearer ') ? auth.slice(7).trim() : '');
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await db.prepare('UPDATE hhba_auth_sessions SET revoked=1 WHERE token_hash=?').bind(tokenHash).run();
  void nowMs;
}
