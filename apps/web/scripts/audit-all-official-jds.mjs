import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {searchFacts} from '../src/services/jobSearchFacets.mjs';

const ACTIVE_ATS=new Set(['greenhouse','ashby','lever']);
const ALLOWED_DOMESTIC=new Set(['xiaomi-official','meituan-official','tencent-official','baidu-official']);
const LIMIT=25000;
const REQUIREMENT_HINT=/\b(?:qualifications?|requirements?|skills?|experience|expertise|proficien\w*|must.have|you bring|what we.re looking|abilities|education|degree)\b|任职|要求|学历|专业|技能|资质|资格|经验/i;
const RESPONSIBILITY_HINT=/responsibilit|duties|what you.ll do|your role|the role|job description|you will|职位描述|岗位职责|工作职责/i;
const collapse=s=>String(s||'').replace(/\s+/g,' ').trim();
const stripped=s=>collapse(String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>'));
const sha256=s=>createHash('sha256').update(s).digest('hex');
function officialPath(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  return u.origin+u.pathname+(u.searchParams.has('gh_jid')?'?gh_jid='+u.searchParams.get('gh_jid'):'');
 }catch{return null;}
}
function nativeId(job){
 const platform=String(job.platform||''),source=String(job.source||'');
 if(!ACTIVE_ATS.has(platform)||!/^[A-Za-z0-9_-]{1,100}$/.test(source))return null;
 const prefix=platform+'-'+source+'-';
 if(!String(job.id||'').startsWith(prefix))return null;
 const id=job.id.slice(prefix.length);
 return /^[A-Za-z0-9_-]{1,110}$/.test(id)?id:null;
}
function boardUrl(platform,slug){
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(slug))throw Error('INVALID_BOARD_SLUG');
 if(platform==='greenhouse')return 'https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(slug)+'/jobs?content=true';
 if(platform==='ashby')return 'https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(slug);
 if(platform==='lever')return 'https://api.lever.co/v0/postings/'+encodeURIComponent(slug)+'?mode=json';
 throw Error('UNSUPPORTED_PLATFORM');
}
function getRecords(platform,body){
 if(platform==='lever')return Array.isArray(body)?body:null;
 return Array.isArray(body?.jobs)?body.jobs:null;
}
function contentOf(platform,raw){
 if(platform==='greenhouse')return typeof raw?.content==='string'?raw.content:'';
 if(platform==='ashby')return typeof raw?.descriptionHtml==='string'?raw.descriptionHtml:'';
 if(platform==='lever'){
  const parts=[raw?.description||raw?.descriptionPlain||''];
  if(Array.isArray(raw?.lists))for(const block of raw.lists.slice(0,60))
    parts.push(String(block?.text||''),String(block?.content||''));
  parts.push(String(raw?.additional||raw?.additionalPlain||''),String(raw?.salaryDescription||''));
  return parts.join('\n\n');
 }
 return '';
}
function listingUrlOf(platform,raw){
 return platform==='greenhouse'?raw?.absolute_url:platform==='ashby'?raw?.jobUrl:raw?.hostedUrl;
}
function titleOf(platform,raw){
 return platform==='lever'?raw?.text:raw?.title;
}
function resultOf(job,status,extra={}){
 return {job_id:job.id,platform:job.platform||'UNKNOWN',
   company:job.company||'UNKNOWN',status,
   full_original_jd_verified:false, requirements_evidence:false,
   responsibilities_evidence:false, chinese_full_jd_verified:false,
   ...extra};
}
async function getJson(url,{fetchFn=fetch,retries=1}={}){
 for(let attempt=0;attempt<=retries;attempt++){
  try{
   const response=await fetchFn(url,{method:'GET',headers:{Accept:'application/json'},
     redirect:'error',signal:AbortSignal.timeout(25000)});
   if(!response.ok){
     if(attempt<retries && (response.status===429 || response.status>=500))continue;
     throw Error('UPSTREAM_HTTP_'+response.status);
   }
   if(Number(response.headers?.get?.('content-length')||0)>24*1024*1024)
     throw Error('RESPONSE_EXCEEDS_SIZE_LIMIT');
   const body=await response.json();
   if(!body||typeof body!=='object')throw Error('MALFORMED_OFFICIAL_JSON');
   return body;
  }catch(e){
   if(attempt===retries)throw e;
  }
 }
 throw Error('UNKNOWN_SOURCE_FAILURE');
}
export async function auditSnapshot(snapshot,{fetchFn=fetch,concurrency=5,now=Date.now()}={}){
 if(!snapshot||!Array.isArray(snapshot.jobs)||snapshot.jobs.length===0||
    snapshot.jobs.length>LIMIT||snapshot.total!==snapshot.jobs.length ||
    snapshot.failures!==0 || !Number.isFinite(Date.parse(snapshot.updated)))
    throw Error('INVALID_OR_INCOMPLETE_SOURCE_SNAPSHOT');
 const sourceTime=Date.parse(snapshot.updated);
 if(sourceTime>now+5*60_000||now-sourceTime>24*3600_000)
   throw Error('INDEX_SNAPSHOT_IS_NOT_RECENT');
 const jobs=snapshot.jobs, results=new Array(jobs.length),groups=new Map(),ids=new Set();
 for(const [i,job]of jobs.entries()){
  if(!job||typeof job!=='object'||!/^[A-Za-z0-9_-]{1,180}$/.test(String(job.id||''))){
   results[i]=resultOf(job||{},'INVALID_JOB_ID');continue;
  }
  if(ids.has(job.id)){results[i]=resultOf(job,'DUPLICATE_JOB_ID');continue;}
  ids.add(job.id);
  if(job.domestic===true || ALLOWED_DOMESTIC.has(job.platform)){
   results[i]=resultOf(job,job.platform==='xiaomi-official'?'DOMESTIC_CHANNEL_ONLY':
      'DOMESTIC_DETAIL_READER_REQUIRED',
      {official_detail_verified:false,reason:'NO_VERIFIED_PER_JOB_JD_READER'});
   continue;
  }
  if(!ACTIVE_ATS.has(job.platform)||!nativeId(job)||!officialPath(job.url)){
   results[i]=resultOf(job,'INVALID_ATS_ID_OR_URL');continue;
  }
  const key=job.platform+'::'+job.source;
  if(!groups.has(key))groups.set(key,{platform:job.platform,slug:job.source,items:[]});
  groups.get(key).items.push({i,job,id:nativeId(job)});
 }
 const boards=[...groups.values()],failures=[];
 let index=0;
 async function worker(){
  while(index<boards.length){
   const board=boards[index++];
   const key=board.platform+'::'+board.slug;
   try{
    const raw=await getJson(boardUrl(board.platform,board.slug),{fetchFn});
    const records=getRecords(board.platform,raw);
    if(!records)throw Error('INVALID_OFFICIAL_JOB_ARRAY');
    const byNative=new Map();
    for(const record of records){
      if(!record||record.isListed===false)continue;
      const id=String(record.id??'');
      if(id&&!byNative.has(id))byNative.set(id,record);
    }
    for(const {i,job,id}of board.items){
      const record=byNative.get(id);
      if(!record){results[i]=resultOf(job,'MISSING_FROM_OFFICIAL_BOARD');continue;}
      const officialPathNow=officialPath(listingUrlOf(board.platform,record));
      if(!officialPathNow||officialPathNow!==officialPath(job.url)){
        results[i]=resultOf(job,'OFFICIAL_URL_CHANGED');continue;
      }
      const rawContent=contentOf(board.platform,record);
      const readable=stripped(rawContent);
      const title=collapse(titleOf(board.platform,record));
      if(!title){results[i]=resultOf(job,'OFFICIAL_TITLE_MISSING');continue;}
      if(readable.length<100 || readable.length>240000){
        results[i]=resultOf(job,'OFFICIAL_JD_MISSING_OR_TRUNCATED',{official_title_verified:title===job.title});continue;
      }
      const requirements=REQUIREMENT_HINT.test(readable),responsibilities=RESPONSIBILITY_HINT.test(readable);
      const titleChanged=title!==collapse(job.title);
      // Do not infer that an employer authorizes us to republish its full copyrighted JD.
      const status=titleChanged?'OFFICIAL_TITLE_CHANGED':
        requirements?'OFFICIAL_JD_AND_REQUIREMENTS_FOUND':'OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED';
      results[i]=resultOf(job,status,{
        full_original_jd_verified:!titleChanged && requirements,
        official_jd_observed:true,requirements_evidence:requirements,
        responsibilities_evidence:responsibilities,
        chinese_full_jd_verified:false,
        official_title_verified:!titleChanged,
        jd_sha256:sha256(readable),jd_characters:readable.length,
        search:searchFacts(job,rawContent),
        official_checked_at:new Date(now).toISOString()
      });
    }
  }catch(e){
    const reason=String(e instanceof Error?e.message:'UNKNOWN_ERROR').slice(0,100);
    failures.push({platform:board.platform,source:board.slug,reason,affected_jobs:board.items.length});
    for(const {i,job} of board.items)results[i]=resultOf(job,'OFFICIAL_SOURCE_READ_FAILED',{source_error:reason});
  }
  }
 }
 await Promise.all(Array.from({length:Math.max(1,Math.min(8,concurrency))},()=>worker()));
 if(results.some(x=>!x))throw Error('INTERNAL_AUDIT_INCOMPLETE');
 const statusCounts={},platformCounts={},companyCounts={};
 for(const item of results){
  statusCounts[item.status]=(statusCounts[item.status]||0)+1;
  platformCounts[item.platform]=(platformCounts[item.platform]||0)+1;
  companyCounts[item.company]=(companyCounts[item.company]||0)+1;
 }
 const eligible=results.filter(x=>x.full_original_jd_verified).length;
 const summary={
  kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',
  indexed_as_of:snapshot.updated,checked_at:new Date(now).toISOString(),
  total_indexed_jobs:results.length,verified_full_original_jd_and_requirements:eligible,
  verified_complete_chinese_jd:0,coverage_ratio:Number((eligible/results.length).toFixed(5)),
  official_ats_boards_checked:boards.length,
  official_ats_board_failures:failures.length,
  statuses:statusCounts,platforms:platformCounts,
  distinct_companies:Object.keys(companyCounts).length,
  blocked_and_incomplete:results.length-eligible,
  claim:'AUDIT_ONLY_NOT_FULL_SYNC_OR_LICENSED_REPUBLICATION'
 };
 return {summary,jobs:results,source_failures:failures};
}
export function compareFeeds(previous,current){
 const old=new Map((previous?.jobs||[]).filter(x=>x?.id).map(x=>[x.id,x]));
 const cur=new Map((current?.jobs||[]).filter(x=>x?.id).map(x=>[x.id,x]));
 const added=[...cur.keys()].filter(id=>!old.has(id));
 const absent=[...old.keys()].filter(id=>!cur.has(id));
 const changed=[...cur.entries()].filter(([id,job])=>{
  const prior=old.get(id);
  return prior&&(prior.title!==job.title||prior.location!==job.location||
    prior.url!==job.url||prior.recruitmentType!==job.recruitmentType);
 }).map(([id])=>id);
 return {added:added.length,absent_from_current_feed:absent.length,changed:changed.length,
  absent_ids:absent.slice(0,20000),changed_ids:changed.slice(0,20000)};
}
export function compareAudits(previous,current){
 const oldRows=new Map((previous?.jobs||[]).filter(x=>x?.job_id).map(x=>[x.job_id,x]));
 const changed=[],statusChanged=[],newlyChecked=[];
 for(const item of (current?.jobs||[])){
  const prior=oldRows.get(item.job_id);
  if(!prior){newlyChecked.push(item.job_id);continue;}
  if(item.jd_sha256 && prior.jd_sha256 && item.jd_sha256!==prior.jd_sha256)
   changed.push(item.job_id);
  if(item.status!==prior.status)statusChanged.push(item.job_id);
 }
 return {jd_content_changes:changed.length,status_changes:statusChanged.length,
  newly_audited:newlyChecked.length,
  jd_content_changed_ids:changed,
  status_changed_ids:statusChanged};
}
async function main(){
 const dir=resolve(process.env.HHBA_AUDIT_DIST||'dist');
 const json=JSON.parse(await readFile(resolve(dir,'data','jobs.json'),'utf8'));
 const report=await auditSnapshot(json);
 let feedDiff=null;
 try{
  const previous=await getJson('https://yanm-jun.github.io/hhba-talent/data/jobs.json',{retries:0});
  feedDiff=compareFeeds(previous,json);
 }catch{feedDiff={warning:'PREVIOUS_FEED_UNAVAILABLE'};}
 let contentDiff=null;
 try{
  const previousAudit=await getJson('https://yanm-jun.github.io/hhba-talent/data/job-sync-status.json',{retries:0});
  if(previousAudit?.summary?.kind==='HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1')
    contentDiff=compareAudits(previousAudit,report);
 }catch{contentDiff={warning:'PREVIOUS_JD_AUDIT_NOT_AVAILABLE'};}
 const safe={...report,feed_change:feedDiff,jd_content_change:contentDiff};
 await mkdir(resolve(dir,'data'),{recursive:true});
 await writeFile(resolve(dir,'data','job-sync-status.json'),JSON.stringify(safe),'utf8');
 const sourceFacets=report.jobs.filter(item=>item.search &&
   (item.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND' ||
    item.status==='OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED'));
 const facets={
  kind:'HHBA_OFFICIAL_JD_SEARCH_FACETS_V1',
  indexed_as_of:json.updated,
  verified_at:report.summary.checked_at,
  total_indexed_jobs:json.jobs.length,
  extracted_count:sourceFacets.length,
  extraction_mode:'CONSERVATIVE_HEURISTICS_UNDISCLOSED_IS_UNKNOWN',
  jobs:sourceFacets.map(item=>({
   id:item.job_id,
   ...item.search,
   original_source_hash:item.jd_sha256
  }))
 };
 await writeFile(resolve(dir,'data','job-search-facets.json'),JSON.stringify(facets),'utf8');

 await writeFile(resolve(dir,'data','job-sync-summary.json'),JSON.stringify({...report.summary,
   source_failures:report.source_failures,feed_change:feedDiff,jd_content_change:contentDiff}),'utf8');
 console.log('HHBA_ALL_JOBS_OFFICIAL_JD_AUDIT',JSON.stringify({
  total:report.summary.total_indexed_jobs,
  official_full_details:report.summary.verified_full_original_jd_and_requirements,
  complete_chinese:0,
  source_failures:report.summary.official_ats_board_failures,
  statuses:report.summary.statuses,
  feed_change:feedDiff?{added:feedDiff.added,absent:feedDiff.absent_from_current_feed,changed:feedDiff.changed}:null,
  jd_content_changed:typeof contentDiff?.jd_content_changes==='number'?contentDiff.jd_content_changes:null,
  facet_jobs:sourceFacets.length,
  output:'metadata-only status report'
 }));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(e=>{console.error('HHBA_JD_AUDIT_FAILED',e.message);process.exitCode=1;});
}
