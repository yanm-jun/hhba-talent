export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrfToken: string | null = null;
const configuredApiBase = String(import.meta.env.VITE_API_BASE || '').trim();
// Railway's ATS reader is NOT the authenticated HHBA candidate/employer API.
// Enable account operations only after deploying and verifying that separate API.
const accountApiEnabled = import.meta.env.VITE_HHBA_ACCOUNT_API_ENABLED==='1';
export const employerApiReady = accountApiEnabled && (configuredApiBase==='/api/v1' || /^https:\/\/[^\s/?#]+\/api\/v1\/?$/.test(configuredApiBase));
// Do not send SMS from a public static site. Enable only after dedicated phone auth backend is verified.
export const phoneAuthReady = employerApiReady && import.meta.env.VITE_HHBA_PHONE_AUTH_ENABLED==='1';
const API = configuredApiBase || '/api/v1';
function errorMessage(detail: unknown) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(x => typeof x?.msg === 'string' ? x.msg : '请求字段无效').join('；');
  return '请求未能完成，请检查输入后重试。';
}

export function setCsrfToken(value: string | null) { csrfToken = value; }
export function getCsrfToken() { return csrfToken; }

// Enterprise recruitment is no longer a HHBA product. Fail closed before
// request/CSRF/network handling, including from stale code or bookmarked pages.
// Do not delete or mutate historical records here; lawful retention is separate.
export const legacyEnterpriseRecruitmentRetired = true;
const retiredBusinessEndpoint = (path:string):boolean => {
  const route=path.split('?',1)[0];
  const prefixes=[
    '/organizations','/recruiter','/employer','/employee','/employee-feedback','/public/employer-postings',
    '/public/organizations','/me/employer-applications','/me/recruitment-responsibilities',
    '/admin/verification','/admin/employer-postings','/admin/recruitment-responsibilities',
    '/admin/aid-applications','/admin/client-introductions','/admin/order-proofs',
    '/admin/evidence','/admin/improvements','/admin/publication',
    '/admin/scoring','/admin/appeals','/me/profile/enterprise-preview',
    '/me/consents/enterprise_search'
  ];
  return prefixes.some(prefix=>route===prefix||route.startsWith(prefix+'/'));
};
const retiredRecruiterSession = (path:string,body:RequestInit['body']):boolean => {
  if(!['/auth/register','/auth/session','/auth/phone/code','/auth/phone/session'].includes(path))return false;
  if(typeof body!=='string')return false;
  try {
    const value=JSON.parse(body);
    return value!==null&&typeof value==='object'&&value.account_type==='recruiter';
  }catch{return false;}
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if(retiredBusinessEndpoint(path)||retiredRecruiterSession(path,init.body))
    throw new ApiError(410,'HHBA 企业招聘账户及站内招聘业务已停止服务。');
  if (!employerApiReady) throw new ApiError(503, 'HHBA 企业与个人账户后台尚未完成接入。岗位搜索正常使用，但账户注册、企业认证、职位发布暂不可操作。');
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
export type ApplicationSharedFields = {display_name:string|null;headline:string|null;skills:string[];location:string|null;work_years:number|null};
export type CandidateJobPreview = {eligible:boolean;reason:'CONFIRMED_PROFILE_REQUIRED'|'ALREADY_APPLIED'|null;posting:{id:string;company:string;title:string};shared_fields:ApplicationSharedFields|null;already_applied:boolean};
export type CandidateJobApplication = {id:string;posting_id:string;company:string;title:string;location:string;status:string;created_at:string;updated_at:string};
export type EmployerJobApplication = {id:string;posting_id:string;shared_fields:ApplicationSharedFields;cover_note:string;status:string;created_at:string;updated_at:string};
export type ApplicationStage = 'submitted'|'reviewing'|'shortlisted'|'interview'|'rejected'|'hired'|'withdrawn';
export type RecruitmentResponsibility = {application_id:string;organization_id:string;posting_id:string;state:'awaiting'|'reviewing'|'responded'|'overdue'|'paused'|'withdrawn';delivered_at:string;response_due_at:string;first_meaningful_response_at:string|null;responsible_user_id:string|null;response_kind:'continued'|'declined'|'cancelled'|null;calendar_version:string};
export type RecruitmentResponsibilityQueue = {items:RecruitmentResponsibility[];total:number|null;as_of:string;status:'connected'};

export type EmployerPosting = { id:string;company:string;title:string;description:string;requirements:string;location:string;work_mode:'onsite'|'hybrid'|'remote';recruitment_type:'SOCIAL'|'CAMPUS'|'INTERNSHIP';apply_url:string;status:'draft'|'pending_review'|'published'|'rejected'|'closed';published_at?:string|null;expires_at?:string|null;review_reason?:string|null;source_type:'HHBA_VERIFIED_EMPLOYER' };
export type EmployerPostingInput = Pick<EmployerPosting,'title'|'description'|'requirements'|'location'|'work_mode'|'recruitment_type'|'apply_url'>;
export type EmployeeFeedbackRatings = {pay:number;insurance:number;rest:number;respect:number;development:number};
export type PublicFeedbackAggregate = {status:'not_public'|'published';period:string;response_band?:'at_least_10';scores_out_of_5?:EmployeeFeedbackRatings;notice?:string};
export type HHBAAidApplication = {id:string;organization_id:string;service_type:'client_introduction'|'supply_chain'|'visibility';business_summary:string;capacity_summary:string;capacity_evidence_id:string;status:'submitted'|'needs_info'|'approved'|'declined'|'suspended'|'closed';created_at:string;reviewed_at:string|null;notice:string};
export type HHBAIntroduction = {id:string;organization_id:string;application_id:string;buyer_reference:string;buyer_sector:string;opportunity_type:string;purpose:string;stage:'identified'|'consent_verified'|'introduced'|'in_discussion'|'not_pursued'|'closed';created_at:string;order_status:'independently_verified'|'not_verified';notice:string};
export type HHBAOrderClaim = {id:string;status:'pending'|'verified'|'rejected';notice:string};
export type HHBAPublicGrowthProfile = {publication:'pending'|'published';trust:{status:string;score:number|null};care:{status:string;score:number|null};version:number|null;rule_version:string|null;updated_at:string|null;improvements:PublicHHBAImprovement[];notice:string;aid_eligibility:'not_assessed'};
export type HHBAPublicVersion = {version:number;released_on:string;status:'withdrawn'|'historical_version'};
export type HHBAPublicationCase = {id:string;organization_id:string;run_id:string;status:'prepared'|'first_approved'|'published'|'rejected'|'revoked';rule_version:string;feedback_period:string;version:number|null;prepared_at:string;published_at:string|null;candidate:{trust:number;care:number}};
export type HHBAImprovement = {id:string;organization_id:string;evidence_id:string;category:string;title:string;description:string;effective_date:string;status:'submitted'|'needs_more_info'|'approved'|'rejected'|'revoked';created_at:string;updated_at:string;public_summary:string|null};
export type PublicHHBAImprovement = {id:string;category:string;summary:string;effective_date:string;reviewed_date:string;evidence_kind:'hhba_independently_verified_document';rule_version:string;score_change:'not_claimed';notice:string};
export type HHBAAppeal = {id:string;organization_id:string;kind:'employer'|'employee_privacy';issue:string;status:'submitted'|'under_review'|'needs_more_info'|'correction_required'|'rejected'|'resolved_after_correction';created_at:string;updated_at:string;target_type?:'evidence'|'scoring_run';target_id?:string;explanation?:string;resolution?:string|null};
export type ScoringSide = {status:'pending'|'calculated_private';score:number|null;missing:string[]};
export type ScoringCandidate = {rule_version:string;visibility:'internal_only';publication:string;help_eligibility:string;trust:ScoringSide;care:ScoringSide;inputs:{certified:boolean;evidence_categories:string[];feedback_status:string}};
export type PrivateScoringRun = {run_id:string;created_at:string;rule_version:string;status:'internal_only';candidate:ScoringCandidate};
export type EmployerEvidenceCategory = 'pay_and_contracts'|'social_insurance'|'working_hours'|'employee_development'|'recruitment_integrity'|'business_integrity';
export type EmployerEvidence = {id:string;organization_id:string;category:EmployerEvidenceCategory;statement:string;status:'pending_review'|'verified'|'needs_more_info'|'rejected'|'expired'|'disputed';security_status:'pending_scan'|'clean'|'rejected';file_mime:string;file_size_bytes:number;created_at:string;status_updated_at:string};

export type TalentSearchInput = {keywords?:string;skills?:string[];industry?:string;region?:string;work_mode?:string;work_years_min?:number;work_years_max?:number;page?:number;page_size?:number};
export type TalentSearchResponse = {items:TalentSearchCandidate[];page:number;page_size:number;has_more:boolean};

export type PublicEmployerJob = EmployerPosting & {published_at:string;expires_at:string;notice:string};
export type EmployerPublicJobs = {items:PublicEmployerJob[];total:number;limit:number;offset:number};
export type EmployerVerificationQueue = {items:{organization_id:string;legal_name:string;status:string;revision:number;submitted_at:string|null;representative_name:string|null;evidence_snapshot_id:string|null}[]};
export type EmployerVerificationAdminDetail = {verification:Verification;evidence_snapshot:{id:string;evidence_version:number;manifest_sha256:string}|null;reviews:{outcome:string;reason_code:string;evidence_version:number;created_at:string}[]};
export type CandidateReference = string;
export type TalentMatchReason = { field: 'skill' | 'industry' | 'region' | 'work_mode' | 'work_years' | 'capability'; value: string | number; expanded: boolean };
export type TalentSearchCandidate = { candidate_ref: CandidateReference; display_name: string | null; headline: string | null; skills: string[]; industries: string[]; location: string | null; service_regions: string[]; work_modes: string[]; work_years: number | null; project_summaries: string[]; match_reasons: TalentMatchReason[] };

export const api = {
  sendPhoneCode: (phone:string,account_type:AccountType,mode:'login'|'register') => {
    if(!phoneAuthReady)throw new ApiError(503,'短信登录服务尚未接入。');
    return request<{retry_after_seconds:number}>('/auth/phone/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,account_type,mode})});
  },
  phoneSession: async (data:{phone:string;code:string;account_type:AccountType;mode:'login'|'register';display_name?:string}) => {
    if(!phoneAuthReady)throw new ApiError(503,'短信登录服务尚未接入。');
    const response=await request<{csrf_token:string}>('/auth/phone/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    setCsrfToken(response.csrf_token);
    return response;
  },
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

};

export type ParseResult = { raw_text_excerpt?: string; display_name?: { value: string | null; status: string }; skills?: { value: string; evidence?: string; status: string }[]; experiences?: unknown[]; education?: unknown[]; source?: string };
export type Profile = { id: string; status: 'draft' | 'confirmed' | 'published'; display_name?: string | null; content: Record<string, unknown>; public_slug?: string | null };
