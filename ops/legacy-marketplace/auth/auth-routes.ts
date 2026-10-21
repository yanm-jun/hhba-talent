/**
 * 账户 HTTP 路由（Bun 风格，与主服务现有 handler 惯例一致）—— Phase 2
 * 落点: ops/legacy-marketplace/auth/auth-routes.ts
 *
 * 合并方式（合并到 railway-function-20261018.ts 时）:
 *   const auth = HHBA_AUTH_ENABLED === "1" ? await buildAuthHandler(...) : null;
 *   ... 在 fetch 分发链中，admin/engagement/saved 之后、白站静态之前:
 *   if (auth) { const r = await auth(req, url); if (r) return r; }
 * 开关关闭时整组路由不存在（404 由后续链路处理），演示登录页与现网行为不受影响；
 * 正式路径切换（前端注册/登录页签分别指向本组 register/login 接口、DemoAuthPage 仅保留为
 * 明确标注的演示入口）是单独的前端改动，补丁见 patches/frontend/。
 *
 * 接口契约（前缀 /api/v1，与前端 services/api.ts 既有 /api/v1 约定对齐）。
 * —— 注册/登录双入口（2026-10-21 用户拍板）：两个入口在 HTTP 层就是两条路径，不共用验码端点语义 ——
 *   POST /api/v1/auth/sms/send   {phone, purpose:'register'|'login'}
 *                                → {ok:true, purpose}
 *                                | 400 PHONE_INVALID / SMS_PURPOSE_INVALID（用途缺失或非法直接拒，不猜默认）
 *                                | 400 PHONE_NOT_REGISTERED（purpose=login 且未注册，提示先注册）
 *                                | 409 PHONE_ALREADY_REGISTERED（purpose=register 且已注册，提示直接登录）
 *                                | 429 SMS_*（限流）| 502 SMS_PROVIDER_ERROR
 *   POST /api/v1/auth/register   {phone, code}  → 201 {user, csrf_token} + Set-Cookie hhba_session_v1
 *                                （只走 register 用途码；成功即建号并进入登录态）
 *   POST /api/v1/auth/login      {phone, code}  → 200 {user, csrf_token} + Set-Cookie hhba_session_v1
 *                                （只走 login 用途码；未注册在此同样 PHONE_NOT_REGISTERED，永不建号）
 *   POST /api/v1/auth/sms/verify {phone, code, purpose}
 *                                → 兼容端点：必须显式带 purpose，按 purpose 分发到上面两条路径；
 *                                  缺 purpose 返回 400 SMS_PURPOSE_INVALID。不提供「无用途验码」。
 *   POST /api/v1/auth/logout     (Cookie + X-CSRF-Token)  → {ok:true} + 清 Cookie；会话服务端撤销
 *   GET  /api/v1/auth/me         (Cookie)                 → {user} | 401 AUTH_REQUIRED
 *   GET  /api/v1/saved           (Cookie)                 → {items:[jobId...]}（账户收藏，非设备收藏）
 *   PUT/DELETE /api/v1/saved/:jobId (Cookie + CSRF)       → {saved:boolean}
 * 错误文案：响应只回 {error: 内部错误码}，中文文案由前端按 auth-service.ts 的
 *   AUTH_ERROR_MESSAGES 同名映射表渲染（patches/frontend/api.sms-auth.md 内含同表），后端不回明文手机号以外的敏感信息。
 * 安全：状态变更校验 Origin（复用 engagement-core.mjs 的 validOrigin）+ CSRF 双提交；
 *       任何接口都不返回验证码/哈希。
 */
import { AuthService, AuthError, SESSION_COOKIE, SESSION_TTL_MS, csrfMatches, type AuthSuccess } from "./auth-service.ts";
import { isSmsPurpose } from "./sms-code.ts";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });

function sessionToken(req: Request): string | null {
  return (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,200})(?:;|$)`))?.[1] ?? null;
}
function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
const clearCookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

function authSuccessResponse(result: AuthSuccess, status: number) {
  const { user, token, csrf } = result;
  return json(
    {
      user: {
        id: user.id, nickname: user.nickname, account_role: user.accountRole,
        is_admin: user.isAdmin, registered_from: user.registeredFrom,
      },
      csrf_token: csrf,
    },
    status, { "Set-Cookie": sessionCookie(token) },
  );
}

export function buildAuthHandler(service: AuthService, opts: {
  validOrigin: (origin: string | null, url: string, configured: string) => boolean;
  publicDomain?: string;
  sessionSecret: string;
  clientIp: (req: Request) => string; // 只信任 TRUSTED_PROXY 注入的转发头，具体实现合并时按 Caddy 配置落地
}) {
  return async function handleAuth(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname;
    if (!path.startsWith("/api/v1/auth/") && !path.startsWith("/api/v1/saved")) return null;
    try {
      if (path === "/api/v1/auth/sms/send" && req.method === "POST") {
        const body = (await req.json().catch(() => null)) as { phone?: string; purpose?: unknown } | null;
        if (!body?.phone) return json({ error: "PHONE_INVALID" }, 400);
        if (!isSmsPurpose(body.purpose)) return json({ error: "SMS_PURPOSE_INVALID" }, 400);
        await service.sendCode(body.phone, body.purpose, opts.clientIp(req));
        // 不回传验证码有效期外的任何信息；前端按 60 秒倒计时即可
        return json({ ok: true, purpose: body.purpose });
      }
      if (path === "/api/v1/auth/register" && req.method === "POST") {
        const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
        if (!body?.phone || !body?.code) return json({ error: "CODE_INVALID" }, 400);
        return authSuccessResponse(await service.registerWithCode(body.phone, body.code), 201);
      }
      if (path === "/api/v1/auth/login" && req.method === "POST") {
        const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
        if (!body?.phone || !body?.code) return json({ error: "CODE_INVALID" }, 400);
        return authSuccessResponse(await service.loginWithCode(body.phone, body.code), 200);
      }
      if (path === "/api/v1/auth/sms/verify" && req.method === "POST") {
        // 兼容端点：用途必须由调用方显式声明，按用途分发；不声明就拒绝——不存在「验码即注册登录」。
        const body = (await req.json().catch(() => null)) as { phone?: string; code?: string; purpose?: unknown } | null;
        if (!body?.phone || !body?.code) return json({ error: "CODE_INVALID" }, 400);
        if (!isSmsPurpose(body.purpose)) return json({ error: "SMS_PURPOSE_INVALID" }, 400);
        const result = body.purpose === "register"
          ? await service.registerWithCode(body.phone, body.code)
          : await service.loginWithCode(body.phone, body.code);
        return authSuccessResponse(result, body.purpose === "register" ? 201 : 200);
      }
      // 以下接口需登录
      const auth = await service.authenticate(sessionToken(req));
      if (path === "/api/v1/auth/me") {
        if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);
        return json({ user: { id: auth.user.id } });
      }
      if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);
      const stateChanging = req.method !== "GET";
      if (stateChanging) {
        if (!opts.validOrigin(req.headers.get("origin"), req.url, opts.publicDomain ?? "")) return json({ error: "ORIGIN_DENIED" }, 403);
        if (!csrfMatches(auth.session, req.headers.get("x-csrf-token"), opts.sessionSecret)) return json({ error: "CSRF_DENIED" }, 403);
      }
      if (path === "/api/v1/auth/logout" && req.method === "POST") {
        await service.logout(auth.session.id);
        return json({ ok: true }, 200, { "Set-Cookie": clearCookie });
      }
      if (path === "/api/v1/saved" && req.method === "GET") {
        return json({ kind: "HHBA_ACCOUNT_SAVED_JOBS_V1", scope: "authenticated_account", items: await service.listSaved(auth.user.id) });
      }
      const m = path.match(/^\/api\/v1\/saved\/([A-Za-z0-9_-]{1,180})$/);
      if (m && (req.method === "PUT" || req.method === "DELETE")) {
        if (req.method === "PUT") await service.saveJob(auth.user.id, m[1]);
        else await service.unsaveJob(auth.user.id, m[1]);
        return json({ saved: req.method === "PUT", jobId: m[1], scope: "authenticated_account" });
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.code }, e.httpStatus);
      console.error("HHBA_AUTH_ERROR", e instanceof Error ? e.message : "unknown");
      return json({ error: "AUTH_UNAVAILABLE" }, 503);
    }
  };
}
