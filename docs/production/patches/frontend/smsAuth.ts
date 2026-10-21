/**
 * 手机号验证码账户接口（前端）—— 合并补丁整文件
 * 落点: apps/web/src/services/smsAuth.ts（新增文件，不改 services/api.ts 的既有企业/邮箱接口）
 *
 * 为什么独立成文件而不是塞进 api.ts:
 *   api.ts 的 request() 被 employerApiReady 开关锁死（VITE_HHBA_ACCOUNT_API_ENABLED），
 *   那是旧邮箱账户 API 的门；短信账户是同进程 Bun 服务的 /api/v1 路由，不受该开关控制，
 *   共用同一套 ApiError 形状但走独立的轻量 fetch 封装，避免动旧接口的任何行为。
 * 若合并时希望 api.ts 也能引用，在 api.ts 末尾加一行:
 *   export { smsAuth, type SmsUser, type SmsPurpose } from './smsAuth';
 *
 * 双入口纪律（与后端 auth-service.ts 一一对应，前端只呈现不绕过）:
 *   - 发码必须带 purpose: 'register' | 'login'，与当前页签严格一致，切换页签后已发码作废重发；
 *   - 注册页签只调 registerBySms，登录页签只调 loginBySms，不存在共用「验码进入」按钮；
 *   - 后端错误只回错误码，中文文案由本文件的 AUTH_ERROR_MESSAGES 映射（与后端同名表保持一致）。
 */
export type SmsPurpose = "register" | "login";

export interface SmsUser {
  id: string;
  nickname: string | null;
  account_role: "candidate" | "recruiter";
  is_admin: boolean;
  registered_from: "register" | "admin";
}

/** 错误码 → 用户文案（单一事实源的镜像：后端 auth-service.ts AUTH_ERROR_MESSAGES，改一处须同步另一处）。 */
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
  AUTH_REQUIRED: "请先登录",
  ORIGIN_DENIED: "请求来源异常，请刷新页面后重试",
  CSRF_DENIED: "会话已过期，请重新登录",
  SMS_PROVIDER_ERROR: "短信发送失败，请稍后再试",
  AUTH_UNAVAILABLE: "账户服务暂不可用，请稍后再试",
};

export class SmsAuthError extends Error {
  constructor(public code: string, public status: number) {
    super(AUTH_ERROR_MESSAGES[code] ?? "请求失败，请稍后再试");
    this.name = "SmsAuthError";
  }
}

const BASE = "/api/v1";
let csrfToken: string | null = null;
export function getSmsCsrfToken(): string | null { return csrfToken; }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (csrfToken && init.method && init.method !== "GET") headers.set("X-CSRF-Token", csrfToken);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new SmsAuthError("AUTH_UNAVAILABLE", 0);
  }
  const body = (await response.json().catch(() => null)) as { error?: string } & Record<string, unknown> | null;
  if (!response.ok) throw new SmsAuthError(body?.error ?? "AUTH_UNAVAILABLE", response.status);
  return body as T;
}
const post = <T>(path: string, data?: unknown) =>
  call<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

interface AuthSuccessBody { user: SmsUser; csrf_token: string }

export const smsAuth = {
  /** 发送验证码：purpose 与当前入口绑定，注册页签传 'register'，登录页签传 'login'。 */
  sendSmsCode: (phone: string, purpose: SmsPurpose) =>
    post<{ ok: true; purpose: SmsPurpose }>("/auth/sms/send", { phone, purpose }),

  /** 注册：只接受注册用途验证码；成功即建号并进入登录态（201）。 */
  registerBySms: async (phone: string, code: string): Promise<SmsUser> => {
    const data = await post<AuthSuccessBody>("/auth/register", { phone, code });
    csrfToken = data.csrf_token;
    return data.user;
  },

  /** 登录：只接受登录用途验证码；未注册手机号会被后端拒绝且不会建号。 */
  loginBySms: async (phone: string, code: string): Promise<SmsUser> => {
    const data = await post<AuthSuccessBody>("/auth/login", { phone, code });
    csrfToken = data.csrf_token;
    return data.user;
  },

  /** 当前会话用户（个人中心守卫用）。未登录抛 SmsAuthError(AUTH_REQUIRED)。 */
  me: async (): Promise<SmsUser> => {
    const data = await call<{ user: SmsUser }>("/auth/me");
    return data.user;
  },

  logout: async (): Promise<void> => {
    await post("/auth/logout");
    csrfToken = null;
  },

  // —— 账户级收藏（/api/v1/saved，与设备收藏 services/savedJobs 完全分离，互不读写）——
  listSavedJobIds: async (): Promise<string[]> => {
    const data = await call<{ items: string[] }>("/saved");
    return data.items;
  },
  setSavedJob: (jobId: string, saved: boolean) =>
    call<{ saved: boolean; jobId: string }>(`/saved/${encodeURIComponent(jobId)}`, { method: saved ? "PUT" : "DELETE" }),
};
