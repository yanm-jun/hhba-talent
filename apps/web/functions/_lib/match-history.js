// Authenticated-only snapshots of AI recommendations.
// No raw CV text, document bytes, email/phone in returned JSON, telemetry or payload.
// These are recommendations, NEVER applications and NEVER automatically monitored.
import {allowedEmployerJobLink,isCommercialRecruitmentBoard} from './match-employer-source.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';

const text=(v,n=Infinity)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):'';
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
  jd_proof_method:['PUBLIC_EMPLOYER_ATS_V1','DIRECT_EMPLOYER_HTML_V1','V4_STRUCTURED_JOBPOSTING','V4_EMPLOYER_HTML_JOB']
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
  const v4=item.v4_source===true;
  if(v4&&isCommercialRecruitmentBoard(item.official_url,item))continue;
  const company=text(item.company,v4?Infinity:110),title=text(item.title_zh||item.title,v4?Infinity:125);
  const location=text(item.location,v4?Infinity:80);
  if(!company||!title||!location)continue;
  seen.add(item.official_url);
  out.push({id:text(item.id,75),company,title,location,
   ...(item.v4_source===true?{v4_source:true,source_type:item.source_type==='站外官方招聘'?'站外官方招聘':'站外招聘职位',score_evidence_status:item.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'?'GROUNDED_JD_RESUME_QUOTES':undefined,research_detail:safeDetailedReport(item.research_detail)}:{}),
   official_url:item.official_url,match_score:score(item.match_score),
   score_basis:text(item.score_basis,v4?Infinity:360),
   recommendation_reason:text(!v4&&Array.isArray(item.jd_comparisons)?
    '按核验后的岗位 JD 和当时的简历证据完成比对。重新匹配可查看逐项证据。':item.recommendation_reason,v4?Infinity:850),
   availability_status:['OPEN_LISTED','UNKNOWN'].includes(item.availability_status)?
    item.availability_status:'UNKNOWN',
   recruitment_source_kind:text(item.recruitment_source_kind,35),
   recruitment_source_note:text(item.recruitment_source_note,v4?Infinity:130),
   // Retain source provenance for later Word revisions; never persist raw CV.
   evidence_status:['VERIFIED_FULL_JD','PARTIAL_SOURCE','SEARCH_SNIPPET_ONLY','INSUFFICIENT_EVIDENCE']
    .includes(item.evidence_status)?item.evidence_status:null,
   evidence_excerpt:text(item.evidence_excerpt,v4?Infinity:1400),
   ...(v4?{requirements_basis:text(item.requirements_basis),matched:(Array.isArray(item.matched)?item.matched:[]).filter(x=>typeof x==='string'),not_evidenced:(Array.isArray(item.not_evidenced)?item.not_evidenced:[]).filter(x=>typeof x==='string'),salary:typeof item.salary==='string'?item.salary:null}:{} ),
   evidence_sources:(Array.isArray(item.evidence_sources)?(v4?item.evidence_sources:item.evidence_sources.slice(0,4)):[])
    .filter(s=>s&&typeof s.url==='string'&&(!v4||!isCommercialRecruitmentBoard(s.url))&&
     (v4?!!v4PublicJobUrl(s.url):/^(?:https:\/\/)/.test(s.url)&&s.url.length<=1300)&&
     (v4?['EMPLOYER_PAGE_CANDIDATE','PUBLIC_ANNOUNCEMENT_CANDIDATE','PUBLIC_SEARCH_CITATION','MODEL_REPORTED_SOURCE']:['EMPLOYER_PAGE_CANDIDATE','PUBLIC_ANNOUNCEMENT_CANDIDATE']).includes(s.kind))
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
// JSON-string chunks support even a single large item without truncation.
// Use conservative character chunks: UTF-8 and JSON escaping stay below
// the D1 row limit even for control characters or non-ASCII text.
export function historyTextSegments(data){
 const chunks=[];
 for(let offset=0;offset<data.length;){
  let end=Math.min(offset+65000,data.length);
  if(end<data.length&&/[\uD800-\uDBFF]/.test(data[end-1]))end--;
  chunks.push(JSON.stringify(data.slice(offset,end)));offset=end;
 }
 return chunks;
}
// Persist structured research outcomes, not raw resume or model reasoning.
// Original resume quotations are shown in the active task only.
// Store report conclusions and JD quotations, not confidential original CV quotes.
function safeDetailedReport(d){
 if(!d||typeof d!=='object'||!Array.isArray(d.comparisons))return undefined;
 return {comparisons:d.comparisons.filter(c=>c&&['supported','partial','missing'].includes(c.status)).map(c=>({requirement:text(c.requirement),resume_evidence:null,status:c.status,analysis:text(c.analysis)})),
  strengths:text(d.strengths),risks:text(d.risks),career_development:text(d.career_development),optimization_advice:text(d.optimization_advice),competition:text(d.competition),score_explanation:text(d.score_explanation),extra_sections:(Array.isArray(d.extra_sections)?d.extra_sections:[]).filter(x=>x&&typeof x.title==='string'&&typeof x.content==='string').map(x=>({title:text(x.title),content:text(x.content)}))};
}
export function safeResearchReport(report){
 if(!report||!Array.isArray(report.rounds)||!report.profile)return null;
 const p=report.profile,strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[],num=v=>Number.isSafeInteger(v)&&v>=0?v:0;
 return {profile:{education:typeof p.education==='string'?p.education:null,education_evidence:null,
  experience_years:Number.isFinite(p.experience_years)?p.experience_years:null,experience_evidence:null,
  summary:text(p.summary),skills:Array.isArray(p.skills)?p.skills.filter(s=>typeof s?.name==='string').map(s=>({name:s.name,evidence:''})):[],
  target_roles:strings(p.target_roles),warnings:['历史报告仅保留分析结论，不保存简历原文引文。']},
  rounds:report.rounds.map(r=>({round:num(r.round),queries:strings(r.queries),cited_count:num(r.cited_count),candidates:num(r.candidates),added:num(r.added),excluded_count:num(r.excluded_count)})),
  excluded_count:num(report.excluded_count),discovered:num(report.discovered),...(report.diagnostics?{diagnostics:Object.fromEntries(Object.entries(report.diagnostics).filter(([k])=>/^[A-Z_]+$/.test(k)).map(([k,v])=>[k,num(v)]))}:{}),...(report.concrete_count!==undefined?{concrete_count:num(report.concrete_count)}:{}),...(report.completion_reason?{completion_reason:text(report.completion_reason)}:{}),...(report.unresolved_source_count!==undefined?{unresolved_source_count:num(report.unresolved_source_count)}:{}),...(report.candidate_target?{candidate_target:num(report.candidate_target),final_target:num(report.final_target)}:{})};
}
function unpackHistory(raw,row){
 const parsed=JSON.parse(raw);
 if(Array.isArray(parsed))return {...row,jobs_json:raw};
 if(parsed?.format!=='HHBA_RESEARCH_REPORT_V1'||!Array.isArray(parsed.jobs))throw Error('MATCH_HISTORY_SEGMENTS_INCOMPLETE');
 return {...row,jobs_json:JSON.stringify(parsed.jobs),research_report:safeResearchReport(parsed.report),research_leads:safeHistoryJobs(parsed.leads)};
}
function segmentManifest(raw){
 try{const value=JSON.parse(raw);return ['HHBA_HISTORY_SEGMENTS_V1','HHBA_HISTORY_TEXT_SEGMENTS_V2'].includes(value?.format)&&Number.isSafeInteger(value.count)&&value.count>0?value:null;}catch{return null;}
}
async function expandHistoryRow(db,row){
 const manifest=segmentManifest(row.jobs_json);
 if(!manifest)return unpackHistory(row.jobs_json,row);
 const result=await db.prepare('SELECT position,jobs_json FROM hhba_ai_match_history_segments WHERE history_id=? ORDER BY position').bind(row.id).all();
 const segments=result?.results||[];
 if(segments.length!==manifest.count||segments.some((part,i)=>part.position!==i))throw Error('MATCH_HISTORY_SEGMENTS_INCOMPLETE');
 if(manifest.format==='HHBA_HISTORY_TEXT_SEGMENTS_V2'){
  const data=segments.map(part=>JSON.parse(part.jobs_json));
  if(data.some(v=>typeof v!=='string'))throw Error('MATCH_HISTORY_SEGMENTS_INCOMPLETE');
  return unpackHistory(data.join(''),row);
 }
 return {...row,jobs_json:JSON.stringify(segments.flatMap(part=>parsedJobs(part.jobs_json)))};
}
export async function saveMatchHistory(db,phone,resumeId,roleHint,modelMatches,researchReport=null,researchLeads=[]){
 if(!db||typeof db.prepare!=='function')throw Error('MATCH_HISTORY_DB_UNAVAILABLE');
 let resume=null;
 if(resumeId!==null&&resumeId!==undefined&&resumeId!==''){
  if(typeof resumeId!=='string'||!rowId.test(resumeId))throw Error('RESUME_NOT_OWNED');
  resume=await db.prepare('SELECT id,filename FROM hhba_candidate_resumes WHERE phone=? AND id=?')
   .bind(phone,resumeId).first();
  if(!resume)throw Error('RESUME_NOT_OWNED');
 }
 const jobs=safeHistoryJobs(modelMatches),report=safeResearchReport(researchReport);
 if(!jobs.length&&!report)return null;
 const previous=await db.prepare('SELECT id,jobs_json FROM hhba_ai_match_history WHERE phone=? ORDER BY created_at DESC LIMIT ?')
  .bind(phone,maxHistory).all();
 const previousRuns=await Promise.all((previous?.results||[]).map(row=>expandHistoryRow(db,row)));
 const delta=compareOpportunitySets(previousRuns,jobs);
 const best=jobs.reduce((v,x)=>x.match_score===null?v:Math.max(v,x.match_score),-1);
 const data=JSON.stringify(report?{format:'HHBA_RESEARCH_REPORT_V1',jobs,report,leads:safeHistoryJobs(researchLeads)}:jobs);
 const segments=new TextEncoder().encode(data).byteLength>1500000?historyTextSegments(data):null;
 const payload=segments?JSON.stringify({format:'HHBA_HISTORY_TEXT_SEGMENTS_V2',count:segments.length}):data;
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const statement=db.prepare('INSERT INTO hhba_ai_match_history(id,phone,resume_id,resume_label,role_hint,created_at,job_count,best_score,new_job_count,improved_job_count,jobs_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,phone,resume?.id||null,resume?text(resume.filename,150):'本次上传的简历（未保存）',
   text(roleHint,modelMatches.some(x=>x?.v4_source===true)?Infinity:80),created,jobs.length,best<0?null:best,
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
 const expanded=await expandHistoryRow(db,row);
 return {...summary(row),resume_id:resumeId,matches:safeHistoryJobs(parsedJobs(expanded.jobs_json)),...(expanded.research_report?{research_report:expanded.research_report,research_leads:expanded.research_leads}: {})};
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
