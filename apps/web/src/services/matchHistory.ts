// Private AI recommendation history: account-bound D1, never a job application.
import {getRealAuthToken} from './realAuth';
import type {MatchedJob} from './resumeMatch';

export type MatchHistorySummary={
 id:string;resume_id:string|null;resume_label:string;role_hint:string;
 created_at:string;job_count:number;best_score:number|null;
 new_job_count:number;improved_job_count:number;engine?:'V4';research_pending?:boolean;
};
export type HistoryMatchedJob={
 id:string;posting_key?:string;company:string;title:string;location:string;official_url:string;
 match_score:number|null;score_basis:string;recommendation_reason:string;
 availability_status:'OPEN_LISTED'|'UNKNOWN';
 recruitment_source_kind:string;recruitment_source_note:string;
 jd_version_id?:string;jd_sha256?:string;jd_checked_at?:string;
 evidence_status?:'VERIFIED_FULL_JD'|'PARTIAL_SOURCE'|'SEARCH_SNIPPET_ONLY'|'INSUFFICIENT_EVIDENCE';
 evidence_excerpt?:string;
 evidence_score_status?:'AI_PARTIAL_SOURCE_SCORED'|'AI_DIRECTION_REFERENCE_SCORED';
 evidence_sources?:{url:string;kind:string}[];
 jd_source_status?:'VERIFIED_JD';jd_score_status?:'V2_JD_EVIDENCE_SCORED'|'AI_VERIFIED_JD_SCORED'|'INSUFFICIENT_RESUME_EVIDENCE'|'BACKGROUND_UNVERIFIED';
 jd_proof_method?:'PUBLIC_EMPLOYER_ATS_V1'|'DIRECT_EMPLOYER_HTML_V1'|'V4_STRUCTURED_JOBPOSTING'|'V4_MODEL_SOURCE_GROUNDED'|null;
};
export type MatchHistoryDetail=MatchHistorySummary&{matches:HistoryMatchedJob[];research_checkpoint?:{round:number;search_complete:boolean}};
const api='/api/match-history';
const errorText:Record<string,string>={
 SESSION_INVALID:'登录已失效，请重新登录。',
 FORBIDDEN:'仅限当前已登录的求职者查看匹配历史。',
 MATCH_HISTORY_NOT_FOUND:'记录不存在或你没有访问权限。',
 MATCH_HISTORY_DB_UNAVAILABLE:'匹配历史存储服务尚未配置。',
 MATCH_HISTORY_DB_NOT_READY:'匹配历史数据库尚未完成部署，请稍后重试。',
 RESUME_NOT_OWNED:'所选简历不属于当前登录账号。',
 INVALID_HISTORY_LINK:'保存的简历标识无效，无法关联历史记录。'
};
async function request(path:string,method='GET',data?:unknown){
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录求职者账户。');
 const res=await fetch(api+path,{
  method,credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})
 });
 const json=await res.json().catch(()=>({})) as Record<string,unknown>;
 if(!res.ok)throw Error(errorText[String(json.error||'')]||'匹配历史暂时无法读取，请稍后再试。');
 if(json.ok!==true||json.kind&&json.kind!=='HHBA_ACCOUNT_MATCH_HISTORY_V1')
  throw Error('匹配历史接口返回异常。');
 return json;
}
export async function listMatchHistory():Promise<MatchHistorySummary[]>{
 const res=await request('');
 if(!Array.isArray(res.items))throw Error('匹配历史列表格式异常。');
 return res.items as MatchHistorySummary[];
}
export async function getMatchHistory(id:string):Promise<MatchHistoryDetail>{
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('历史记录标识无效。');
 const res=await request('/'+id);
 if(!res.item||!Array.isArray((res.item as MatchHistoryDetail).matches))
  throw Error('匹配历史详情格式异常。');
 return res.item as MatchHistoryDetail;
}
export async function removeMatchHistory(id:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('历史记录标识无效。');
 const result=await request('/'+id,'DELETE');
 if(result.deleted!==true)throw Error('删除匹配记录未完成，请重试。');
}
export async function linkMatchHistoryResume(historyId:string,resumeId:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(historyId)||!/^[0-9a-f-]{36}$/i.test(resumeId))
  throw Error('简历或历史记录标识无效。');
 await request('/'+historyId+'/link','POST',{resume_id:resumeId});
}

export function historyJobsForContinuation(detail:MatchHistoryDetail):MatchedJob[]{
 return detail.matches.map((job,i)=>({
  id:job.id||'history-'+detail.id+'-'+i,posting_key:job.posting_key,company:job.company,title:job.title,title_zh:job.title,
  location:job.location,official_url:job.official_url,platform:job.recruitment_source_kind||'招聘来源',
  source:'MATCH_HISTORY',remote:false,reference_score:job.match_score??0,match_score:job.match_score,
  matched:[],not_evidenced:[],needs_verification:[],requirements_basis:job.evidence_excerpt||'',
  score_basis:job.score_basis,recommendation_reason:job.recommendation_reason,
  recruitment_source_note:job.recruitment_source_note,
  recruitment_source_kind:job.recruitment_source_kind==='EMPLOYER_ATS'?'EMPLOYER_ATS':job.recruitment_source_kind==='EMPLOYER_DOMAIN_CANDIDATE'?'EMPLOYER_DOMAIN_CANDIDATE':job.recruitment_source_kind==='THIRD_PARTY_BOARD'?'THIRD_PARTY_BOARD':'UNVERIFIED',
  availability_status:job.availability_status,evidence_status:job.evidence_status,
  evidence_score_status:job.evidence_score_status,evidence_excerpt:job.evidence_excerpt,
  jd_version_id:job.jd_version_id,jd_sha256:job.jd_sha256,jd_checked_at:job.jd_checked_at,
  jd_source_status:job.jd_source_status,jd_score_status:job.jd_score_status==='BACKGROUND_UNVERIFIED'?undefined:job.jd_score_status,jd_proof_method:job.jd_proof_method||undefined
 }));
}
