export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrfToken: string | null = null;
const configuredApiBase = String(import.meta.env.VITE_API_BASE || '').trim();
// Railway's ATS reader is NOT the authenticated HHBA candidate/employer API.
// Enable account operations only after deploying and verifying that separate API.
const accountApiEnabled = import.meta.env.VITE_HHBA_ACCOUNT_API_ENABLED==='1';
export const employerApiReady = accountApiEnabled && (configuredApiBase==='/api/v1' || /^https:\/\/[^\s/?#]+\/api\/v1\/?$/.test(configuredApiBase));
// Evidence is an additional, independently activated capability. Existing employer API readiness is insufficient.
export const recruitmentResponsibilityApiReady = employerApiReady && import.meta.env.VITE_HHBA_RECRUITMENT_RESPONSIBILITY_API_ENABLED==='1';
export const evidenceApiReady = employerApiReady && import.meta.env.VITE_HHBA_EVIDENCE_API_ENABLED==='1';
// Employee verification and protected feedback run on their own trusted service flag.
export const employeeFeedbackApiReady = employerApiReady && import.meta.env.VITE_HHBA_EMPLOYEE_FEEDBACK_API_ENABLED==='1';
// Scoring candidates are an independent reviewer-only capability; not public scores.
export const scoringApiReady = employerApiReady && import.meta.env.VITE_HHBA_SCORING_API_ENABLED==='1';
// Appeals require a separate trusted server-side enterprise/employee review service.
export const appealsApiReady = employerApiReady && import.meta.env.VITE_HHBA_APPEALS_API_ENABLED==='1';
// Real improvement submissions require verified employer accounts and independent reviewer backend.
export const improvementsApiReady = employerApiReady && import.meta.env.VITE_HHBA_IMPROVEMENTS_API_ENABLED==='1';
// Public score publication is controlled separately and remains off in static previews.
export const publicationApiReady = employerApiReady && import.meta.env.VITE_HHBA_PUBLICATION_API_ENABLED==='1';
// All commercial operations disabled until trusted review, buyer consent and approved policy exist.
export const aidCommercialApiReady = employerApiReady && import.meta.env.VITE_HHBA_AID_COMMERCIAL_API_ENABLED==='1';
const API = configuredApiBase || '/api/v1';
function errorMessage(detail: unknown) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(x => typeof x?.msg === 'string' ? x.msg : '请求字段无效').join('；');
  return '请求未能完成，请检查输入后重试。';
}

export function setCsrfToken(value: string | null) { csrfToken = value; }
export function getCsrfToken() { return csrfToken; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  issueEmployeeFeedbackTicket: (organization_id:string) => request<{ticket:string;period:string;notice:string}>('/employee-feedback/ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id})}),
  submitEmployeeFeedback: (organization_id:string,ticket:string,ratings:EmployeeFeedbackRatings) => request<{accepted:boolean;period:string;notice:string}>('/employee-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id,ticket,...ratings})}),
  publicEmployeeFeedbackAggregate: (oid:string,period:string) => request<PublicFeedbackAggregate>(`/public/organizations/${encodeURIComponent(oid)}/employee-feedback/${encodeURIComponent(period)}`),
  submitAidApplication: (oid:string,data:{service_type:string;business_summary:string;capacity_summary:string;capacity_evidence_id:string}) => request<HHBAAidApplication>(`/organizations/${encodeURIComponent(oid)}/aid-applications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
  employerAidApplications: (oid:string) => request<{items:HHBAAidApplication[]}>(`/organizations/${encodeURIComponent(oid)}/aid-applications`),
  employerClientIntroductions: (oid:string) => request<{items:HHBAIntroduction[]}>(`/organizations/${encodeURIComponent(oid)}/client-introductions`),
  adminAidQueue: () => request<{items:HHBAAidApplication[]}>('/admin/aid-applications'),
  adminAidReview: (id:string,decision:'approved'|'needs_info'|'declined',reason:string) => request<HHBAAidApplication>(`/admin/aid-applications/${encodeURIComponent(id)}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}),
  adminAidClose: (id:string,reason:string) => request<HHBAAidApplication>(`/admin/aid-applications/${encodeURIComponent(id)}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:'close',reason})}),
  adminCreateIntroduction: (data:{application_id:string;organization_id:string;buyer_reference:string;buyer_sector:string;opportunity_type:string;purpose:string}) => request<HHBAIntroduction>('/admin/client-introductions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
  adminVerifyBuyerConsent: (id:string,buyer_consent_reference:string) => request<HHBAIntroduction>(`/admin/client-introductions/${encodeURIComponent(id)}/verify-consent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buyer_consent_reference})}),
  adminAdvanceIntroduction: (id:string,stage:string) => request<HHBAIntroduction>(`/admin/client-introductions/${encodeURIComponent(id)}/stage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage})}),
  adminSubmitOrderProof: (id:string,evidence_reference:string) => request<HHBAOrderClaim>(`/admin/client-introductions/${encodeURIComponent(id)}/order-proof`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({evidence_reference})}),
  adminVerifyOrderProof: (id:string,accepted:boolean,reason:string) => request<HHBAOrderClaim>(`/admin/order-proofs/${encodeURIComponent(id)}/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted,reason})}),
  employerGrowthProfile: (oid:string) => request<HHBAPublicGrowthProfile>(`/public/organizations/${encodeURIComponent(oid)}/growth-profile`),
  employerGrowthVersions: (oid:string) => request<{items:HHBAPublicVersion[]}>(`/public/organizations/${encodeURIComponent(oid)}/growth-profile/versions`),
  adminPreparePublication: (organization_id:string,scoring_run_id:string) => request<HHBAPublicationCase>('/admin/publication/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id,scoring_run_id})}),
  adminPublicationQueue: () => request<{items:HHBAPublicationCase[]}>('/admin/publication/queue'),
  adminPublicationDecision: (id:string,decision:'approve'|'reject',reason:string) => request<HHBAPublicationCase>(`/admin/publication/${encodeURIComponent(id)}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}),
  adminPublicationRevoke: (id:string,reason:string) => request<HHBAPublicationCase>(`/admin/publication/${encodeURIComponent(id)}/revoke`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})}),
  submitEmployerImprovement: (oid:string,data:{evidence_id:string;title:string;description:string;effective_date:string}) => request<HHBAImprovement>(`/organizations/${encodeURIComponent(oid)}/improvements`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
  employerImprovements: (oid:string) => request<{items:HHBAImprovement[]}>(`/organizations/${encodeURIComponent(oid)}/improvements`),
  publicEmployerImprovements: (oid:string) => request<{items:PublicHHBAImprovement[];notice:string}>(`/public/organizations/${encodeURIComponent(oid)}/improvements`),
  clarifyEmployerImprovement: (oid:string,id:string,clarification:string) => request<HHBAImprovement>(`/organizations/${encodeURIComponent(oid)}/improvements/${encodeURIComponent(id)}/clarify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clarification})}),
  adminImprovementQueue: () => request<{items:HHBAImprovement[]}>('/admin/improvements'),
  adminReviewImprovement: (id:string,body:{decision:'approved'|'needs_more_info'|'rejected';reason:string;public_summary:string|null;privacy_checked:boolean}) => request<HHBAImprovement>(`/admin/improvements/${encodeURIComponent(id)}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  adminRevokeImprovement: (id:string,reason:string) => request<HHBAImprovement>(`/admin/improvements/${encodeURIComponent(id)}/revoke`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})}),
  submitEmployerAppeal: (organization_id:string,target_type:'evidence'|'scoring_run',target_id:string,issue:string,explanation:string) => request<HHBAAppeal>('/employer/appeals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id,target_type,target_id,issue,explanation})}),
  employerAppeals: (organization_id:string) => request<{items:HHBAAppeal[]}>(`/organizations/${encodeURIComponent(organization_id)}/appeals`),
  clarifyEmployerAppeal: (organization_id:string,appeal_id:string,explanation:string) => request<HHBAAppeal>(`/organizations/${encodeURIComponent(organization_id)}/appeals/${encodeURIComponent(appeal_id)}/clarify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({explanation})}),
  submitEmployeePrivacyConcern: (organization_id:string,issue:string) => request<HHBAAppeal>('/employee/privacy-concerns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id,issue})}),
  employeePrivacyConcerns: () => request<{items:HHBAAppeal[]}>('/employee/my-privacy-concerns'),
  adminAppealsQueue: () => request<{items:HHBAAppeal[]}>('/admin/appeals'),
  adminAppealsDecision: (id:string,decision:'needs_more_info'|'rejected'|'correction_required',reason:string) => request<HHBAAppeal>(`/admin/appeals/${encodeURIComponent(id)}/decisions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}),
  publicEmployerScoreStatus: (oid:string) => request<{trust:{status:string;score:null};care:{status:string;score:null};rule_version:string;publication:string;notice:string}>(`/public/organizations/${encodeURIComponent(oid)}/scores`),
  adminCreateScoreFinding: (organization_id:string,evidence_id:string,score:number,reason:string) => request<{id:string;category:string;assessed_score:number}>(`/admin/scoring/assessments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id,evidence_id,score,reason})}),
  adminRecalculateScores: (oid:string) => request<PrivateScoringRun>(`/admin/scoring/organizations/${encodeURIComponent(oid)}/calculate`,{method:'POST'}),
  adminLatestScoreRun: (oid:string) => request<PrivateScoringRun>(`/admin/scoring/organizations/${encodeURIComponent(oid)}/latest`),
  employerEvidence: (oid:string) => request<{items:EmployerEvidence[]}>(`/organizations/${encodeURIComponent(oid)}/evidence`),
  submitEmployerEvidence: (oid:string,category:EmployerEvidenceCategory,statement:string,file:File) => {
    const body=new FormData();
    body.append('category',category);
    body.append('statement',statement);
    body.append('file',file,file.name);
    return request<EmployerEvidence>(`/organizations/${encodeURIComponent(oid)}/evidence`,{method:'POST',body});
  },
  adminPendingEmployerEvidence: () => request<{items:EmployerEvidence[]}>('/admin/evidence'),
  adminReviewEvidence: (evidenceId:string,decision:'verified'|'needs_more_info'|'rejected',reason:string) => request<EmployerEvidence>(`/admin/evidence/${encodeURIComponent(evidenceId)}/reviews`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}),
  publicEmployerJobs: (search:string='',offset=0) => request<EmployerPublicJobs>(`/public/employer-postings?q=${encodeURIComponent(search)}&offset=${offset}&limit=20`),
  applicationPreview: (postingId:string) => request<CandidateJobPreview>(`/me/employer-applications/preview/${encodeURIComponent(postingId.replace(/^employer-/,''))}`),
  applyEmployerJob: (postingId:string,confirmed_share:boolean,cover_note:string) => request<{id:string;status:string;notice:string}>(`/me/employer-applications/${encodeURIComponent(postingId.replace(/^employer-/,''))}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed_share,cover_note})}),
  myEmployerApplications: () => request<{items:CandidateJobApplication[]}>('/me/employer-applications'),
  withdrawEmployerApplication: (id:string) => request<{id:string;status:string}>(`/me/employer-applications/${encodeURIComponent(id)}/withdraw`,{method:'POST'}),
  employerRecruitmentResponsibilities: (oid:string,pid:string) => request<RecruitmentResponsibilityQueue>(`/organizations/${encodeURIComponent(oid)}/postings/${encodeURIComponent(pid.replace(/^employer-/,''))}/recruitment-responsibilities`),
  myRecruitmentResponsibilities: () => request<RecruitmentResponsibilityQueue>('/me/recruitment-responsibilities'),
  adminRecruitmentResponsibilities: () => request<RecruitmentResponsibilityQueue>('/admin/recruitment-responsibilities?view=overdue'),
  employerJobApplications: (oid:string,postingId:string) => request<{items:EmployerJobApplication[]}>(`/organizations/${encodeURIComponent(oid)}/postings/${encodeURIComponent(postingId.replace(/^employer-/,''))}/applications`),
  updateEmployerApplicationStatus: (oid:string,postingId:string,id:string,status:ApplicationStage,expected_status:ApplicationStage) => request<{id:string;status:string}>(`/organizations/${encodeURIComponent(oid)}/postings/${encodeURIComponent(postingId.replace(/^employer-/,''))}/applications/${encodeURIComponent(id)}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,expected_status})}),

  publicEmployerJob: (id:string) => request<PublicEmployerJob>(`/public/employer-postings/${encodeURIComponent(id.replace(/^employer-/,''))}`),
  adminPendingPostings: () => request<{items:EmployerPosting[]}>('/admin/employer-postings'),
  adminPostingReview: (id:string,decision:'approved'|'rejected',reason_code:string) => request<{status:string}>(`/admin/employer-postings/${id.replace(/^employer-/,'')}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason_code})}),
  adminOrgVerificationQueue: () => request<EmployerVerificationQueue>('/admin/verification/organizations?status=submitted'),
  adminOrgVerificationDetail: (id:string) => request<EmployerVerificationAdminDetail>(`/admin/verification/organizations/${id}`),
  adminMarkDocumentSecurity: (id:string,status:'clean'|'rejected',reason_code:string) => request<{id:string;security_status:string}>(`/admin/verification/documents/${id}/security-assessment`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,reason_code})}),
  adminReviewOrgVerification: (oid:string,body:{status:'need_more_info'|'approved'|'rejected';reason_code:string;expected_revision:number;evidence_snapshot_id:string;entity_verification:'manual_verified'|'not_verified';representative_verification:'manual_verified'|'not_verified';authorization_verification:'manual_verified'|'not_verified';valid_days:number}) => request<{status:string;organization_status:string}>(`/admin/verification/organizations/${oid}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),

  adminVerificationQueue: () => request<{items:{organization_id:string;legal_name:string;status:string;revision:number;submitted_at?:string;representative_name?:string;evidence_snapshot_id?:string}[]}>('/admin/verification/organizations'),
  adminVerificationDetail: (oid:string) => request<{verification:Verification;evidence_snapshot:{id:string;evidence_version:number;manifest_sha256:string}|null;reviews:{outcome:string;reason_code:string}[]}>(`/admin/verification/organizations/${oid}`),
  adminReviewPosting: (id:string,decision:'approved'|'rejected',reason_code:string) => request<{status:string}>(`/admin/employer-postings/${id.replace(/^employer-/,'')}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason_code})}),


};

export type ParseResult = { raw_text_excerpt?: string; display_name?: { value: string | null; status: string }; skills?: { value: string; evidence?: string; status: string }[]; experiences?: unknown[]; education?: unknown[]; source?: string };
export type Profile = { id: string; status: 'draft' | 'confirmed' | 'published'; display_name?: string | null; content: Record<string, unknown>; public_slug?: string | null };
