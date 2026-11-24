// Server-owned search checkpoints. Store only recommendation metadata, not CV
// text or source quotes. One posting per row avoids the legacy ten-job cap.
import {isV4PostingKey} from '../../src/services/v4PostingIdentity.mjs';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
import {redactForModel} from './resume-match-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean=x=>typeof x==='string'?redactForModel(x,{unbounded:true}):'';
const nullableScore=x=>Number.isInteger(x)&&x>=0&&x<=100?x:null;
export async function v4HistoryReady(db){
 try{return (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_v4_match_tasks'").first())?.name==='hhba_v4_match_tasks';}catch{return false;}
}
function safeJob(x){
 const url=v4PublicJobUrl(x?.official_url);
 if(!url||!x.company||!x.title||!x.location)return null;
 const result={id:clean(x.id),company:clean(x.company),title:clean(x.title_zh||x.title),location:clean(x.location),
  official_url:url,...(isV4PostingKey(x.posting_key)?{posting_key:x.posting_key}:{}),match_score:nullableScore(x.match_score),score_basis:clean(x.score_basis),
  recommendation_reason:clean(x.recommendation_reason),availability_status:x.availability_status==='OPEN_LISTED'?'OPEN_LISTED':'UNKNOWN',
  recruitment_source_kind:clean(x.recruitment_source_kind),recruitment_source_note:clean(x.recruitment_source_note),
  evidence_status:clean(x.evidence_status),evidence_score_status:clean(x.evidence_score_status),evidence_excerpt:clean(x.evidence_excerpt)};
 if(/^jd_[a-f0-9]{32}$/.test(x.jd_version_id||'')&&/^[a-f0-9]{64}$/.test(x.jd_sha256||'')&&x.jd_source_status==='VERIFIED_JD')
  Object.assign(result,{jd_version_id:x.jd_version_id,jd_sha256:x.jd_sha256,jd_checked_at:x.jd_checked_at,jd_source_status:x.jd_source_status,jd_score_status:x.jd_score_status,jd_proof_method:x.jd_proof_method});
 return result;
}
const summarySQL="SELECT t.id,t.resume_id,t.resume_label,t.role_hint,t.created_at,t.research_pending,COUNT(j.job_url) job_count,MAX(j.match_score) best_score,0 new_job_count,0 improved_job_count FROM hhba_v4_match_tasks t LEFT JOIN hhba_v4_match_jobs j ON j.task_id=t.id";
export async function saveV4Round(db,phone,{taskId,resumeId,roleHint,matches,researchPending,researchRound}){
 if(!uuid.test(taskId||''))throw Error('INVALID_HISTORY_ID');
 let resume=null;
 if(resumeId){
  if(!uuid.test(resumeId))throw Error('RESUME_NOT_OWNED');
  resume=await db.prepare('SELECT id,filename FROM hhba_candidate_resumes WHERE phone=? AND id=?').bind(phone,resumeId).first();
  if(!resume)throw Error('RESUME_NOT_OWNED');
 }
 const now=new Date().toISOString();
 await db.prepare('INSERT INTO hhba_v4_match_tasks(id,phone,resume_id,resume_label,role_hint,created_at,research_pending) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
  .bind(taskId,phone,resume?.id||null,resume?.filename||'本次上传的简历（未保存）',clean(roleHint),now,1).run();
 const task=await db.prepare('SELECT id,resume_id FROM hhba_v4_match_tasks WHERE id=? AND phone=?').bind(taskId,phone).first();
 if(!task||task.resume_id!==(resume?.id||null))throw Error('HISTORY_ACCOUNT_MISMATCH');
 // JSON chunks are transport units for D1, not caps on total results.
 const rows=(matches||[]).map(safeJob).filter(Boolean);let batch=[],size=0;
 const write=async()=>{
  if(!batch.length)return;
  await db.prepare("INSERT INTO hhba_v4_match_jobs(task_id,job_url,match_score,result_json) SELECT ?,COALESCE(json_extract(value,'$.posting_key'),json_extract(value,'$.official_url')),json_extract(value,'$.match_score'),value FROM json_each(?) WHERE 1 ON CONFLICT(task_id,job_url) DO NOTHING")
   .bind(taskId,JSON.stringify(batch)).run();batch=[];size=0;
 };
 for(const job of rows){const n=new TextEncoder().encode(JSON.stringify(job)).byteLength;if(batch.length&&size+n>400000)await write();batch.push(job);size+=n;}
 await write();
 if(Number.isSafeInteger(researchRound)&&researchRound>0){
  // Persist operational progress only, never raw CV, profile facts or private prompts.
  // Existing installations without the additive migration keep their saved jobs.
  try{await db.prepare('INSERT INTO hhba_v4_research_checkpoints(task_id,completed_round,search_complete) VALUES(?,?,?) ON CONFLICT(task_id) DO UPDATE SET completed_round=excluded.completed_round,search_complete=excluded.search_complete WHERE excluded.completed_round>=hhba_v4_research_checkpoints.completed_round').bind(taskId,researchRound,researchPending?0:1).run();}
  catch(e){console.warn('HHBA_V4_RESEARCH_CHECKPOINT_UNAVAILABLE',e?.name||'Error');}
 }
 await db.prepare('UPDATE hhba_v4_match_tasks SET research_pending=? WHERE id=? AND phone=?').bind(1,taskId,phone).run();
 return taskId;
}
export async function patchV4Job(db,phone,taskId,url,patch,postingKey){
 if(!uuid.test(taskId||'')||!v4PublicJobUrl(url))return false;
 const key=isV4PostingKey(postingKey)?postingKey:url;
 const row=await db.prepare('SELECT j.result_json FROM hhba_v4_match_jobs j JOIN hhba_v4_match_tasks t ON t.id=j.task_id WHERE t.phone=? AND j.task_id=? AND j.job_url=?').bind(phone,taskId,key).first();
 if(!row)return false;
 const old=JSON.parse(row.result_json);
 if(old.official_url!==url)return false;
 const result=safeJob({...old,...patch,official_url:url,posting_key:old.posting_key});
 if(!result)return false;
 await db.prepare('UPDATE hhba_v4_match_jobs SET result_json=?,match_score=? WHERE task_id=? AND job_url=? AND EXISTS(SELECT 1 FROM hhba_v4_match_tasks WHERE id=? AND phone=?)')
  .bind(JSON.stringify(result),result.match_score,taskId,key,taskId,phone).run();
 return true;
}
export async function listV4History(db,phone){
 const rows=await db.prepare(summarySQL+' WHERE t.phone=? GROUP BY t.id ORDER BY t.created_at DESC').bind(phone).all();
 return (rows.results||[]).map(x=>({...x,engine:'V4',research_pending:!!x.research_pending}));
}
export async function readV4ResearchCheckpoint(db,phone,id){
 if(!uuid.test(id||''))return null;
 try{
  const row=await db.prepare('SELECT c.completed_round,c.search_complete FROM hhba_v4_research_checkpoints c JOIN hhba_v4_match_tasks t ON t.id=c.task_id WHERE t.id=? AND t.phone=?').bind(id,phone).first();
  return row&&Number.isSafeInteger(row.completed_round)&&row.completed_round>=0?{round:row.completed_round,search_complete:!!row.search_complete}:null;
 }catch{return null;}
}
export async function getV4History(db,phone,id){
 if(!uuid.test(id))return null;
 const row=await db.prepare(summarySQL+' WHERE t.phone=? AND t.id=? GROUP BY t.id').bind(phone,id).first();
 if(!row)return null;
 const jobs=await db.prepare('SELECT result_json FROM hhba_v4_match_jobs WHERE task_id=? ORDER BY match_score DESC,job_url').bind(id).all();
 let resumeId=row.resume_id||null;
 if(resumeId&&!(await db.prepare('SELECT id FROM hhba_candidate_resumes WHERE phone=? AND id=?').bind(phone,resumeId).first()))resumeId=null;
 const checkpoint=await readV4ResearchCheckpoint(db,phone,id);
 return {...row,resume_id:resumeId,engine:'V4',research_pending:!!row.research_pending,...(checkpoint?{research_checkpoint:checkpoint}:{}),matches:(jobs.results||[]).map(x=>JSON.parse(x.result_json))};
}
export async function deleteV4History(db,phone,id){
 const result=await db.prepare('DELETE FROM hhba_v4_match_tasks WHERE phone=? AND id=?').bind(phone,id).run();
 return Number(result.meta?.changes)===1;
}
export async function linkV4History(db,phone,id,resumeId){
 const resume=await db.prepare('SELECT id,filename FROM hhba_candidate_resumes WHERE phone=? AND id=?').bind(phone,resumeId).first();
 if(!resume)throw Error('RESUME_NOT_OWNED');
 const result=await db.prepare('UPDATE hhba_v4_match_tasks SET resume_id=?,resume_label=? WHERE phone=? AND id=?').bind(resume.id,resume.filename,phone,id).run();
 return Number(result.meta?.changes)===1;
}

export async function finishV4History(db,phone,id){
 if(!uuid.test(id||''))return false;
 const result=await db.prepare('UPDATE hhba_v4_match_tasks SET research_pending=0 WHERE id=? AND phone=?').bind(id,phone).run();
 return Number(result.meta?.changes)===1;
}
