import { ApiError, type User } from './api';
// 测试站真实短信登录接线（/api/real-auth/*）的源码级回填。
// 与正式 /api/v1/auth/* 不同：测试后端不走 employerApiReady 门控，
// 令牌存在 localStorage 的 hhba_real_auth_token，与测试站构建产物一致。
// 正式静态预览仍保持非运行状态：只有 VITE_HHBA_REAL_AUTH_ENABLED='1'
// 时 realAuthReady 才为真；测试部署构建时需开启该变量。
// 测试后端只签发 candidate 角色（注册时 role 固定为 candidate），
// 因此本客户端只用于求职者手机号登录，不用于招聘方身份。
export const REAL_AUTH_TOKEN_KEY = 'hhba_real_auth_token';
export const realAuthReady = import.meta.env.VITE_HHBA_REAL_AUTH_ENABLED === '1';
const REAL_AUTH_BASE = '/api/real-auth';
export type RealAuthHealth = {
  ok: boolean;
  service: string;
  pnvs_configured: boolean;
  pnvs_credential_source: string | null;
  pnvs_credential_role: string | null;
  pnvs_credential_expires_at: number | null;
  sms_provider: string;
  sms_sign_name: string;
  sms_template: string;
  sms_status: string;
  demo_login: string;
};
export type RealAuthMe = {
  ok: boolean;
  phone: string;
  username: string | null;
  role: string | null;
  created_at: string | null;
  last_login_at: string | null;
  has_credentials: boolean;
};
export type RealAuthSession = { ok: boolean; phone: string; username?: string; token: string };
export function getRealAuthToken(): string | null {
  try {
    return window.localStorage.getItem(REAL_AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setRealAuthToken(token: string): void {
  try {
    window.localStorage.setItem(REAL_AUTH_TOKEN_KEY, token);
  } catch {
    // 存储不可用时仍可继续本次会话，刷新后需重新登录。
  }
}
export function clearRealAuthToken(): void {
  try {
    window.localStorage.removeItem(REAL_AUTH_TOKEN_KEY);
  } catch {
    // 忽略清理失败。
  }
}
export function realAuthPhoneValid(phone: string): boolean {
  return /^1[3-9][0-9]{9}$/.test(phone);
}
// 与测试后端 okUsername 一致：2-20 位，首字符字母或中文，其余字母、数字、下划线或中文。
export function realAuthUsernameValid(username: string): boolean {
  return /^[A-Za-z\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]{1,19}$/.test(username.trim());
}
// 与测试后端 okPassword 一致：8-64 位，同时含字母和数字。
export function realAuthPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 64 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
function realAuthErrorMessage(body: unknown): string {
  const code =
    typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error?: unknown }).error)
      : '';
  switch (code) {
    case 'INVALID_PHONE':
      return '请填写正确的中国大陆 11 位手机号。';
    case 'USER_EXISTS':
      return '该手机号已注册，请直接登录。';
    case 'USERNAME_TAKEN':
      return '该称呼已被使用，请换一个。';
    case 'INVALID_USERNAME':
      return '称呼需为 2-20 位，首字符为字母或中文，其余为字母、数字、下划线或中文。';
    case 'WEAK_PASSWORD':
      return '密码需为 8-64 位，且同时包含字母和数字。';
    case 'PASSWORD_MISMATCH':
      return '两次输入的密码不一致。';
    case 'CODE_INVALID_OR_EXPIRED':
      return '验证码无效或已过期，请重新获取。';
    case 'USER_NOT_REGISTERED':
      return '该手机号尚未注册，请先注册。';
    case 'BAD_CREDENTIALS':
      return '称呼或密码不正确。';
    case 'SESSION_INVALID':
      return '会话已失效，请重新登录。';
    case 'CREDENTIALS_NOT_SET':
      return '该账户尚未设置称呼与密码，请先用短信登录后设置。';
    case 'CREDENTIALS_ALREADY_SET':
      return '该账户已设置称呼与密码。';
    case 'PNVS_NOT_CONFIGURED':
    case 'PNVS_SEND_FAILED':
      return '短信服务暂时不可用，请稍后再试。';
    default:
      return code || '请求未完成，请检查后重试。';
  }
}
async function realRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getRealAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetch(`${REAL_AUTH_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const body = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null;
    if (!response.ok) throw new ApiError(response.status, realAuthErrorMessage(body));
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, '请求超时，请检查本地服务后重试。');
    }
    throw new ApiError(0, '无法连接 HHBA 本地服务。');
  } finally {
    window.clearTimeout(timer);
  }
}
function post<T>(path: string, data: unknown): Promise<T> {
  return realRequest<T>(path, { method: 'POST', body: JSON.stringify(data) });
}
// 把测试后端 /me 的返回映射为前端已有的 User 形状。
// 测试后端没有邮箱与展示名称字段：id 取手机号，
// display_name 取称呼（无称呼时取手机号），角色只映射 candidate。
export function realAuthToUser(me: RealAuthMe): User {
  return {
    id: me.phone,
    email: '',
    display_name: me.username ?? me.phone,
    role: me.role ?? 'candidate',
    account_types: me.role === 'candidate' ? ['candidate'] : [],
  };
}
export const realAuth = {
  health: () => realRequest<RealAuthHealth>('/health'),
  sendCode: (phone: string, mode: 'login' | 'register') =>
    post<{ ok: boolean }>(`/${mode}/send-code`, { phone }),
  sendResetCode: (phone: string) => post<{ ok: boolean }>('/password/reset/send-code', { phone }),
  register: async (data: {
    phone: string;
    code: string;
    username: string;
    password: string;
    password_confirm: string;
  }) => {
    const session = await post<RealAuthSession>('/register', data);
    setRealAuthToken(session.token);
    return session;
  },
  loginSms: async (phone: string, code: string) => {
    const session = await post<RealAuthSession>('/login', { phone, code });
    setRealAuthToken(session.token);
    return session;
  },
  loginPassword: async (username: string, password: string) => {
    const session = await post<RealAuthSession>('/login/password', { username, password });
    setRealAuthToken(session.token);
    return session;
  },
  setCredentials: (data: { username: string; password: string; password_confirm: string }) =>
    post<{ ok: boolean; username: string }>('/set-credentials', data),
  resetPassword: (data: {
    phone: string;
    code: string;
    new_password: string;
    new_password_confirm: string;
  }) => post<{ ok: boolean }>('/password/reset', data),
  me: () => realRequest<RealAuthMe>('/me'),
  logout: async () => {
    const token = getRealAuthToken();
    try {
      await post<{ ok: boolean }>('/logout', { token });
    } finally {
      clearRealAuthToken();
    }
  },
};
