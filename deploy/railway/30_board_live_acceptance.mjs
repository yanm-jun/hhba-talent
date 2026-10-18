import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://hhba-live-jobs-preview-production.up.railway.app';
const src=readFileSync(new URL('./live_jobs_preview.ts',import.meta.url),'utf8');
const start=src.indexOf('const boards:Board[]=[');
const end=src.indexOf('];',start);
if(start<0||end<0)throw Error('Canonical ATS board registry was not found');
const chunk=src.slice(start,end+2);
const registry=[...chunk.matchAll(/\{platform:"([^"]+)",company:"([^"]+)",slug:"([^"]+)"\}/g)]
 .map(m=>({platform:m[1],company:m[2],slug:m[3]}));
if(registry.length<30)throw Error('Canonical registry unexpectedly shrank below 30 sources; got '+registry.length);
if(new Set(registry.map(x=>x.platform+'/'+x.slug)).size!==registry.length)throw Error('Duplicate ATS board source');
const results=[];
let pending=0;
async function get(url,max=20000){
 for(let n=0;n<2;n++){
  try{
   const resp=await fetch(url,{signal:AbortSignal.timeout(max),headers:{Accept:'application/json'}});
   if((resp.status===429||resp.status>=500)&&n===0){await new Promise(r=>setTimeout(r,900));continue;}
   if(!resp.ok)return {status:resp.status,error:'HTTP '+resp.status};
   return {status:resp.status,body:await resp.json()};
  }catch(err){if(n===1)return {error:err.name||'network_error'};}
 }
 return {error:'unavailable'};
}
const live=await get(base+'/api/jobs',90000);
if(live.status!==200||!Array.isArray(live.body.jobs))throw Error('Public job catalog failed '+JSON.stringify(live));
const data=live.body,all=data.jobs.filter(x=>x.platform==='greenhouse'||x.platform==='ashby'||x.platform==='lever');
const domestic=live.body.jobs.filter(x=>x.platform==='xiaomi-official');
if(domestic.length&&domestic.some(x=>x.company!=='Xiaomi'||x.domestic!==true))throw Error('Unexpected domestic record');
const index=new Map(registry.map(x=>[x.platform+'/'+x.slug,[]]));
const issues=[],seen=new Set(),urls=new Set();
let missingChinese=0,machine=0,rules=0,notCertified=0;
for(const job of all){
 const key=job.platform+'/'+job.source;
 if(!index.has(key))issues.push({kind:'unexpected_board',id:job.id,key});
 else index.get(key).push(job);
 if(seen.has(job.id))issues.push({kind:'duplicate_job_id',id:job.id});seen.add(job.id);
 if(urls.has(job.url))issues.push({kind:'duplicate_original_url',id:job.id});urls.add(job.url);
 if(!job.titleZh||!/[\u3400-\u9fff]/.test(job.titleZh)||job.titleStatus==='pending')missingChinese++;
 if(job.titleStatus==='machine')machine++;else if(job.titleStatus==='rules')rules++;
 try{
  const url=new URL(job.url);
  if(url.protocol!=='https:'||!url.pathname.split('/').includes(job.source))throw Error('mismatch');
 }catch{issues.push({kind:'bad_source_url',id:job.id});}
}
let next=0;
async function worker(){
 while(next<registry.length){
  const i=next++,b=registry[i],items=index.get(b.platform+'/'+b.slug);
  const sample=items.find(x=>/engineer|manager|analyst|scientist|specialist|consultant|designer|therapist/i.test(x.title))||items[0];
  const outcome={company:b.company,platform:b.platform,slug:b.slug,listed:items.length,
    sampleId:sample?.id||null,english:sample?.title||null,chinese:sample?.titleZh||null};
  if(!sample){outcome.issue='no_listed_jobs';results[i]=outcome;continue;}
  const detail=await get(base+'/api/jobs/'+encodeURIComponent(sample.id),35000);
  const body=detail.body;
  if(detail.status!==200)outcome.issue=detail.error||'detail_failed';
  else if(body?.job?.id!==sample.id||body?.job?.url!==sample.url||body?.job?.title!==sample.title)
    outcome.issue='official_identity_mismatch';
  else if(typeof body.description!=='string'||body.description.length<100)
    outcome.issue='original_jd_missing_or_short';
  else outcome.originalJdChars=body.description.length;
  results[i]=outcome;
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
for(const r of results)if(r.issue)issues.push({kind:r.issue,company:r.company,slug:r.slug,id:r.sampleId});
const summary={time:new Date().toISOString(),registry:registry.length,boardsWithJobs:results.filter(x=>x.listed>0).length,
 listed:all.length,domesticObserved:domestic.length,boardsReportedByWebsite:data.boards,sourceFailures:data.failures,
 machineTranslatedTitles:machine,ruleTitles:rules,pendingChineseTitles:missingChinese,
 officialJdSamplesPassed:results.filter(x=>x.originalJdChars>=100).length,
 problemCount:issues.length};
await mkdir('current-board-audit',{recursive:true});
await writeFile('current-board-audit/results.json',JSON.stringify({summary,results,issues},null,2));
console.log('HHBA_CURRENT_BOARD_ACCEPTANCE',JSON.stringify(summary));
for(const x of results)console.log('HHBA_CURRENT_BOARD',JSON.stringify({slug:x.slug,company:x.company,jobs:x.listed,jd:x.originalJdChars||0,error:x.issue||null}));
if(results.length!==registry.length||summary.boardsWithJobs!==registry.length||
 summary.officialJdSamplesPassed!==registry.length||
 data.boards!==registry.length||data.failures||issues.length)process.exitCode=1;
