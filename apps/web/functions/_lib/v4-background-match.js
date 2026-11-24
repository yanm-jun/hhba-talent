// An opt-in background job is not tied to a browser request. A scheduled
// Worker invokes one durable unit at a time. No model call/round/job cap.
// Temporary redacted source and context are private, separate from history.
import {v4Match,v4Provider,v4Call,v4ParseJson} from './simple-match-v4.js';
import {redactForModel} from './resume-match-core.js';
import {saveV4Round,getV4History,patchV4Job,finishV4History} from './v4-match-history.js';
import {prepareV4JobForOptimization} from './v4-jd-bridge.js';
import {scoreVerifiedV4Job} from './v4-jd-score.js';
import {v4PostingKey} from '../../src/services/v4PostingIdentity.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PART_BYTES=512*1024;
const key=(id,suffix)=>'v4-background/'+id+'/'+suffix;
const dbOf=env=>env.HHBA_PNVS_AUTH_DB;
const bucketOf=env=>env.HHBA_V4_TASK_R2;
export const backgroundStorageReady=env=>typeof bucketOf(env)?.put==='function'&&typeof dbOf(env)?.prepare==='function';
export const backgroundReady=env=>env.HHBA_MATCH_V4_READY==='1'&&env.HHBA_V4_BACKGROUND_ENABLED==='1'&&typeof env.HHBA_V4_BACKGROUND_SECRET==='string'&&env.HHBA_V4_BACKGROUND_SECRET.length>=32&&typeof bucketOf(env)?.put==='function'&&typeof dbOf(env)?.prepare==='function';
const changed=r=>Number(r?.meta?.changes)===1;
const owned=async(db,phone,id)=>uuid.test(id||'')?db.prepare('SELECT * FROM hhba_v4_background_tasks WHERE phone=? AND id=?').bind(phone,id).first():null;
const put=async(env,id,suffix,value)=>bucketOf(env).put(key(id,suffix),JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
const get=async(env,id,suffix)=>{const v=await bucketOf(env).get(key(id,suffix));return v?JSON.parse(await v.text()):null;};
const publicState=t=>({id:t.id,state:t.state,phase:t.phase,uploaded_parts:t.uploaded_parts,research_round:t.research_round,error:t.error||null});
export async function purgeBackgroundSource(env,id){
 let cursor;
 do{
  const page=await bucketOf(env).list({prefix:key(id,''),...(cursor?{cursor}:{})});
  if(page.objects.length)await bucketOf(env).delete(page.objects.map(x=>x.key));
  cursor=page.truncated?page.cursor:undefined;
 }while(cursor);
}
export async function createBackground(env,phone,body){
 if(body?.consent!==true||body?.consent_background_storage!==true||body?.country!=='CN')throw Error('BACKGROUND_CONSENT_REQUIRED');
 const id=body.id;
 if(!uuid.test(id||''))throw Error('INVALID_REQUEST');
 const db=dbOf(env),existing=await owned(db,phone,id);
 if(existing)return publicState(existing);
 if(await db.prepare('SELECT id FROM hhba_v4_match_tasks WHERE id=?').bind(id).first())throw Error('BACKGROUND_ID_CONFLICT');
 let resumeId=body.resume_id||null;
 if(resumeId&&(!uuid.test(resumeId)||!await db.prepare('SELECT id FROM hhba_candidate_resumes WHERE phone=? AND id=?').bind(phone,resumeId).first()))throw Error('RESUME_NOT_OWNED');
 const now=Date.now(),role=redactForModel(typeof body.role_hint==='string'?body.role_hint:'',{unbounded:true});
 await db.prepare('INSERT INTO hhba_v4_background_tasks(id,phone,resume_id,role_hint,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,phone,resumeId,role,'UPLOADING',now,now).run();
 const row=await owned(db,phone,id);if(!row)throw Error('BACKGROUND_NOT_FOUND');return publicState(row);
}
export async function uploadBackgroundPart(env,phone,id,index,request){
 const db=dbOf(env),row=await owned(db,phone,id);
 if(!row||row.state!=='UPLOADING'||!Number.isSafeInteger(index)||index<0||index>row.uploaded_parts)throw Error('INVALID_BACKGROUND_PART');
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_BACKGROUND_PART');
 let total=0,parts=[];const decoder=new TextDecoder('utf-8',{fatal:true});
 try{for(;;){const x=await reader.read();if(x.done)break;total+=x.value.byteLength;if(total>PART_BYTES){await reader.cancel();throw Error('BACKGROUND_PART_TOO_LARGE');}parts.push(decoder.decode(x.value,{stream:true}));}parts.push(decoder.decode());}
 finally{reader.releaseLock();}
 const text=redactForModel(parts.join(''),{unbounded:true});
 if(!text.trim())throw Error('INVALID_BACKGROUND_PART');
 if(index<row.uploaded_parts){if(await get(env,id,'source/'+index)!==text)throw Error('BACKGROUND_PART_CONFLICT');return publicState(row);}
 // One sequential part at a time. R2 put precedes the monotonic D1 counter.
 const stored=await bucketOf(env).put(key(id,'source/'+index),JSON.stringify(text),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!stored&&await get(env,id,'source/'+index)!==text)throw Error('BACKGROUND_PART_CONFLICT');
 const updated=await db.prepare("UPDATE hhba_v4_background_tasks SET uploaded_parts=uploaded_parts+1,updated_at=? WHERE id=? AND phone=? AND state='UPLOADING' AND uploaded_parts=?").bind(Date.now(),id,phone,index).run();
 if(!changed(updated)){const current=await owned(db,phone,id);if(current?.state==='UPLOADING'&&current.uploaded_parts>index)return publicState(current);if(!current||current.state==='CANCELLED')await bucketOf(env).delete(key(id,'source/'+index));throw Error('BACKGROUND_PART_CONFLICT');}
 return publicState(await owned(db,phone,id));
}
export async function queueBackground(env,phone,id,body){
 const db=dbOf(env),row=await owned(db,phone,id);
 if(!row)throw Error('BACKGROUND_NOT_FOUND');
 if(row.state!=='UPLOADING'){if(['QUEUED','RUNNING','PAUSED','COMPLETE'].includes(row.state))return publicState(row);throw Error('BACKGROUND_NOT_FOUND');}
 if(body?.parts!==row.uploaded_parts||row.uploaded_parts<1)throw Error('INVALID_BACKGROUND_PART');
 // Establish private history before marking the task accepted.
 await saveV4Round(db,phone,{taskId:id,resumeId:row.resume_id,roleHint:row.role_hint,matches:[],researchPending:true});
 const updated=await db.prepare("UPDATE hhba_v4_background_tasks SET state='QUEUED',updated_at=?,next_at=0 WHERE id=? AND phone=? AND state='UPLOADING'").bind(Date.now(),id,phone).run();
 if(!changed(updated))throw Error('BACKGROUND_NOT_FOUND');return publicState(await owned(db,phone,id));
}
export async function backgroundState(env,phone,id){const t=await owned(dbOf(env),phone,id);return t?publicState(t):null;}
export async function cancelBackground(env,phone,id){
 const db=dbOf(env),row=await owned(db,phone,id);if(!row)return false;
 if(row.state!=='COMPLETE'){
  await db.prepare("UPDATE hhba_v4_background_tasks SET state='CANCELLED',updated_at=? WHERE id=? AND phone=?").bind(Date.now(),id,phone).run();
  await finishV4History(db,phone,id);
 }
 // If a provider call was already issued its cost cannot be revoked. The
 // lease check prevents any subsequent model calls or result publication.
 await purgeBackgroundSource(env,id);return true;
}
export async function resumeBackground(env,phone,id){
 const db=dbOf(env);
 const r=await db.prepare("UPDATE hhba_v4_background_tasks SET state='QUEUED',error=NULL,next_at=0,lease=NULL,lease_until=0,updated_at=? WHERE id=? AND phone=? AND state='PAUSED'").bind(Date.now(),id,phone).run();
 return changed(r);
}
const retryable=code=>/^(AI_PROVIDER_RATE_LIMITED|AI_PROVIDER_UPSTREAM_ERROR|AI_PROVIDER_NETWORK_ERROR|AI_PROVIDER_TIMEOUT|AI_PROVIDER_STREAM_INTERRUPTED|AI_PROVIDER_RESPONSE_INVALID|AI_PROVIDER_UNAVAILABLE|AI_PROVIDER_INCOMPLETE|V4_PAGE_TEMPORARILY_UNAVAILABLE)$/.test(code);
const permanentJD=code=>/^(JD_NOT_COMPLETE_ENOUGH|JD_JOB_IDENTITY_MISMATCH|V4_UNSAFE_URL|V4_JOB_DETAILS_NOT_VERIFIED|V4_PAGE_UNAVAILABLE)$/.test(code);
const codeOf=e=>typeof e?.code==='string'?e.code:typeof e?.message==='string'&&/^[A-Z0-9_]+$/.test(e.message)?e.message:e instanceof TypeError?'AI_PROVIDER_NETWORK_ERROR':'BACKGROUND_STEP_FAILED';
export async function advanceBackground(env,{fetcher=fetch,now=Date.now()}={}){
 const db=dbOf(env);
 // Expired upload sessions were never authorized to start AI. Clean one
 // abandoned upload per tick, with no task-wide time limit for queued work.
 const abandoned=await db.prepare("SELECT id,phone FROM hhba_v4_background_tasks WHERE state='UPLOADING' AND updated_at<? ORDER BY updated_at LIMIT 1").bind(now-24*3600000).first();
 if(abandoned){await cancelBackground(env,abandoned.phone,abandoned.id);return {state:'CLEANED'};}
 const row=await db.prepare("SELECT * FROM hhba_v4_background_tasks WHERE state IN ('QUEUED','RUNNING') AND next_at<=? AND lease_until<=? ORDER BY updated_at,id LIMIT 1").bind(now,now).first();
 if(!row)return {state:'IDLE'};
 const lease=crypto.randomUUID();
 const claim=await db.prepare("UPDATE hhba_v4_background_tasks SET state='RUNNING',lease=?,lease_until=?,updated_at=? WHERE id=? AND state IN ('QUEUED','RUNNING') AND lease_until<=?").bind(lease,now+20*60000,now,row.id,now).run();
 if(!changed(claim))return {state:'BUSY'};
 const id=row.id,phone=row.phone;
 const live=async()=>{const current=await owned(db,phone,id);if(current?.state!=='RUNNING'||current.lease!==lease)throw Error('BACKGROUND_CANCELLED');
  if(!await db.prepare('SELECT id FROM hhba_v4_match_tasks WHERE id=? AND phone=?').bind(id,phone).first())throw Error('BACKGROUND_HISTORY_MISSING');
  if(current.resume_id&&!await db.prepare('SELECT id FROM hhba_candidate_resumes WHERE id=? AND phone=?').bind(current.resume_id,phone).first())throw Error('BACKGROUND_RESUME_REMOVED');};
 const update=async(phase,sourcePart,round,state='QUEUED',error=null,nextAt=0)=>{
  await live();
  return changed(await db.prepare("UPDATE hhba_v4_background_tasks SET state=?,phase=?,source_part=?,research_round=?,error=?,next_at=?,lease=NULL,lease_until=0,updated_at=? WHERE id=? AND state='RUNNING' AND lease=?").bind(state,phase,sourcePart,round,error,nextAt,Date.now(),id,lease).run());
 };
 try{
  const detail=await getV4History(db,phone,id);
  if(!detail)throw Error('BACKGROUND_HISTORY_MISSING');
  const matches=detail.matches;
  if(row.phase==='SEARCH'){
   const source=await get(env,id,'source/'+row.source_part);
   if(typeof source!=='string'||!source.trim())throw Error('BACKGROUND_SOURCE_MISSING');
   const context=await get(env,id,'context/'+row.source_part);
   await live();
   const found=await v4Match(fetcher,v4Provider(env),source,row.role_hint,{oneRound:true,skipEnrich:true,previousPostings:matches.map(j=>({posting_key:v4PostingKey(j),url:j.official_url,title:j.title,company:j.company,location:j.location})),researchContext:context||{round:row.research_round,summary:'继续阅读全部已授权的简历片段。'}});
   await live();
   await saveV4Round(db,phone,{taskId:id,resumeId:row.resume_id,roleHint:row.role_hint,matches:found.matches.map(j=>({...j,match_score:null,score_basis:'等待完整简历与正式 JD 核验。'})),researchPending:true,researchRound:found.research_context?.round});
   await put(env,id,'context/'+row.source_part,found.research_context);
   const round=found.research_context?.round||row.research_round+1;
   if(found.native_search?.research_error&&!retryable(found.native_search.research_error))throw Error(found.native_search.research_error);
   if(found.research_pending){await update('SEARCH',row.source_part,round,'QUEUED',found.native_search?.research_error||null,found.native_search?.research_error?Date.now()+60000:0);return {state:'QUEUED',phase:'SEARCH'};}
   const next=row.source_part+1;
   await update(next<row.uploaded_parts?'SEARCH':'VERIFY',next<row.uploaded_parts?next:0,round);
   return {state:'QUEUED'};
  }
  // Verified jobs are scored against every source part, not just the first.
  // Public history stays unscored until all parts have been considered.
  const candidate=matches.find(j=>!['AI_VERIFIED_JD_SCORED','INSUFFICIENT_RESUME_EVIDENCE','BACKGROUND_UNVERIFIED'].includes(j.jd_score_status));
  if(!candidate){
   await live();await finishV4History(db,phone,id);
   await update('DONE',0,row.research_round,'COMPLETE');
   await purgeBackgroundSource(env,id);return {state:'COMPLETE'};
  }
  const posting=v4PostingKey(candidate),jobKey='job/'+posting;
  let job=candidate;
  if(!job.jd_version_id){
   try{const verified=await prepareV4JobForOptimization(env,job.official_url,{fetcher,expectedTitle:job.title});await live();await patchV4Job(db,phone,id,job.official_url,verified,posting);await update('VERIFY',0,row.research_round);return {state:'QUEUED'};}
   catch(e){const code=codeOf(e);if(!permanentJD(code))throw e;await live();await patchV4Job(db,phone,id,job.official_url,{jd_score_status:'BACKGROUND_UNVERIFIED',match_score:null,score_basis:'未取得可靠的完整 JD，未提供匹配分。'},posting);await update('VERIFY',0,row.research_round);return {state:'QUEUED'};}
  }
  // One score part per invocation; retain intermediate evidence privately.
  let findings=await get(env,id,jobKey)||{next:0,parts:[]};
  if(findings.next<row.uploaded_parts){
   const source=await get(env,id,'source/'+findings.next);
   if(typeof source!=='string')throw Error('BACKGROUND_SOURCE_MISSING');
   await live();
   const score=await scoreVerifiedV4Job(env,job,source,{fetcher});await live();
   findings.parts.push(score);findings.next++;
   await put(env,id,jobKey,findings);
   await update('VERIFY',0,row.research_round);return {state:'QUEUED'};
  }
  let final=findings.parts[0];
  if(findings.parts.length>1){
   // Combine all independently grounded evidence. Never average local scores
   // or accept a numerical score with no supporting source evidence.
   const comparisons=findings.parts.flatMap(p=>p.jd_comparisons||[]);
   const evidence=comparisons.some(c=>c.resume_evidence);
   let value=null,reason='完整分段研究未发现足够的简历证据。';
   if(evidence){
    await live();
    const r=await v4Call(fetcher,v4Provider(env),{instructions:'综合同一岗位与同一份简历所有分段的真实核验证据。不得平均局部分数，某段未发现证据不代表其他段没有。不能捏造资格。只返回 JSON {score:0至100整数或null,reason:解释}。',input:JSON.stringify({title:job.title,findings:findings.parts.map(p=>({score:p.match_score,reason:p.recommendation_reason,comparisons:p.jd_comparisons}))})});
    if(r.status!=='completed')throw Error('AI_PROVIDER_INCOMPLETE');
    const a=v4ParseJson(r);value=Number.isInteger(a.score)&&a.score>=0&&a.score<=100?a.score:null;reason=typeof a.reason==='string'?a.reason:reason;
   }
   final={match_score:value,reference_score:value??0,jd_score_status:value===null?'INSUFFICIENT_RESUME_EVIDENCE':'AI_VERIFIED_JD_SCORED',score_basis:'已逐段核验全部授权简历文本与同一岗位 JD。',recommendation_reason:reason};
  }
  await live();await patchV4Job(db,phone,id,job.official_url,final,posting);
  await bucketOf(env).delete(key(id,jobKey));await update('VERIFY',0,row.research_round);
  return {state:'QUEUED'};
 }catch(e){
  const code=codeOf(e);
  if(['BACKGROUND_HISTORY_MISSING','BACKGROUND_RESUME_REMOVED'].includes(code)){await cancelBackground(env,phone,id);return {state:'CANCELLED'};}
  if(code==='BACKGROUND_CANCELLED'){const current=await owned(db,phone,id);if(!current||current.state==='CANCELLED'||current.state==='COMPLETE')await purgeBackgroundSource(env,id).catch(()=>{});return {state:'STALE_LEASE'};}
  try{await update(row.phase,row.source_part,row.research_round,retryable(code)?'QUEUED':'PAUSED',code,retryable(code)?Date.now()+60000:0);}catch{}
  return {state:retryable(code)?'RETRY':'PAUSED',error:code};
 }
}
