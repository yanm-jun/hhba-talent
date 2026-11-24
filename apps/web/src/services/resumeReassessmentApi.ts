import {getRealAuthToken,realAuthReady} from './realAuth';
import type {CandidateProfile} from './resumeMatching';
import type {ResumeBlock} from './targetedResumeOptimization';

export type ReassessmentStatus={
 kind:'HHBA_RESUME_REASSESS_V2';enabled:boolean;ranking_version:string;scope:string;
};
export type ReassessmentResult={
 ok:true;kind:'HHBA_RESUME_REASSESS_V2';job_id:string;verified_job_title:string;
 verified_company:string;job_snapshot_updated_at:string;ranking_version:string;
 source_label?:string;selected_job_as_target_direction?:boolean;
 supported:boolean;reason?:string;original_score?:number;updated_score?:number;
 delta?:number;before_breakdown?:Record<string,number>;after_breakdown?:Record<string,number>;
 newly_visible_terms?:string[];lost_visible_terms?:string[];important_notice?:string;before_reason?:string;after_reason?:string;
};
const PATH='/api/resume-reassess';
const errors:Record<string,string>={
 ORIGIN_REQUIRED:'请求来源未通过验证。',SESSION_INVALID:'请先登录 HHBA 求职者账号。',
 REASSESSMENT_NOT_ENABLED:'岗位重新评分功能尚未开放。',REASSESSMENT_DB_NOT_READY:'后台评分额度服务尚未准备好。',
 REASSESSMENT_LIMIT:'今天的岗位复评次数已达上限。',
 AUDITED_JOB_NOT_AVAILABLE:'这个岗位暂时没有符合复评要求的最新官方审核快照。不会生成虚假的匹配分。',
 REASSESSMENT_SOURCE_UNAVAILABLE:'官方岗位索引暂不可用，请稍后重试。',
 INVALID_REASSESSMENT_INPUT:'当前简历资料不完整，请先核实。'
};
export class ReassessmentError extends Error{
 constructor(readonly code:string,readonly status:number){super(errors[code]||'岗位复评暂时不可用。')}
}
export async function reassessmentStatus(signal?:AbortSignal):Promise<ReassessmentStatus|null>{
 if(!realAuthReady)return null;
 try{
  const r=await fetch(PATH,{method:'GET',cache:'no-store',credentials:'omit',signal});
  if(!r.ok)return null;
  const data=await r.json() as ReassessmentStatus;
  return data.kind==='HHBA_RESUME_REASSESS_V2'?data:null;
 }catch{return null;}
}
export async function reassessResume(jobId:string,profile:CandidateProfile,
 beforeBlocks:ResumeBlock[],afterBlocks:ResumeBlock[],signal?:AbortSignal,v4=false):Promise<ReassessmentResult>{
 const token=getRealAuthToken();
 if(!realAuthReady||!token)throw new ReassessmentError('SESSION_INVALID',401);
 const data={
  job_id:jobId,consent_reassessment:true,confirm_real:true,...(v4?{consent_ai:true}:{}),
  profile:{
   education:profile.education,experience_years:profile.experience_years,
   target_roles:v4?profile.target_roles:profile.target_roles.slice(0,7),
   skills:(v4?profile.skills:profile.skills.slice(0,30)).map(s=>({name:s.name}))
  },before_blocks:beforeBlocks,after_blocks:afterBlocks
 };
 let response:Response;
 try{
  response=await fetch(PATH,{method:'POST',cache:'no-store',credentials:'omit',signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify(data)});
 }catch{throw new ReassessmentError('NETWORK_UNAVAILABLE',503);}
 const payload=await response.json().catch(()=>({})) as Partial<ReassessmentResult>&{error?:string};
 if(!response.ok)throw new ReassessmentError(payload.error||'UNKNOWN_ERROR',response.status);
 if(payload.ok!==true||payload.kind!=='HHBA_RESUME_REASSESS_V2'||
  typeof payload.supported!=='boolean')throw new ReassessmentError('INVALID_RESULT',502);
 return payload as ReassessmentResult;
}
