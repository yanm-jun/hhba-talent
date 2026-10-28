// HHBA 测试真实认证后端（/api/real-auth/*）。
// 来源：ECS 测试站 /srv/hhba-test-login/real-backend/server.mjs 的源码级重写，
// 不是逐字节副本；接口、校验与错误码等已核对项与测试包一致。
// 运行：node server.mjs（Node 22+，使用 node:sqlite，无外部依赖）。
// 数据库默认 ./test.db，可用 HHBA_REAL_DB 覆盖；端口默认 4000，可用 HHBA_REAL_PORT 覆盖。
// 本文件不含任何真实凭证、验证码与用户数据；不要把测试站的 test.db 提交进仓库。
import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pnvsSend, pnvsCheck, pnvsCredentialSource, PNVS_SIGN_NAME, PNVS_TEMPLATE_CODE } from './pnvs.mjs';

const PORT = Number(process.env.HHBA_REAL_PORT || 4000);
const DB_PATH = process.env.HHBA_REAL_DB || './test.db';
const PW_MAX_FAIL = 5;
const PW_LOCK_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;

const db = new DatabaseSync(DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL, role TEXT, created_at TEXT NOT NULL, last_login_at TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS sms_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT, expires_at TEXT, used INTEGER DEFAULT 0, created_at TEXT NOT NULL, sms_status TEXT, sms_error TEXT, pnvs_biz_id TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS access_events (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, method TEXT NOT NULL, phone TEXT, status INTEGER NOT NULL, created_at TEXT NOT NULL, note TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT UNIQUE NOT NULL, phone TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, revoked INTEGER DEFAULT 0)');
db.exec('CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, job_id TEXT NOT NULL, title TEXT, company TEXT, created_at TEXT NOT NULL, UNIQUE(phone, job_id))');

// 老库补列：按 PRAGMA 检查后补齐称呼、密码哈希与密码锁定字段。
(function tryAddCols() {
  const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map((r) => r.name));
  const wanted = {
    username: 'TEXT',
    password_hash: 'TEXT',
    failed_pw_attempts: 'INTEGER DEFAULT 0',
    pw_locked_until: 'TEXT',
  };
  for (const [name, type] of Object.entries(wanted)) {
    if (!cols.has(name)) db.exec('ALTER TABLE users ADD COLUMN ' + name + ' ' + type);
  }
})();

function now() {
  return new Date().toISOString();
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(pw, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + dk;
}

function verifyPassword(pw, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const dk = crypto.scryptSync(pw, parts[1], 64);
    const expected = Buffer.from(parts[2], 'hex');
    return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

// 无用户时也用哑哈希校验一次，使耗时与真实校验接近，避免通过耗时区分账号是否存在。
const DUMMY_PW_HASH = hashPassword('dummy-not-a-real-password-000');

function okPhone(phone) {
  return typeof phone === 'string' && /^1[3-9][0-9]{9}$/.test(phone);
}

// 称呼：先 trim；2-20 位，首字符字母或中文，其余字母、数字、下划线或中文。
function okUsername(username) {
  return typeof username === 'string' && /^[A-Za-z\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]{1,19}$/.test(username.trim());
}

function okPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 64 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

function okJobId(jobId) {
  return typeof jobId === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(jobId);
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function body(req) {
  return new Promise((resolve) => {
    let text = '';
    req.on('data', (chunk) => { text += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(text || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function ev(path, method, phone, status, note) {
  try {
    db.prepare('INSERT INTO access_events(path, method, phone, status, created_at, note) VALUES(?,?,?,?,?,?)').run(path, method, phone || null, status, now(), note || null);
  } catch {
    // 访问记录失败不影响主流程。
  }
}

function bearerToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

// 按令牌查会话：不存在、已撤销或已过期均视为无效。
function sessOf(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND revoked=0').get(sha(token));
  if (!row || row.expires_at <= now()) return null;
  return { token, phone: row.phone, row };
}

function newSession(phone) {
  const tok = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash, phone, expires_at, created_at) VALUES(?,?,?,?)').run(sha(tok), phone, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now());
  return tok;
}

// 验证码校验：先查该手机号该用途未使用未过期的发码记录，再向 PNVS 校验。
// 后端不生成、不存储验证码原文；校验失败返回 null，调用方统一报 CODE_INVALID_OR_EXPIRED。
async function checkCode(phone, purpose, code) {
  const row = db.prepare('SELECT * FROM sms_codes WHERE phone=? AND purpose=? AND used=0 AND expires_at>? ORDER BY id DESC LIMIT 1').get(phone, purpose, now());
  if (!row) return null;
  try {
    await pnvsCheck(phone, code);
  } catch {
    return null;
  }
  return row;
}

function markCodeUsed(row) {
  db.prepare('UPDATE sms_codes SET used=1 WHERE id=?').run(row.id);
}
// 健康：按凭证可用性报 pnvs_configured，不只看环境变量。
async function handleHealth(req, res) {
  const src = await pnvsCredentialSource();
  send(res, 200, {
    ok: true,
    service: 'hhba-test-real',
    pnvs_configured: src.available,
    pnvs_credential_source: src.source,
    pnvs_credential_role: src.role,
    pnvs_credential_expires_at: src.expiresAt,
    sms_provider: 'pnvs',
    sms_sign_name: PNVS_SIGN_NAME,
    sms_template: PNVS_TEMPLATE_CODE,
    sms_status: 'pnvs_gift_sign_template_only_register_login_reset',
    demo_login: 'disabled_in_test_caddy',
  });
}

// 发码：注册用途先判手机号已存在；失败时仍写一条发码记录并报 503。
async function handleSendCode(req, res, b, purpose) {
  if (!okPhone(b.phone)) return send(res, 400, { ok: false, error: 'INVALID_PHONE' });
  if (purpose === 'register') {
    const exists = db.prepare('SELECT phone FROM users WHERE phone=?').get(b.phone);
    if (exists) return send(res, 409, { ok: false, error: 'USER_EXISTS' });
  }
  try {
    const data = await pnvsSend(b.phone);
    db.prepare('INSERT INTO sms_codes(phone, purpose, code_hash, expires_at, used, created_at, sms_status, sms_error, pnvs_biz_id) VALUES(?,?,?,?,0,?,?,?,?)').run(b.phone, purpose, null, new Date(Date.now() + CODE_TTL_MS).toISOString(), now(), 'pnvs_sent', null, data.BizId || null);
    return send(res, 200, {
      ok: true,
      pnvs: true,
      sms_provider: 'pnvs',
      sms_sign_name: PNVS_SIGN_NAME,
      sms_template: PNVS_TEMPLATE_CODE,
      biz_id: data.BizId || null,
      detail: 'code_generated_and_sent_by_pnvs_backend_does_not_store_code',
    });
  } catch (e) {
    const code = e.code || e.message || 'PNVS_SEND_FAILED';
    const status = code === 'PNVS_NOT_CONFIGURED' ? 'blocked_no_pnvs_credentials' : 'pnvs_send_failed';
    db.prepare('INSERT INTO sms_codes(phone, purpose, code_hash, expires_at, used, created_at, sms_status, sms_error, pnvs_biz_id) VALUES(?,?,?,?,0,?,?,?,?)').run(b.phone, purpose, null, new Date(Date.now() + CODE_TTL_MS).toISOString(), now(), status, code, null);
    return send(res, 503, {
      ok: false,
      error: code === 'PNVS_NOT_CONFIGURED' ? 'PNVS_NOT_CONFIGURED' : 'PNVS_SEND_FAILED',
      pnvs_code: code,
      pnvs_message: e.message || code,
      sms_provider: 'pnvs',
      sms_sign_name: PNVS_SIGN_NAME,
      sms_template: PNVS_TEMPLATE_CODE,
      detail: 'backend_does_not_generate_or_store_code_code_is_generated_by_pnvs',
    });
  }
}

// 注册：角色固定为 candidate，不接受 account_type；短信登录不自动建号与之对应。
async function handleRegister(req, res, b) {
  if (typeof b.username === 'string') b.username = b.username.trim();
  if (!okPhone(b.phone)) return send(res, 400, { ok: false, error: 'INVALID_PHONE' });
  if (db.prepare('SELECT phone FROM users WHERE phone=?').get(b.phone)) return send(res, 409, { ok: false, error: 'USER_EXISTS' });
  if (!okUsername(b.username)) return send(res, 400, { ok: false, error: 'INVALID_USERNAME' });
  if (db.prepare('SELECT phone FROM users WHERE username=?').get(b.username)) return send(res, 409, { ok: false, error: 'USERNAME_TAKEN' });
  if (!okPassword(b.password)) return send(res, 400, { ok: false, error: 'WEAK_PASSWORD' });
  if (b.password !== b.password_confirm) return send(res, 400, { ok: false, error: 'PASSWORD_MISMATCH' });
  const row = await checkCode(b.phone, 'register', b.code);
  if (!row) {
    ev('/api/real-auth/register', 'POST', b.phone, 401, 'bad_register_code');
    return send(res, 401, { ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
  }
  markCodeUsed(row);
  db.prepare('INSERT INTO users(phone, role, created_at, username, password_hash) VALUES(?,?,?,?,?)').run(b.phone, 'candidate', now(), b.username, hashPassword(b.password));
  const token = newSession(b.phone);
  ev('/api/real-auth/register', 'POST', b.phone, 200, 'registered');
  return send(res, 200, { ok: true, phone: b.phone, token });
}

// 短信登录：验证码通过但无账号时不自动建号，报 USER_NOT_REGISTERED。
async function handleLoginSms(req, res, b) {
  if (!okPhone(b.phone)) return send(res, 400, { ok: false, error: 'INVALID_PHONE' });
  const row = await checkCode(b.phone, 'login', b.code);
  if (!row) return send(res, 401, { ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
  markCodeUsed(row);
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(b.phone);
  if (!user) return send(res, 403, { ok: false, error: 'USER_NOT_REGISTERED', detail: 'code_verified_but_no_account_no_auto_create' });
  db.prepare('UPDATE users SET last_login_at=? WHERE phone=?').run(now(), b.phone);
  const token = newSession(b.phone);
  return send(res, 200, { ok: true, phone: b.phone, token });
}
// 密码登录：按称呼查用户；5 次失败锁定 15 分钟；无用户时用哑哈希校验以保持耗时一致。
function handleLoginPassword(req, res, b) {
  if (typeof b.username === 'string') b.username = b.username.trim();
  const user = b.username ? db.prepare('SELECT * FROM users WHERE username=?').get(b.username) : null;
  const locked = !!(user && user.pw_locked_until && user.pw_locked_until > now());
  let ok = false;
  if (user && user.password_hash && !locked) ok = verifyPassword(b.password || '', user.password_hash);
  if (!user) verifyPassword(b.password || '', DUMMY_PW_HASH);
  if (!ok) {
    if (user && !locked) {
      const attempts = (user.failed_pw_attempts || 0) + 1;
      const lockUntil = attempts >= PW_MAX_FAIL ? new Date(Date.now() + PW_LOCK_MS).toISOString() : null;
      db.prepare('UPDATE users SET failed_pw_attempts=?, pw_locked_until=? WHERE phone=?').run(attempts, lockUntil, user.phone);
    }
    ev('/api/real-auth/login/password', 'POST', user ? user.phone : null, 401, 'pw_login_fail');
    return send(res, 401, { ok: false, error: 'BAD_CREDENTIALS' });
  }
  db.prepare('UPDATE users SET failed_pw_attempts=0, pw_locked_until=NULL, last_login_at=? WHERE phone=?').run(now(), user.phone);
  const token = newSession(user.phone);
  ev('/api/real-auth/login/password', 'POST', user.phone, 200, 'pw_logged_in');
  return send(res, 200, { ok: true, phone: user.phone, username: user.username, token });
}

// 设置凭证：已登录用户首次设置称呼与密码；已设置则报 CREDENTIALS_ALREADY_SET。
function handleSetCredentials(req, res, b) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(sess.phone);
  if (!user) return send(res, 404, { ok: false, error: 'USER_NOT_REGISTERED' });
  if (user.username) return send(res, 409, { ok: false, error: 'CREDENTIALS_ALREADY_SET' });
  if (typeof b.username === 'string') b.username = b.username.trim();
  if (!okUsername(b.username)) return send(res, 400, { ok: false, error: 'INVALID_USERNAME' });
  if (db.prepare('SELECT phone FROM users WHERE username=?').get(b.username)) return send(res, 409, { ok: false, error: 'USERNAME_TAKEN' });
  if (!okPassword(b.password)) return send(res, 400, { ok: false, error: 'WEAK_PASSWORD' });
  if (b.password !== b.password_confirm) return send(res, 400, { ok: false, error: 'PASSWORD_MISMATCH' });
  db.prepare('UPDATE users SET username=?, password_hash=?, failed_pw_attempts=0, pw_locked_until=NULL WHERE phone=?').run(b.username, hashPassword(b.password), sess.phone);
  return send(res, 200, { ok: true, username: b.username });
}

// 密码重置：验证码用途为 reset；无称呼的账户报 CREDENTIALS_NOT_SET。
async function handlePasswordReset(req, res, b) {
  if (!okPhone(b.phone)) return send(res, 400, { ok: false, error: 'INVALID_PHONE' });
  if (!okPassword(b.new_password)) return send(res, 400, { ok: false, error: 'WEAK_PASSWORD' });
  if (b.new_password !== b.new_password_confirm) return send(res, 400, { ok: false, error: 'PASSWORD_MISMATCH' });
  const row = await checkCode(b.phone, 'reset', b.code);
  if (!row) return send(res, 401, { ok: false, error: 'CODE_INVALID_OR_EXPIRED' });
  markCodeUsed(row);
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(b.phone);
  if (!user) return send(res, 403, { ok: false, error: 'USER_NOT_REGISTERED' });
  if (!user.username) return send(res, 409, { ok: false, error: 'CREDENTIALS_NOT_SET' });
  db.prepare('UPDATE users SET password_hash=?, failed_pw_attempts=0, pw_locked_until=NULL WHERE phone=?').run(hashPassword(b.new_password), b.phone);
  return send(res, 200, { ok: true });
}

function handleMe(req, res) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  const user = db.prepare('SELECT username, role, created_at, last_login_at FROM users WHERE phone=?').get(sess.phone);
  return send(res, 200, {
    ok: true,
    phone: sess.phone,
    username: user ? user.username : null,
    role: user ? user.role : null,
    created_at: user ? user.created_at : null,
    last_login_at: user ? user.last_login_at : null,
    has_credentials: !!(user && user.username),
  });
}

// 登出：令牌取请求体或 Authorization，置对应会话为已撤销。
function handleLogout(req, res, b) {
  const token = b.token || bearerToken(req);
  if (token) db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=?').run(sha(token));
  return send(res, 200, { ok: true });
}

function handleSessions(req, res) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  const rows = db.prepare('SELECT created_at, expires_at, revoked FROM sessions WHERE phone=? ORDER BY id DESC').all(sess.phone);
  return send(res, 200, { ok: true, sessions: rows });
}

function handleSessionRevoke(req, res, b) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  const token = b.token || '';
  if (token) db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=? AND phone=?').run(sha(token), sess.phone);
  return send(res, 200, { ok: true });
}

function handleSessionRevokeAll(req, res) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  db.prepare('UPDATE sessions SET revoked=1 WHERE phone=?').run(sess.phone);
  return send(res, 200, { ok: true });
}

function handleFavoritesGet(req, res) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  const rows = db.prepare('SELECT job_id, title, company, created_at FROM favorites WHERE phone=? ORDER BY id DESC').all(sess.phone);
  return send(res, 200, { ok: true, favorites: rows });
}

function handleFavoritesPost(req, res, b) {
  const sess = sessOf(req);
  if (!sess) return send(res, 401, { ok: false, error: 'SESSION_INVALID' });
  if (!okJobId(b.job_id)) return send(res, 400, { ok: false, error: 'INVALID_JOB_ID' });
  db.prepare('INSERT INTO favorites(phone, job_id, title, company, created_at) VALUES(?,?,?,?,?) ON CONFLICT(phone, job_id) DO UPDATE SET title=excluded.title, company=excluded.company').run(sess.phone, b.job_id, b.title || null, b.company || null, now());
  return send(res, 200, { ok: true });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    const method = req.method;
    if (!path.startsWith('/api/real-auth/')) return send(res, 404, { ok: false, error: 'NOT_FOUND' });
    if (method === 'GET' && path === '/api/real-auth/health') return handleHealth(req, res);
    if (method === 'GET' && path === '/api/real-auth/me') return handleMe(req, res);
    if (method === 'GET' && path === '/api/real-auth/sessions') return handleSessions(req, res);
    if (method === 'GET' && path === '/api/real-auth/favorites') return handleFavoritesGet(req, res);
    const b = method === 'POST' ? await body(req) : {};
    if (method === 'POST' && path === '/api/real-auth/register/send-code') return handleSendCode(req, res, b, 'register');
    if (method === 'POST' && path === '/api/real-auth/login/send-code') return handleSendCode(req, res, b, 'login');
    if (method === 'POST' && path === '/api/real-auth/password/reset/send-code') return handleSendCode(req, res, b, 'reset');
    if (method === 'POST' && path === '/api/real-auth/register') return handleRegister(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/login') return handleLoginSms(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/login/password') return handleLoginPassword(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/set-credentials') return handleSetCredentials(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/password/reset') return handlePasswordReset(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/logout') return handleLogout(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/sessions/revoke') return handleSessionRevoke(req, res, b);
    if (method === 'POST' && path === '/api/real-auth/sessions/revoke-all') return handleSessionRevokeAll(req, res);
    if (method === 'POST' && path === '/api/real-auth/favorites') return handleFavoritesPost(req, res, b);
    return send(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'INTERNAL_ERROR' });
  }
});

server.listen(PORT, () => {
  console.log('hhba real-auth listening on ' + PORT + ' db=' + DB_PATH);
});
