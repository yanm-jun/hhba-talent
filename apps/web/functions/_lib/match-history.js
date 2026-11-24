// Authenticated-only snapshots of AI recommendations.
// No raw CV text, document bytes, email/phone in returned JSON, telemetry or payload.
// These are recommendations, NEVER applications and NEVER automatically monitored.
import {allowedEmployerJobLink} from './match-employer-source.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';

const text=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):'';
const score=v=>Number.isInteger(v)&&v>=0&&v<=100?v:null;
const verifiedJdMeta=item=>{
 if(!/^jd_[a-f0-9]{32}$/.test(item?.jd_version_id||'')||
  !/^[a-f0-9]{64}$/.test(item?.jd_sha256||'')||
  !Number.isFinite(Date.parse(item?.jd_checked_at||''))||
  item?.jd_source_status!=='VERIFIED_JD')return {};
 return {
  jd_version_id:item.jd_version_id,jd_sha256:item.jd_sha256,
  jd_checked_at:item.jd_checked_at,
  jd_source_status:'VERIFIED_JD',
  jd_score_status:['V2_JD_EVIDENCE_SCORED','AI_VERIFIED_JD_SCORED','INSUFFICIENT_RESUME_EVIDENCE']
   .includes(item.jd_score_status)?item.jd_score_status:'INSUFFICIENT_RESUME_EVIDENCE',
  jd_proof_method:['PUBLIC_EMPLOYER_ATS_V1','DIRECT_EMPLOYER_HTML_V1','V4_STRUCTURED_JOBPOSTING']
   .includes(item.jd_proof_method)?item.jd_proof_method:null
 };
};
const rowId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxHistory=30;
const isValidUrl=value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
   allowedEmployerJobLink(u.href);
 }catch{return false}
};
const parsedJobs=raw=>{
 try{return Array.isArray(JSON.parse(raw))?JSON.parse(raw):[]}catch{return []}
};
export function safeHistoryJobs(matches){
 if(!Array.isArray(matches))return [];
 const seen=new Set(),out=[];
 for(const item of matches){
  if(!item||!(item.v4_source===true?v4PublicJobUrl(item.official_url)===item.official_url:isValidUrl(item.official_url))||seen.has(item.official_url))continue;
  const company=text(item.company,110),title=text(item.title_zh||item.title,125);
  const location=text(item.location,80);
  if(!company||!title||!location)continue;
  seen.add(item.official_url);
  out.push({id:text(item.id,75),company,title,location,
   ...(item.v4_source===true?{v4_source:true}:{}),
   official_url:item.official_url,match_score:score(item.match_score),
   score_basis:text(item.score_basis,360),
   recommendation_reason:text(Array.isArray(item.jd_comparisons)?
    '按核验后的岗位 JD 和当时的简历证据完成比对。重新匹配可查看逐项证据。':item.recommendation_reason,850),
   availability_status:['OPEN_LISTED','UNKNOWN'].includes(item.availability_status)?
    item.availability_status:'UNKNOWN',
   recruitment_source_kind:text(item.recruitment_source_kind,35),
   recruitment_source_note:text(item.recruitment_source_note,130),
   // Retain source provenance for later Word revisions; never persist raw CV.
   evidence_status:['VERIFIED_FULL_JD','PARTIAL_SOURCE','SEARCH_SNIPPET_ONLY','INSUFFICIENT_EVIDENCE']
    .includes(item.evidence_status)?item.evidence_status:null,
   evidence_excerpt:text(item.evidence_excerpt,1400),
   evidence_sources:(Array.isArray(item.evidence_sources)?item.evidence_sources:[])
    .slice(0,4).filter(s=>s&&typeof s.url==='string'&&
     /^(?:https:\/\/)/.test(s.url)&&s.url.length<=1300&&
     ['EMPLOYER_PAGE_CANDIDATE','PUBLIC_ANNOUNCEMENT_CANDIDATE'].includes(s.kind))
    .map(s=>({url:s.url,kind:s.kind})),
   ...verifiedJdMeta(item)});

 }
 return out;
}
export function compareOpportunitySets(previous,current){
 const seen=new Set(),priorScore=new Map();
 for(const run of previous){
  for(const job of parsedJobs(run.jobs_json)){
   if(!(job.v4_source===true?v4PublicJobUrl(job.official_url):isValidUrl(job.official_url)))continue;
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
const SEGMENT_BYTES=500000;
export function historySegments(jobs){
 const encoder=new TextEncoder(),segments=[];let items=[],size=2;
 for(const job of jobs){
  const bytes=encoder.encode(JSON.stringify(job)).byteLength+(items.length?1:0);
  if(bytes>SEGMENT_BYTES-2)throw Error('MATCH_HISTORY_ITEM_TOO_LARGE');
  if(items.length&&size+bytes>SEGMENT_BYTES){segments.push(JSON.stringify(items));items=[];size=2;}
  items.push(job);size+=encoder.encode(JSON.stringify(job)).byteLength+(items.length>1?1:0);
 }
 if(items.length)segments.push(JSON.stringify(items));
 return segments;
}
function segmentManifest(raw){
 try{const value=JSON.parse(raw);return value?.format==='HHBA_HISTORY_SEGMENTS_V1'&&Number.isSafeInteger(value.count)&&value.count>0?value:null;}catch{return null;}
}
async function expandHistoryRow(db,row){
 const manifest=segmentManifest(row.jobs_json);
 if(!manifest)return row;
 const result=await db.prepare('SELECT position,jobs_json FROM hhba_ai_match_history_segments WHERE history_id=? ORDER BY position').bind(row.id).all();
 const segments=result?.results||[];
 if(segments.length!==manifest.count||segments.some((part,i)=>part.position!==i))throw Error('MATCH_HISTORY_SEGMENTS_INCOMPLETE');
 return {...row,jobs_json:JSON.stringify(segments.flatMap(part=>parsedJobs(part.jobs_json)))};
}
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
 const previous=await db.prepare('SELECT id,jobs_json FROM hhba_ai_match_history WHERE phone=? ORDER BY created_at DESC LIMIT ?')
  .bind(phone,maxHistory).all();
 const previousRuns=await Promise.all((previous?.results||[]).map(row=>expandHistoryRow(db,row)));
 const delta=compareOpportunitySets(previousRuns,jobs);
 const best=jobs.reduce((v,x)=>x.match_score===null?v:Math.max(v,x.match_score),-1);
 const data=JSON.stringify(jobs);
 const segments=new TextEncoder().encode(data).byteLength>1500000?historySegments(jobs):null;
 const payload=segments?JSON.stringify({format:'HHBA_HISTORY_SEGMENTS_V1',count:segments.length}):data;
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const statement=db.prepare('INSERT INTO hhba_ai_match_history(id,phone,resume_id,resume_label,role_hint,created_at,job_count,best_score,new_job_count,improved_job_count,jobs_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,phone,resume?.id||null,resume?text(resume.filename,150):'本次上传的简历（未保存）',
   text(roleHint,80),created,jobs.length,best<0?null:best,
   delta.new_job_count,delta.improved_job_count,payload);
 const inserted=segments?(await db.batch([statement,...segments.map((value,i)=>db.prepare('INSERT INTO hhba_ai_match_history_segments(history_id,position,jobs_json) VALUES(?,?,?)').bind(id,i,value))]))[0]:await statement.run();
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
 return {...summary(row),resume_id:resumeId,matches:safeHistoryJobs(parsedJobs((await expandHistoryRow(db,row)).jobs_json))};
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
