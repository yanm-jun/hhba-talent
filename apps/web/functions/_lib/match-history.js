// Authenticated-only snapshots of AI recommendations.
// No raw CV text, document bytes, email/phone in returned JSON, telemetry or payload.
// These are recommendations, NEVER applications and NEVER automatically monitored.
import {allowedEmployerJobLink} from './match-employer-source.js';

const text=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):'';
const score=v=>Number.isInteger(v)&&v>=0&&v<=100?v:null;
const rowId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxHistory=30;
const isValidUrl=value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
  !u.hash&&allowedEmployerJobLink(u.href);}catch{return false}
};
const parsedJobs=raw=>{
 try{return Array.isArray(JSON.parse(raw))?JSON.parse(raw):[]}catch{return []}
};
export function safeHistoryJobs(matches){
 if(!Array.isArray(matches))return [];
 const seen=new Set(),out=[];
 for(const item of matches){
  if(!item||!isValidUrl(item.official_url)||seen.has(item.official_url))continue;
  const company=text(item.company,110),title=text(item.title_zh||item.title,125);
  const location=text(item.location,80);
  if(!company||!title||!location)continue;
  seen.add(item.official_url);
  out.push({id:text(item.id,75),company,title,location,
   official_url:item.official_url,match_score:score(item.match_score),
   score_basis:text(item.score_basis,360),
   recommendation_reason:text(item.recommendation_reason,850),
   availability_status:['OPEN_LISTED','UNKNOWN'].includes(item.availability_status)?
    item.availability_status:'UNKNOWN',
   recruitment_source_kind:text(item.recruitment_source_kind,35),
   recruitment_source_note:text(item.recruitment_source_note,130)});
  if(out.length===10)break;
 }
 return out;
}
export function compareOpportunitySets(previous,current){
 const seen=new Set(),priorScore=new Map();
 for(const run of previous){
  for(const job of parsedJobs(run.jobs_json)){
   if(!isValidUrl(job.official_url))continue;
   seen.add(job.official_url);
   const x=score(job.match_score);
   if(x!==null)priorScore.set(job.official_url,
    Math.max(priorScore.get(job.official_url)??0,x));
  }
 }
 const newJobs=current.filter(job=>!seen.has(job.official_url)).length;
 // "improved" is only the score for an *existing same posting*, not proof of
 // a new opening or improved hiring probability. Never label it as a new job.
 const rescored=current.filter(job=>seen.has(job.official_url)&&
  job.match_score!==null&&priorScore.has(job.official_url)&&
  job.match_score>(priorScore.get(job.official_url)||0)+5).length;
 return {new_job_count:previous.length?newJobs:0,improved_job_count:rescored};
}
export const summary=row=>({
 id:row.id,resume_id:row.resume_id||null,
 resume_label:row.resume_label,role_hint:row.role_hint||'',
 created_at:row.created_at,job_count:Number(row.job_count),
 best_score:row.best_score===null?null:Number(row.best_score),
 new_job_count:Number(row.new_job_count||0),
 improved_job_count:Number(row.improved_job_count||0)
});
export async function saveMatchHistory(db,phone,resumeId,roleHint,modelMatches){
 if(!db||typeof db.prepare!=='function')throw Error('MATCH_HISTORY_DB_UNAVAILABLE');
 let resume=null;
 if(resumeId!==null&&resumeId!==undefined&&resumeId!==''){
  if(typeof resumeId!=='string'||!rowId.test(resumeId))throw Error('RESUME_NOT_OWNED');
  resume=await db.prepare('SELECT id,filename FROM hhba_candidate_resumes WHERE phone=? AND id=?')
   .bind(phone,resumeId).first();
  if(!resume)throw Error('RESUME_NOT_OWNED');
 }
 const jobs=safeHistoryJobs(modelMatches);
 if(!jobs.length)return null;
 const previous=await db.prepare('SELECT jobs_json FROM hhba_ai_match_history WHERE phone=? ORDER BY created_at DESC LIMIT ?')
  .bind(phone,maxHistory).all();
 const delta=compareOpportunitySets(previous?.results||[],jobs);
 const best=jobs.reduce((v,x)=>x.match_score===null?v:Math.max(v,x.match_score),-1);
 const data=JSON.stringify(jobs);
 if(data.length>75000)throw Error('MATCH_HISTORY_TOO_LARGE');
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const inserted=await db.prepare('INSERT INTO hhba_ai_match_history(id,phone,resume_id,resume_label,role_hint,created_at,job_count,best_score,new_job_count,improved_job_count,jobs_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,phone,resume?.id||null,resume?text(resume.filename,150):'本次上传的简历（未保存）',
   text(roleHint,240),created,jobs.length,best<0?null:best,
   delta.new_job_count,delta.improved_job_count,data).run();
 if(inserted?.success!==true||Number(inserted?.meta?.changes)!==1)
  throw Error('MATCH_HISTORY_WRITE_FAILED');
 return {id,...delta};
}
export async function listMatchHistory(db,phone){
 const rows=await db.prepare('SELECT id,resume_id,resume_label,role_hint,created_at,job_count,best_score,new_job_count,improved_job_count FROM hhba_ai_match_history WHERE phone=? ORDER BY created_at DESC LIMIT ?')
  .bind(phone,maxHistory).all();
 return (rows?.results||[]).map(summary);
}
export async function getMatchHistory(db,phone,id){
 if(!rowId.test(id))return null;
 const row=await db.prepare('SELECT * FROM hhba_ai_match_history WHERE phone=? AND id=?')
  .bind(phone,id).first();
 if(!row)return null;
 let resumeId=row.resume_id||null;
 if(resumeId){
  const stillOwned=await db.prepare('SELECT id FROM hhba_candidate_resumes WHERE phone=? AND id=?')
   .bind(phone,resumeId).first();
  if(!stillOwned)resumeId=null; // Deleted private resume does not invalidate the historic job list.
 }
 return {...summary(row),resume_id:resumeId,matches:safeHistoryJobs(parsedJobs(row.jobs_json))};
}
export async function deleteMatchHistory(db,phone,id){
 if(!rowId.test(id))return false;
 const result=await db.prepare('DELETE FROM hhba_ai_match_history WHERE phone=? AND id=?')
  .bind(phone,id).run();
 return result?.success===true&&Number(result.meta?.changes)===1;
}
export async function linkSavedResumeToHistory(db,phone,historyId,resumeId){
 if(!rowId.test(historyId)||!rowId.test(resumeId))throw Error('INVALID_HISTORY_LINK');
 const resume=await db.prepare('SELECT id,filename FROM hhba_candidate_resumes WHERE phone=? AND id=?')
  .bind(phone,resumeId).first();
 if(!resume)throw Error('RESUME_NOT_OWNED');
 const result=await db.prepare('UPDATE hhba_ai_match_history SET resume_id=?,resume_label=? WHERE id=? AND phone=?')
  .bind(resume.id,text(resume.filename,150),historyId,phone).run();
 return result?.success===true&&Number(result.meta?.changes)===1;
}
