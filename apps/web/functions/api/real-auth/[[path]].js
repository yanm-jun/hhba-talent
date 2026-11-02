// Cloudflare Pages Functions：真实短信认证（求职者，/api/real-auth/*）。
// 前端契约来源：apps/web/src/services/realAuth.ts —— 路径、请求字段、
// 响应字段与错误码逐项对齐，前端不改代码即可走通（见 docs/REAL_AUTH_PNVS_20261102.md）。
// 本 handler 只服务求职者 candidate 角色；招聘方仍走正式 /api/v1 流程，不在此处处理。
// 安全要点：验证码绝不生成、不存储、不比对本地值，只调短信商验码；
// 会话 token 只存哈希；注册与登录分开，登录验码通过但无账号时拒绝建号。
import {
  AuthError,
  SEND_WINDOW_MS,
  PW_MAX_FAIL,
  PW_LOCK_MS,
  okPhone,
  okUsername,
  okPassword,
  decideSend,
  decideLoginSms,
  getUserByPhone,
  getUserByUsername,
  createUser,
  touchLogin,
  lastSendAtMs,
  countRecent,
  recordSmsEvent,
  verifySmsCode,
  createSession,
  sessionOfBearer,
  revokeBearer,
  hashPassword,
  verifyPassword,
} from '../../../_lib/real-auth.js';
import { PNVS_SIGN_NAME, PNVS_TEMPLATE_CODE, createSmsProvider } from '../../../_lib/sms-provider.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
const bad = (code, status = 400) => json({ ok: false, error: code }, status);

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

async function ipHash(request) {
  const raw =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  if (!raw) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const tail = url.pathname.slice('/api/real-auth'.length).replace(/\/$/, '') || '/';
  const nowMs = Date.now();
  const provider = createSmsProvider(env);

  // 健康接口不需要 D1：只报短信商 Secret 是否配齐，不主动调 PNVS（避免产生费用与副作用）。
  if (request.method === 'GET' && tail === '/health') {
    return json({
      ok: true,
      service: 'hhba-pages-real-auth',
      pnvs_configured: provider.configured,
      pnvs_credential_source: provider.configured ? 'env-secret' : null,
      pnvs_credential_role: null,
      pnvs_credential_expires_at: null,
      sms_provider: provider.name,
      sms_sign_name: PNVS_SIGN_NAME,
      sms_template: PNVS_TEMPLATE_CODE,
      sms_status: 'pnvs_sign_template_only_register_login_reset',
      demo_login: 'disabled',
    });
  }

  // PNVS 专用库优先，避免覆盖预览共享的 HHBA_AUTH_DB（email-auth-phase1 库）。
  const db = env.HHBA_PNVS_AUTH_DB ?? env.HHBA_AUTH_DB;
  if (!db) return bad('AUTH_DB_NOT_CONFIGURED', 503);

  try {
    // ---- 发码 ----
    // purpose 与前端 mode 一一对应：login / register / reset，互不通用。
    let sendPurpose = null;
    if (tail === '/password/reset/send-code') sendPurpose = 'reset';
    else {
      const m = tail.match(/^\/(login|register)\/send-code$/);
      if (m) sendPurpose = m[1];
    }
    if (request.method === 'POST' && sendPurpose) {
      const purpose = sendPurpose;
      const body = await readBody(request);
      if (!okPhone(body.phone)) return bad('INVALID_PHONE', 400);
      if (purpose === 'register' && (await getUserByPhone(db, body.phone))) {
        return bad('USER_EXISTS', 409);
      }
      const hash = await ipHash(request);
      const decision = decideSend(
        {
          lastSendAtMs: await lastSendAtMs(db, body.phone),
          phoneCountLastHour: await countRecent(db, 'hhba_sms_events', "phone=? AND status='sent'", [body.phone], nowMs - SEND_WINDOW_MS),
          ipCountLastHour: hash
            ? await countRecent(db, 'hhba_sms_events', "ip_hash=? AND status='sent'", [hash], nowMs - SEND_WINDOW_MS)
            : 0,
        },
        nowMs,
      );
      if (!decision.allowed) {
        await recordSmsEvent(db, { phone: body.phone, purpose, provider: provider.name, status: 'blocked', bizId: null, ipHash: hash, nowMs });
        return bad('RATE_LIMITED', 429);
      }
      if (!provider.configured) {
        await recordSmsEvent(db, { phone: body.phone, purpose, provider: provider.name, status: 'failed', bizId: null, ipHash: hash, nowMs });
        return bad('PNVS_NOT_CONFIGURED', 503);
      }
      try {
        const { bizId } = await provider.sendCode(body.phone, purpose);
        await recordSmsEvent(db, { phone: body.phone, purpose, provider: provider.name, status: 'sent', bizId, ipHash: hash, nowMs });
        return json({ ok: true, pnvs: true, sms_provider: provider.name, sms_sign_name: PNVS_SIGN_NAME, sms_template: PNVS_TEMPLATE_CODE, biz_id: bizId || null });
      } catch (e) {
        await recordSmsEvent(db, { phone: body.phone, purpose, provider: provider.name, status: 'failed', bizId: null, ipHash: hash, nowMs });
        return bad(e?.code === 'PNVS_NOT_CONFIGURED' ? 'PNVS_NOT_CONFIGURED' : 'PNVS_SEND_FAILED', 503);
      }
    }

    // ---- 注册：唯一建号入口 ----
    if (request.method === 'POST' && tail === '/register') {
      const body = await readBody(request);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      if (!okPhone(body.phone)) return bad('INVALID_PHONE', 400);
      if (await getUserByPhone(db, body.phone)) return bad('USER_EXISTS', 409);
      if (!okUsername(username)) return bad('INVALID_USERNAME', 400);
      if (await getUserByUsername(db, username)) return bad('USERNAME_TAKEN', 409);
      if (!okPassword(body.password)) return bad('WEAK_PASSWORD', 400);
      if (body.password !== body.password_confirm) return bad('PASSWORD_MISMATCH', 400);
      const codeOk = await verifySmsCode(db, provider, body.phone, 'register', String(body.code || ''), nowMs);
      if (!codeOk) return bad('CODE_INVALID_OR_EXPIRED', 401);
      try {
        await createUser(db, { phone: body.phone, username, passwordHash: await hashPassword(body.password), nowMs });
      } catch {
        return bad('USER_EXISTS', 409);
      }
      const token = await createSession(db, body.phone, nowMs);
      return json({ ok: true, phone: body.phone, username, token });
    }

    // ---- 短信登录：验码通过但无账号时拒绝，绝不建号 ----
    if (request.method === 'POST' && tail === '/login') {
      const body = await readBody(request);
      if (!okPhone(body.phone)) return bad('INVALID_PHONE', 400);
      const codeOk = await verifySmsCode(db, provider, body.phone, 'login', String(body.code || ''), nowMs);
      const user = await getUserByPhone(db, body.phone);
      const decision = decideLoginSms({ codeOk, user });
      if (decision.error) return bad(decision.error, decision.status);
      await touchLogin(db, body.phone, nowMs);
      const token = await createSession(db, body.phone, nowMs);
      return json({ ok: true, phone: body.phone, username: user.username, token });
    }

    // ---- 密码登录 ----
    if (request.method === 'POST' && tail === '/login/password') {
      const body = await readBody(request);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const user = username ? await getUserByUsername(db, username) : null;
      const locked = Boolean(user && user.pw_locked_until && Date.parse(user.pw_locked_until) > nowMs);
      let ok = false;
      if (user && user.password_hash && !locked) ok = await verifyPassword(String(body.password || ''), user.password_hash);
      if (!user) await verifyPassword(String(body.password || ''), 'pbkdf2$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000');
      if (!ok) {
        if (user && !locked) {
          const attempts = (user.failed_pw_attempts || 0) + 1;
          const lockUntil = attempts >= PW_MAX_FAIL ? new Date(nowMs + PW_LOCK_MS).toISOString() : null;
          await db.prepare('UPDATE hhba_auth_users SET failed_pw_attempts=?, pw_locked_until=? WHERE phone=?').bind(attempts, lockUntil, user.phone).run();
        }
        return bad('BAD_CREDENTIALS', 401);
      }
      await db.prepare('UPDATE hhba_auth_users SET failed_pw_attempts=0, pw_locked_until=NULL, last_login_at=? WHERE phone=?').bind(new Date(nowMs).toISOString(), user.phone).run();
      const token = await createSession(db, user.phone, nowMs);
      return json({ ok: true, phone: user.phone, username: user.username, token });
    }

    // ---- 首次设置称呼与密码（已登录） ----
    if (request.method === 'POST' && tail === '/set-credentials') {
      const session = await sessionOfBearer(db, request, nowMs);
      if (!session) return bad('SESSION_INVALID', 401);
      const user = await getUserByPhone(db, session.phone);
      if (!user) return bad('USER_NOT_REGISTERED', 404);
      if (user.username) return bad('CREDENTIALS_ALREADY_SET', 409);
      const body = await readBody(request);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      if (!okUsername(username)) return bad('INVALID_USERNAME', 400);
      if (await getUserByUsername(db, username)) return bad('USERNAME_TAKEN', 409);
      if (!okPassword(body.password)) return bad('WEAK_PASSWORD', 400);
      if (body.password !== body.password_confirm) return bad('PASSWORD_MISMATCH', 400);
      await db.prepare('UPDATE hhba_auth_users SET username=?, password_hash=?, failed_pw_attempts=0, pw_locked_until=NULL WHERE phone=?').bind(username, await hashPassword(body.password), session.phone).run();
      return json({ ok: true, username });
    }

    // ---- 找回密码 ----
    if (request.method === 'POST' && tail === '/password/reset') {
      const body = await readBody(request);
      if (!okPhone(body.phone)) return bad('INVALID_PHONE', 400);
      if (!okPassword(body.new_password)) return bad('WEAK_PASSWORD', 400);
      if (body.new_password !== body.new_password_confirm) return bad('PASSWORD_MISMATCH', 400);
      const codeOk = await verifySmsCode(db, provider, body.phone, 'reset', String(body.code || ''), nowMs);
      if (!codeOk) return bad('CODE_INVALID_OR_EXPIRED', 401);
      const user = await getUserByPhone(db, body.phone);
      if (!user) return bad('USER_NOT_REGISTERED', 403);
      if (!user.username) return bad('CREDENTIALS_NOT_SET', 409);
      await db.prepare('UPDATE hhba_auth_users SET password_hash=?, failed_pw_attempts=0, pw_locked_until=NULL WHERE phone=?').bind(await hashPassword(body.new_password), body.phone).run();
      return json({ ok: true });
    }

    // ---- 会话恢复（刷新保持登录） ----
    if (request.method === 'GET' && tail === '/me') {
      const session = await sessionOfBearer(db, request, nowMs);
      if (!session) return bad('SESSION_INVALID', 401);
      const user = await getUserByPhone(db, session.phone);
      return json({
        ok: true,
        phone: session.phone,
        username: user ? user.username : null,
        role: user ? user.role : null,
        created_at: user ? user.created_at : null,
        last_login_at: user ? user.last_login_at : null,
        has_credentials: Boolean(user && user.username),
      });
    }

    // ---- 退出：撤销当前 token ----
    if (request.method === 'POST' && tail === '/logout') {
      const body = await readBody(request);
      await revokeBearer(db, request, body.token || null, nowMs);
      return json({ ok: true });
    }

    return bad('METHOD_NOT_ALLOWED', 405);
  } catch (e) {
    if (e instanceof AuthError) return bad(e.code, e.status);
    console.error('HHBA_REAL_AUTH_FAILED', e?.name || 'error');
    return bad('AUTH_UNAVAILABLE', 503);
  }
}
