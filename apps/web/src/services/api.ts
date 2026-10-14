export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrfToken: string | null = null;
const API = import.meta.env.VITE_API_BASE || '/api/v1';
function errorMessage(detail: unknown) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(x => typeof x?.msg === 'string' ? x.msg : '请求字段无效').join('；');
  return '请求未能完成，请检查输入后重试。';
}

export function setCsrfToken(value: string | null) { csrfToken = value; }
export function getCsrfToken() { return csrfToken; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init.headers);
  if (csrfToken && !['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase())) headers.set('X-CSRF-Token', csrfToken);
  try {
    const response = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include', signal: controller.signal });
    const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new ApiError(response.status, errorMessage(body?.detail));
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(0, '请求超时，请检查本地服务后重试。');
    throw new ApiError(0, '无法连接 HHBA 本地服务。');
  } finally { window.clearTimeout(timer); }
}

export type User = { id: string; email: string; display_name: string; role: string; csrf_token?: string };
export type Organization = { id: string; legal_name: string; status: string; membership_role: string };
export type Requirement = { id: string; organization_id: string; title: string; description: string; location?: string | null; work_mode?: string | null; status: 'draft' | 'archived' };

export const api = {
  me: async () => { const user=await request<User>('/auth/me'); setCsrfToken(user.csrf_token || null); return user; },
  register: (email: string, password: string, displayName: string) => request<{ id: string }>('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, display_name: displayName }) }),
  login: async (email: string, password: string) => { const data = await request<{ csrf_token: string }>('/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); setCsrfToken(data.csrf_token); return data; },
  logout: async () => { await request('/auth/session', { method: 'DELETE' }); setCsrfToken(null); },
  upload: (file: File) => { const form = new FormData(); form.append('file', file); return request<{ resume_id: string; job_id: string; state: string }>('/me/resumes', { method: 'POST', body: form }); },
  resume: (id: string) => request<{ resume_id: string; filename: string; status: string; job_id?: string; job_state: string | null; error?: string | null; result?: ParseResult | null }>(`/me/resumes/${id}`),
  parse: (id: string) => request<{ job_id: string; state: string; result?: ParseResult; error?: string }>(`/me/resumes/${id}/parse`, { method: 'POST' }),
  retryParse: (id: string) => request<{ state: string }>(`/me/resumes/${id}/retry-parse`, { method: 'POST' }),
  applyDraft: (id: string) => request('/me/parsing-jobs/' + id + '/apply-draft', { method: 'POST' }),
  profile: () => request<{ profile: Profile | null }>('/me/profile'),
  saveProfile: (display_name: string, content: Record<string, unknown>) => request('/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name, content }) }),
  confirmProfile: () => request<{ status: string }>('/me/profile/confirm', { method: 'POST' }),
  publishProfile: () => request<{ slug: string; status: string }>('/me/profile/publish', { method: 'POST' }),
  withdrawProfile: () => request<{ status: string }>('/me/profile/withdraw', { method: 'POST' }),
  publicProfile: (slug: string) => request<{ display_name: string | null; headline?: string | null; skills: string[]; services: string[]; updated_at: string }>(`/public/profiles/${slug}`),
  consent: (type: string, granted: boolean) => request(`/me/consents/${type}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted }) }),
  organizations: () => request<{ organizations: Organization[] }>('/organizations'),
  createOrganization: (legal_name: string) => request<{ id: string; status: string }>('/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legal_name }) }),
  requirements: (organizationId: string) => request<{ items: Requirement[] }>(`/organizations/${organizationId}/hiring-requirements`),
  createRequirement: (organizationId: string, payload: { title: string; description: string; location?: string | null; work_mode?: string | null }) => request<Requirement>(`/organizations/${organizationId}/hiring-requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'draft' }) }),
  updateRequirement: (organizationId: string, requirementId: string, payload: Partial<Requirement>) => request<Requirement>(`/organizations/${organizationId}/hiring-requirements/${requirementId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
};

export type ParseResult = { raw_text_excerpt?: string; display_name?: { value: string | null; status: string }; skills?: { value: string; evidence?: string; status: string }[]; experiences?: unknown[]; education?: unknown[]; source?: string };
export type Profile = { id: string; status: 'draft' | 'confirmed' | 'published'; content: Record<string, unknown>; public_slug?: string | null };
