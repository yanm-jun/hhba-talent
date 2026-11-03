// Build the public recruitment snapshot directly from employer-owned ATS feeds.
// Never make Cloudflare Pages deployment contingent on a retired Railway endpoint.
// Only publish source-validated, current official URLs; failed boards remain visible in health metadata.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {endpoint,officialLink,isTalentPool,validateBoards} from '../../../ops/jobs-indexer/catalog.mjs';

const MAX_RESPONSE_BYTES=20_000_000;
const MAX_BOARD_ROWS=5000;
const MAX_JOBS=20000;
export const MIN_SUCCESSFUL_BOARDS=8;
export const MIN_VERIFIED_JOBS=40;
const concurrency=6;
const registryUrl=new URL('../../../ops/jobs-indexer/boards.json',import.meta.url);

function clean(value,max){
 if(typeof value!=='string')return null;
 const text=value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 return text&&text.length<=max&&!/[\u0000-\u001f\u007f\ufffd]/.test(text)?text:null;
}
function recordsFor(board,payload){
 const rows=board.platform==='lever'?payload:payload?.jobs;
 if(!Array.isArray(rows)||rows.length>MAX_BOARD_ROWS)throw Error('INVALID_OFFICIAL_JOB_ARRAY');
 return rows;
}
export function normalizeOfficialJobs(board,payload,observedAt){
 const records=recordsFor(board,payload),jobs=[],ids=new Set(),urls=new Set();
 for(const raw of records){
  if(!raw||typeof raw!=='object'||raw.isListed===false)continue;
  const native=String(raw.id??'');
  if(!/^[A-Za-z0-9_-]{1,110}$/.test(native))continue;
  const title=clean(board.platform==='lever'?raw.text:raw.title,220);
  if(!title||isTalentPool(title))continue;
  const href=board.platform==='greenhouse'?raw.absolute_url:board.platform==='ashby'?raw.jobUrl:raw.hostedUrl;
  const official=officialLink(href,board);
  if(!official)continue;
  let url;
  try{
   const parsed=new URL(official);
   if(parsed.port||parsed.username||parsed.password)continue;
   parsed.hash='';
   url=parsed.href;
  }catch{continue;}
  const id=board.platform+'-'+board.slug+'-'+native;
  if(id.length>180||ids.has(id)||urls.has(url))continue;
  const location=clean(board.platform==='lever'?raw.categories?.location:
    board.platform==='greenhouse'?raw.location?.name:raw.location,170);
  const kind=typeof raw.workplaceType==='string'?raw.workplaceType.toLowerCase():null;
  const remote=typeof raw.isRemote==='boolean'?raw.isRemote:
    kind==='remote'?true:kind==='onsite'?false:null;
  ids.add(id);urls.add(url);
  jobs.push({id,company:board.company,title,location,url,platform:board.platform,
    source:board.slug,domestic:false,remote,observedAt,
    recordKind:'OFFICIAL_ATS_PUBLIC_METADATA',currentApplicationVerified:false});
 }
 // A board that returned positions without a single valid official position is not verified.
 if(records.length>0&&jobs.length===0)throw Error('NO_VALID_OFFICIAL_JOB_URLS');
 return jobs;
}

export async function fetchOfficialBoard(board,{fetchFn=fetch}={}){
 const target=endpoint(board);
 let lastError=null;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetchFn(target,{
    method:'GET',headers:{Accept:'application/json'},
    redirect:'error',signal:AbortSignal.timeout(board.slug==='andurilindustries'?35000:20000)
   });
   if(!response.ok){
    const status=response.status;
    lastError=new Error('ATS_HTTP_'+status);
    if(attempt===0&&(status===429||status>=500))continue;
    throw lastError;
   }
   const size=Number(response.headers?.get?.('content-length')||0);
   if(size>MAX_RESPONSE_BYTES)throw Error('ATS_RESPONSE_TOO_LARGE');
   const body=await response.text();
   if(body.length>MAX_RESPONSE_BYTES)throw Error('ATS_RESPONSE_TOO_LARGE');
   let payload;
   try{payload=JSON.parse(body);}catch{throw Error('ATS_INVALID_JSON');}
   return normalizeOfficialJobs(board,payload,new Date().toISOString());
  }catch(error){
   lastError=error;
   if(attempt===1||/^ATS_HTTP_4(?!29)/.test(String(error?.message||'')))break;
  }
 }
 throw lastError||new Error('ATS_UNAVAILABLE');
}

export async function buildOfficialSnapshot(boards,{fetchFn=fetch,workerCount=concurrency,now=()=>Date.now()}={}){
 validateBoards(boards);
 if(boards.length<MIN_SUCCESSFUL_BOARDS)throw Error('INSUFFICIENT_CONFIGURED_BOARDS');
 const results=new Array(boards.length);
 let next=0;
 async function worker(){
  while(next<boards.length){
   const i=next++,board=boards[i];
   try{
    const jobs=await fetchOfficialBoard(board,{fetchFn});
    results[i]={board,jobs,ok:true};
   }catch(error){
    const reason=String(error instanceof Error?error.message:'ATS_UNAVAILABLE').slice(0,90);
    results[i]={board,jobs:[],ok:false,reason};
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(Math.max(workerCount,1),8)},()=>worker()));
 const successes=results.filter(row=>row.ok);
 const failures=results.filter(row=>!row.ok).map(row=>({
  platform:row.board.platform,source:row.board.slug,reason:row.reason
 }));
 const seen=new Set(),jobs=[];
 for(const {jobs:rows} of successes)for(const job of rows){
  if(seen.has(job.id))continue;
  seen.add(job.id);
  jobs.push(job);
 }
 if(successes.length<MIN_SUCCESSFUL_BOARDS||jobs.length<MIN_VERIFIED_JOBS||jobs.length>MAX_JOBS)
  throw Error('OFFICIAL_SOURCE_COVERAGE_INSUFFICIENT boards='+successes.length+
   ' jobs='+jobs.length+' failed='+failures.length);
 const updated=new Date(now()).toISOString();
 return {jobs,total:jobs.length,limit:jobs.length,offset:0,updated,
  boards:successes.length,failures:failures.length,configured_boards:boards.length,
  source_failures:failures,
  informationalNotice:'Only current employer-owned ATS listings were indexed. Not every configured source was available. See source_failures; current application availability is unconfirmed.'};
}

async function main(){
 const registry=JSON.parse(await readFile(registryUrl,'utf8'));
 const boards=validateBoards(registry.boards);
 const snapshot=await buildOfficialSnapshot(boards);
 const dir=resolve('dist','data');
 await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'jobs.json'),JSON.stringify(snapshot),'utf8');
 console.log('HHBA_OFFICIAL_ATS_SNAPSHOT',JSON.stringify({
  jobs:snapshot.total,successful_boards:snapshot.boards,
  failed_boards:snapshot.failures,configured_boards:snapshot.configured_boards,
  updated:snapshot.updated
 }));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(error=>{console.error('HHBA_OFFICIAL_ATS_SNAPSHOT_FAILED',error.message);process.exitCode=1;});
}
