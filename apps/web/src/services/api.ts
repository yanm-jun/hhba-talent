export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrfToken: string | null = null;
const configuredApiBase = String(import.meta.env.VITE_API_BASE || '').trim();
const pagesPreview = import.meta.env.BASE_URL.startsWith('/hhba-talent/');
export const employerApiReady = !pagesPreview || /^https:\/\/[^\s/?#]+\/api\/v1\/?$/.test(configuredApiBase);
const API = configuredApiBase || '/api/v1';

function errorMessage(detail: unknown) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(x => typeof x?.msg === 'string' ? x.msg : '请求字段无效').join('；');
  return '请求未能完成，请检查输入后重试。';
}

export function setCsrfToken(value: string | null) { csrfToken = value; }
export function getCsrfToken() { return csrfToken; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!employerApiReady) throw new ApiError(503, '企业账户服务尚未连接，当前为页面预览。待独立后端上线后，企业认证、发布岗位和授权人才检索才会启用。');
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

export type AccountType = 'candidate' | 'recruiter';
export type User = { id: string; email: string; display_name: string; role: string; account_types?: AccountType[]; csrf_token?: string };
export type Organization = { id: string; legal_name: string; status: string; membership_role: string };
export type Verification = { organization_id: string; status: string; revision: number; legal_name: string | null; credit_code_masked: string | null; registered_location: string | null; recruitment_subject_type: 'employer'; review_reason_code: string | null; next_review_due_at: string | null; representative?: { real_name: string | null; job_title: string | null; relationship_type: string | null } | null; documents: { id: string; document_type: string; filename: string; size_bytes?: number; security_status?: string; created_at: string }[] };
export type OnboardingApplication = { organization_id: string; legal_name: string; membership_role: string; organization_status: string; verification_status: string; revision: number };
export type Requirement = { id: string; organization_id: string; title: string; description: string; location?: string | null; work_mode?: string | null; status: 'draft' | 'archived'; created_at?: string; updated_at?: string };
export type ResumeSummary = { resume_id: string; filename: string; status: string; job_id?: string | null; job_state: string | null; created_at?: string };
export type Consents = { enterprise_search: boolean; public_share: boolean; search_engine_index: boolean };
export type EnterpriseProfileFields = { display_name: string | null; headline: string | null; capability_summary: string | null; skills: string[]; industries: string[]; location: string | null; service_regions: string[]; work_modes: string[]; work_years: number | null; project_summaries: string[] };
export type EmployerPosting = { id:string;company:string;title:string;description:string;requirements:string;location:string;work_mode:'onsite'|'hybrid'|'remote';recruitment_type:'SOCIAL'|'CAMPUS'|'INTERNSHIP';apply_url:string;status:'draft'|'pending_review'|'published'|'rejected'|'closed';published_at?:string|null;expires_at?:string|null;review_reason?:string|null;source_type:'HHBA_VERIFIED_EMPLOYER' };
export type EmployerPostingInput = Pick<EmployerPosting,'title'|'description'|'requirements'|'location'|'work_mode'|'recruitment_type'|'apply_url'>;
export type TalentSearchInput = {keywords?:string;skills?:string[];industry?:string;region?:string;work_mode?:string;work_years_min?:number;work_years_max?:number;page?:number;page_size?:number};
export type TalentSearchResponse = {items:TalentSearchCandidate[];page:number;page_size:number;has_more:boolean};

export type CandidateReference = string;
export type TalentMatchReason = { field: 'skill' | 'industry' | 'region' | 'work_mode' | 'work_years' | 'capability'; value: string | number; expanded: boolean };
export type TalentSearchCandidate = { candidate_ref: CandidateReference; display_name: string | null; headline: string | null; skills: string[]; industries: string[]; location: string | null; service_regions: string[]; work_modes: string[]; work_years: number | null; project_summaries: string[]; match_reasons: TalentMatchReason[] };

export const api = {
  me: async () => { const user=await request<User>('/auth/me'); setCsrfToken(user.csrf_token || null); return user; },
  register: (email: string, password: string, displayName: string, accountType: AccountType = 'candidate') => request<{ id: string; account_type: AccountType }>('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, display_name: displayName, account_type: accountType }) }),
  login: async (email: string, password: string, accountType?: AccountType) => { const data = await request<{ csrf_token: string }>('/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, account_type: accountType }) }); setCsrfToken(data.csrf_token); return data; },
  logout: async () => { await request('/auth/session', { method: 'DELETE' }); setCsrfToken(null); },
  upload: (file: File) => { const form = new FormData(); form.append('file', file); return request<{ resume_id: string; job_id: string; state: string }>('/me/resumes', { method: 'POST', body: form }); },
  resumes: () => request<{ items: ResumeSummary[] }>('/me/resumes'),
  resume: (id: string) => request<{ resume_id: string; filename: string; status: string; job_id?: string; job_state: string | null; error?: string | null; result?: ParseResult | null }>(`/me/resumes/${id}`),
  parse: (id: string) => request<{ job_id: string; state: string; result?: ParseResult; error?: string }>(`/me/resumes/${id}/parse`, { method: 'POST' }),
  retryParse: (id: string) => request<{ state: string }>(`/me/resumes/${id}/retry-parse`, { method: 'POST' }),
  applyDraft: (id: string) => request('/me/parsing-jobs/' + id + '/apply-draft', { method: 'POST' }),
  profile: () => request<{ profile: Profile | null }>('/me/profile'),
  enterpriseProfilePreview: () => request<{ eligible: boolean; fields: EnterpriseProfileFields | null }>('/me/profile/enterprise-preview'),
  saveProfile: (display_name: string, content: Record<string, unknown>) => request('/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name, content }) }),
  confirmProfile: () => request<{ status: string }>('/me/profile/confirm', { method: 'POST' }),
  publishProfile: () => request<{ slug: string; status: string }>('/me/profile/publish', { method: 'POST' }),
  withdrawProfile: () => request<{ status: string }>('/me/profile/withdraw', { method: 'POST' }),
  publicProfile: (slug: string) => request<{ display_name: string | null; headline?: string | null; skills: string[]; services: string[]; updated_at: string }>(`/public/profiles/${slug}`),
  consent: (type: string, granted: boolean) => request(`/me/consents/${type}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted }) }),
  consents: () => request<Consents>('/me/consents'),
  organizations: () => request<{ organizations: Organization[] }>('/organizations'),
  createOrganization: (legal_name: string) => request<{ id: string; status: string }>('/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legal_name }) }),
  verification: (organizationId: string) => request<Verification>(`/recruiter/organizations/${organizationId}/verification`),
  onboarding: () => request<{ applications: OnboardingApplication[] }>('/recruiter/onboarding'),
  saveVerificationCompany: (organizationId: string, payload: { legal_name: string; credit_code: string; registered_location: string; recruitment_subject_type: 'employer' | 'agency' }) => request<Verification>(`/recruiter/organizations/${organizationId}/verification/company`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  saveVerificationRepresentative: (organizationId: string, payload: { real_name: string; job_title: string; relationship_type: 'legal_representative' | 'business_owner' | 'hr_lead' | 'hr_recruiter' | 'authorized_agent' }) => request<Verification>(`/recruiter/organizations/${organizationId}/verification/representative`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  saveVerification: (organizationId: string, payload: { legal_name: string; credit_code: string; registered_location: string; recruitment_subject_type: 'employer'; real_name: string; job_title: string }) => request<Verification>(`/recruiter/organizations/${organizationId}/verification`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  uploadVerificationDocument: (organizationId: string, documentType: 'business_license' | 'authorization_letter', file: File) => { const form=new FormData(); form.append('file',file); return request<{ id:string }>(`/recruiter/organizations/${organizationId}/verification/documents?document_type=${documentType}`,{method:'POST',body:form}); },
  submitVerification: (organizationId: string) => request<{ status:string }>(`/recruiter/organizations/${organizationId}/verification/submit`,{method:'POST'}),
  requirements: (organizationId: string) => request<{ items: Requirement[] }>(`/organizations/${organizationId}/hiring-requirements`),
  createRequirement: (organizationId: string, payload: { title: string; description: string; location?: string | null; work_mode?: string | null }) => request<Requirement>(`/organizations/${organizationId}/hiring-requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'draft' }) }),
  updateRequirement: (organizationId: string, requirementId: string, payload: Partial<Requirement>) => request<Requirement>(`/organizations/${organizationId}/hiring-requirements/${requirementId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  postings: (oid:string) => request<{items:EmployerPosting[]}>(`/organizations/${oid}/postings`),
  createPosting: (oid:string,payload:EmployerPostingInput) => request<EmployerPosting>(`/organizations/${oid}/postings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  updatePosting: (oid:string,id:string,payload:EmployerPostingInput) => request<EmployerPosting>(`/organizations/${oid}/postings/${id.replace(/^employer-/,'')}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  submitPosting: (oid:string,id:string) => request<{status:string}>(`/organizations/${oid}/postings/${id.replace(/^employer-/,'')}/submit`,{method:'POST'}),
  closePosting: (oid:string,id:string) => request<{status:string}>(`/organizations/${oid}/postings/${id.replace(/^employer-/,'')}/close`,{method:'POST'}),
  talentSearch: (oid:string,payload:TalentSearchInput) => request<TalentSearchResponse>(`/organizations/${oid}/talent-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  adminVerificationQueue: () => request<{items:{organization_id:string;legal_name:string;status:string;revision:number;submitted_at?:string;representative_name?:string;evidence_snapshot_id?:string}[]}>('/admin/verification/organizations'),
  adminVerificationDetail: (oid:string) => request<{verification:Verification;evidence_snapshot:{id:string;evidence_version:number;manifest_sha256:string}|null;reviews:{outcome:string;reason_code:string}[]}>(`/admin/verification/organizations/${oid}`),
  publicEmployerPostings: (q='',limit=20,offset=0) => request<{items:EmployerPosting[];total:number;limit:number;offset:number}>(`/public/employer-postings?q=${encodeURIComponent(q.slice(0,100))}&limit=${Math.max(1,Math.min(30,limit))}&offset=${Math.max(0,Math.min(3000,offset))}`),
  publicEmployerPosting: (id:string) => request<EmployerPosting>(`/public/employer-postings/${encodeURIComponent(id.replace(/^employer-/,''))}`),
  adminPendingPostings: () => request<{items:EmployerPosting[]}>('/admin/employer-postings'),
  adminReviewPosting: (id:string,decision:'approved'|'rejected',reason_code:string) => request<{status:string}>(`/admin/employer-postings/${id.replace(/^employer-/,'')}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason_code})}),


};

export type ParseResult = { raw_text_excerpt?: string; display_name?: { value: string | null; status: string }; skills?: { value: string; evidence?: string; status: string }[]; experiences?: unknown[]; education?: unknown[]; source?: string };
export type Profile = { id: string; status: 'draft' | 'confirmed' | 'published'; display_name?: string | null; content: Record<string, unknown>; public_slug?: string | null };
