import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
const BASE='https://hhba-live-jobs-preview-production.up.railway.app';
const source=readFileSync(new URL('./live_jobs_preview.ts',import.meta.url),'utf8');
const boards=[...source.matchAll(/\{platform:"(greenhouse|ashby|lever)",company:"([^"]+)",slug:"([^"]+)"\}/g)]
 .map(x=>({platform:x[1],company:x[2],slug:x[3]}));
const key=x=>x.platform+'/'+x.slug;
async function json(url,ms=30000){
 let reason='unknown';
 for(let i=0;i<2;i++){
  try{
   const resp=await fetch(url,{signal:AbortSignal.timeout(ms),headers:{Accept:'application/json'}});
   if(!resp.ok){reason='HTTP_'+resp.status;if(resp.status>=500&&i===0)continue;return {reason};}
   return {body:await resp.json()};
  }catch(e){reason=e.name||'network_error'}
 }
 return {reason};
}
function officialUrl(j){
 try{
  const u=new URL(j.url),domains=j.platform==='ashby'?['jobs.ashbyhq.com']:
   j.platform==='lever'?['jobs.lever.co','jobs.eu.lever.co']:
   ['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io'];
  return u.protocol==='https:'&&domains.includes(u.hostname)&&u.pathname.split('/').includes(j.source);
 }catch{return false}
}
async function run(){
 if(boards.length<34)throw Error('Registry must contain at least 34 sources');
 if(new Set(boards.map(key)).size!==boards.length)throw Error('Duplicate source registry');
 const body=(await json(BASE+'/api/jobs',90000)).body;
 if(!Array.isArray(body?.jobs))throw Error('Production jobs API is not available');
 const grouped=new Map(boards.map(x=>[key(x),[]]));
 const issues=[],ids=new Set(),urls=new Set();
 const counts={machine:0,rules:0,pending:0};
 for(const j of body.jobs){
  const k=key(j);
  if(!grouped.has(k)){issues.push({type:'unapproved_source',jobId:j.id,source:k});continue;}
  grouped.get(k).push(j);
  if(!j.id||!j.title||!j.company||!officialUrl(j))issues.push({type:'invalid_source_identity_or_metadata',jobId:j.id});
  if(ids.has(j.id))issues.push({type:'duplicate_id',jobId:j.id});
  if(urls.has(j.url))issues.push({type:'duplicate_official_url',jobId:j.id});
  ids.add(j.id);urls.add(j.url);
  const t=j.titleStatus;
  if(t==='machine')counts.machine++;
  else if(t==='pending'||j.titleZh==='职位名称待翻译'||!j.titleZh)counts.pending++;
  else counts.rules++;
 }
 const examples=[...grouped].map(([source,items])=>({source,items,job:items[0]}));
 let next=0;
 const detail=[];
 async function worker(){
  while(next<examples.length){
   const {source,items,job}=examples[next++];
   if(!job){issues.push({type:'no_active_posting',source});detail.push({source,listed:0,valid:false});continue;}
   const result=await json(BASE+'/api/jobs/'+encodeURIComponent(job.id),50000);
   const data=result.body,desc=typeof data?.description==='string'?data.description:'';
   const ok=data?.job?.id===job.id&&data?.job?.title===job.title&&
    data?.job?.url===job.url&&desc.length>=100;
   detail.push({source,listed:items.length,valid:ok,sampleJobId:job.id,descriptionChars:desc.length,error:result.reason||null});
   if(!ok)issues.push({type:'official_jd_sample_failed',source,jobId:job.id,reason:result.reason||'identity_or_content'});
  }
 }
 await Promise.all(Array.from({length:3},()=>worker()));
 const summary={timestamp:new Date().toISOString(),registryBoards:boards.length,
  liveBoards:body.boards,sourceFailures:body.failures,totalJobs:body.jobs.length,
  titleModes:counts,verifiedDetails:detail.filter(x=>x.valid).length,
  issues:issues.length};
 await mkdir('board-audit-output',{recursive:true});
 await writeFile('board-audit-output/report.json',JSON.stringify({summary,detail,issues},null,2));
 const md=['# HHBA verified ATS source audit',
  '','## Snapshot','',JSON.stringify(summary,null,2),'',
  '| Source | Jobs | Official JD |','|---|---:|---|',
  ...detail.sort((a,b)=>a.source.localeCompare(b.source)).map(x=>'| '+x.source+' | '+x.listed+' | '+(x.valid?'PASS':'FAIL')+' |'),
  '','This verifies every live listing metadata entry and one real JD per board. It does not certify every translated JD.'].join('\n');
 await writeFile('board-audit-output/report.md',md);
 console.log('HHBA_ALL_BOARDS_AUDIT',JSON.stringify(summary));
 if(issues.length)console.log('HHBA_ALL_BOARDS_ISSUES',JSON.stringify(issues.slice(0,35)));
 if(summary.issues||summary.sourceFailures||summary.liveBoards!==summary.registryBoards||
  summary.verifiedDetails!==summary.registryBoards||body.total!==body.jobs.length)process.exitCode=1;
}
run().catch(e=>{console.error('HHBA_ALL_BOARDS_FATAL',e.stack||e.message);process.exitCode=1});
