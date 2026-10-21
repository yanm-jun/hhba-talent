/**
 * 账户 HTTP 路由（Bun 风格，与主服务现有 handler 惯例一致）—— Phase 2
 * 落点: ops/legacy-marketplace/auth/auth-routes.ts
 *
 * 合并方式（合并到 railway-function-20261018.ts 时）:
 *   const auth = HHBA_AUTH_ENABLED === "1" ? await buildAuthHandler(...) : null;
 *   ... 在 fetch 分发链中，admin/engagement/saved 之后、白站静态之前:
 *   if (auth) { const r = await auth(req, url); if (r) return r; }
 * 开关关闭时整组路由不存在（404 由后续链路处理），演示登录页与现网行为不受影响；
 * 正式路径切换（前端把 /auth 指向本组接口、DemoAuthPage 仅保留为明确标注的演示入口）是单独的前端改动，见 MANIFEST。
 *
 * 接口契约（前缀 /api/v1，与前端 services/api.ts 既有 /api/v1 约定对齐）:
 *   POST /api/v1/auth/sms/send   {phone}                 → {ok:true} | 400 PHONE_INVALID | 429 SMS_* | 502 SMS_PROVIDER_ERROR
 *   POST /api/v1/auth/sms/verify {phone, code}            → {user, csrf_token} + Set-Cookie hhba_session_v1（登录或注册）
 *   POST /api/v1/auth/logout     (Cookie + X-CSRF-Token)  → {ok:true} + 清 Cookie；会话服务端撤销
 *   GET  /api/v1/auth/me         (Cookie)                 → {user} | 401 AUTH_REQUIRED
 *   GET  /api/v1/saved           (Cookie)                 → {items:[jobId...]}（账户收藏，非设备收藏）
 *   PUT/DELETE /api/v1/saved/:jobId (Cookie + CSRF)       → {saved:boolean}
 * 安全：状态变更校验 Origin（复用 engagement-core.mjs 的 validOrigin）+ CSRF 双提交；
 *       任何接口都不返回手机号全号以外的敏感字段，更不返回验证码/哈希。
 */
import { AuthService, AuthError, SESSION_COOKIE, SESSION_TTL_MS, csrfMatches } from "./auth-service.ts";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });

function sessionToken(req: Request): string | null {
  return (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]{20,200})(?:;|$)`))?.[1] ?? null;
}
function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
const clearCookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

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
        const body = (await req.json().catch(() => null)) as { phone?: string } | null;
        if (!body?.phone) return json({ error: "PHONE_INVALID" }, 400);
        await service.sendCode(body.phone, opts.clientIp(req));
        // 不回传验证码有效期外的任何信息；前端按 60 秒倒计时即可
        return json({ ok: true });
      }
      if (path === "/api/v1/auth/sms/verify" && req.method === "POST") {
        const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
        if (!body?.phone || !body?.code) return json({ error: "CODE_INVALID" }, 400);
        const { user, token, csrf } = await service.loginWithCode(body.phone, body.code);
        return json(
          { user: { id: user.id, nickname: user.nickname, account_role: user.accountRole, is_admin: user.isAdmin }, csrf_token: csrf },
          200, { "Set-Cookie": sessionCookie(token) },
        );
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
