import {writeFile,mkdir} from 'node:fs/promises';
const SITE='https://hhba-live-jobs-preview-production.up.railway.app';
const SOURCE=[['greenhouse','greenhouse'],['greenhouse','canonical'],['ashby','ashby'],['ashby','airwallex'],['lever','spotify'],['lever','palantir']];
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function request(url){
 for(let i=0;i<2;i++)try{
  const r=await fetch(url,{signal:AbortSignal.timeout(17000),headers:{Accept:'application/json','User-Agent':'HHBA-official-source-QA/1.0'}});
  if([429,500,502,503,504].includes(r.status)&&i===0){await sleep(1200);continue;}
  if(!r.ok)return {error:'HTTP '+r.status};
  return {body:await r.json()};
 }catch(e){if(i)return {error:e.name};await sleep(900)}
 return {error:'request_error'};
}
function urlOf(platform,slug){
 return platform==='greenhouse'?'https://boards-api.greenhouse.io/v1/boards/'+slug+'/jobs':
 platform==='ashby'?'https://api.ashbyhq.com/posting-api/job-board/'+slug:
 'https://api.lever.co/v0/postings/'+slug+'?mode=json';
}
function normalized(platform,slug,row){
 const id=row?.id;
 const title=platform==='lever'?row?.text:row?.title;
 const url=platform==='greenhouse'?row?.absolute_url:platform==='ashby'?row?.jobUrl:row?.hostedUrl;
 if(!id||typeof title!=='string'||!url||row?.isListed===false)return null;
 return {id:platform+'-'+slug+'-'+String(id).slice(0,85),nativeId:String(id),title,url};
}
function bodyText(platform,row){
 const pieces=platform==='greenhouse'?[row?.content]:
 platform==='ashby'?[row?.descriptionPlain||row?.descriptionHtml]:
 [row?.description||row?.descriptionPlain,...(Array.isArray(row?.lists)?row.lists.flatMap(x=>[x.text,x.content]):[]),row?.additional||row?.additionalPlain,row?.salaryDescription];
 return pieces.filter(x=>typeof x==='string').join('\n').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&[A-Za-z0-9#]+;/g,' ').trim();
}
function permitted(job){
 try{const u=new URL(job.url);let allow=job.platform==='ashby'?['jobs.ashbyhq.com']:
 job.platform==='lever'?['jobs.lever.co','jobs.eu.lever.co']:
 ['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io'];
 return u.protocol==='https:'&&allow.includes(u.hostname)&&u.pathname.split('/').includes(job.source);
 }catch{return false}
}
const problems=[],boards={};
const issue=(kind,j,extra={})=>problems.push({kind,id:j?.id||null,source:j?.source||null,platform:j?.platform||null,...extra});
async function main(){
 const list=await request(SITE+'/api/jobs');
 if(!Array.isArray(list.body?.jobs))throw Error('HHBA catalog missing '+list.error);
 const items=list.body.jobs;const known=new Set();
 const perBoard=new Map(),observed={};
 for(const j of items){
  const board=j.platform+'/'+j.source;
  if(!perBoard.has(board))perBoard.set(board,[]);
  perBoard.get(board).push(j);
  if(!j.id||!j.title||!j.url||!j.company)issue('missing_core_field',j);
  if(known.has(j.id))issue('duplicate_id',j);known.add(j.id);
  if(!permitted(j))issue('invalid_official_url',j,{url:j.url});
  if(!j.titleZh||j.titleZh==='职位名称待翻译'||!/[\u3400-\u9fff]/.test(j.titleZh))issue('not_translated',j);
  if(j.locationZh?.includes('新加坡 · 新加坡'))issue('duplicate_city',j);
 }
 const cache=new Map();
 for(const [platform,slug]of SOURCE){
  const key=platform+'/'+slug;const data=await request(urlOf(platform,slug));
  if(!data.body){boards[key]={error:data.error};issue('source_board_unreachable',{source:slug,platform},{error:data.error});continue;}
  const original=Array.isArray(data.body)?data.body:data.body.jobs||[];
  const mapped=original.map(row=>({meta:normalized(platform,slug,row),raw:row})).filter(x=>x.meta);
  const map=new Map(mapped.map(x=>[x.meta.id,x]));cache.set(key,map);
  const listing=perBoard.get(key)||[];
  boards[key]={official:mapped.length,hhba:listing.length};
  const local=new Set(listing.map(x=>x.id));
  for(const value of mapped)if(!local.has(value.meta.id))issue('missing_from_HHBA',{id:value.meta.id,source:slug,platform},{title:value.meta.title.slice(0,100)});
 }
 let checked=0,readable=0,missing=0,tooLong=0,mismatch=0;
 const metrics={greenhouse:{},ashby:{},lever:{}};
 const candidate=items.filter(j=>cache.has(j.platform+'/'+j.source));
 for(const j of candidate){
  const map=cache.get(j.platform+'/'+j.source);
  const recorded=map.get(j.id);checked++;
  const meter=metrics[j.platform];meter.checked=(meter.checked||0)+1;
  if(!recorded){missing++;issue('job_removed_or_id_mismatch',j);continue;}
  let orig=recorded.raw;
  if(j.platform==='greenhouse'){
   const full=await request(urlOf(j.platform,j.source)+'/'+encodeURIComponent(recorded.meta.nativeId)+'?content=true');
   if(!full.body){missing++;issue('source_detail_unreachable',j,{error:full.error});continue;}
   orig=full.body;
   if(checked%25===0)await sleep(500);
  }
  const verified=normalized(j.platform,j.source,orig);
  if(!verified||verified.id!==j.id||verified.title!==j.title||verified.url!==j.url){
   mismatch++;issue('source_identity_mismatch',j,{officialTitle:verified?.title||null,officialUrl:verified?.url||null});continue;
  }
  const body=bodyText(j.platform,orig);
  if(!body){missing++;issue('empty_official_jd',j);continue;}
  readable++;meter.readable=(meter.readable||0)+1;
  if(body.length>30000){tooLong++;issue('jd_exceeds_reader_limit',j,{characters:body.length})}
  if(body.length<120)issue('suspiciously_short_jd',j,{characters:body.length});
 }
 let pageOK=0,pageBad=0;
 for(const platform of ['greenhouse','ashby','lever']){
  for(const j of candidate.filter(x=>x.platform===platform).slice(0,3)){
   try{
    const resp=await fetch(SITE+'/jobs/'+encodeURIComponent(j.id),{signal:AbortSignal.timeout(22000)});
    const html=await resp.text();
    if(resp.ok&&html.includes('id="jd-zh"')&&html.includes('id="jd-en"')&&
      html.includes('id="personal-reader"')&&html.includes('data-job="'+j.id+'"'))pageOK++;
    else {pageBad++;issue('public_page_missing_reader',j,{status:resp.status})}
   }catch(err){pageBad++;issue('public_page_error',j,{error:err.name})}
  }
 }
 const kinds={};
 for(const x of problems)kinds[x.kind]=(kinds[x.kind]||0)+1;
 const summary={
  total:items.length,sourceBoards:SOURCE.length,verifiedBoards:cache.size,
  uniqueIds:known.size,sourceDetailsChecked:checked,sourceJdsReadable:readable,
  sourceJdsUnavailable:missing,sourceJdsOverReaderLimit:tooLong,
  identityMismatches:mismatch,publicPagesGood:pageOK,publicPagesBad:pageBad,
  titleTranslationModes:items.reduce((m,j)=>(m[j.titleStatus]=(m[j.titleStatus]||0)+1,m),{}),
  issueTypes:kinds,metrics,finished:new Date().toISOString()
 };
 await mkdir('audit-output',{recursive:true});
 await writeFile('audit-output/all-jobs.json',JSON.stringify({summary,boards,problems},null,2));
 const table=Object.entries(kinds).sort((a,b)=>b[1]-a[1]).map(([key,num])=>'| '+key+' | '+num+' |').join('\n');
 await writeFile('audit-output/report.md','# HHBA full jobs audit\n\n'+
  'Date: '+summary.finished+'\n\n## Summary\n\n'+
  '~~~json\n'+JSON.stringify(summary,null,2)+'\n~~~\n\n## Issue categories\n\n'+
  '| Issue | Count |\n|---|---:|\n'+table+'\n\n'+
  'Individual posting IDs and failure reasons in all-jobs.json.\n'+
  'This audit checks original ATS JD availability, not 1,279 complete Chinese translations.\n');
 console.log('HHBA_FULL_AUDIT_SUMMARY',JSON.stringify(summary));
 console.log('HHBA_FULL_AUDIT_BOARDS',JSON.stringify(boards));
 if(mismatch||pageBad||cache.size!==SOURCE.length)process.exitCode=1;
}
main().catch(err=>{console.error('HHBA_FULL_AUDIT_FATAL',err.message);process.exitCode=1});
