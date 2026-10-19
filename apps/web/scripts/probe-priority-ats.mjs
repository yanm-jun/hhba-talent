import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const catalog=JSON.parse(await readFile(new URL('../data/priority-ats-candidates.json',import.meta.url),'utf8'));
const allowedOrigins={
 greenhouse:new Set(['https://job-boards.greenhouse.io','https://boards.greenhouse.io','https://boards.eu.greenhouse.io']),
 ashby:new Set(['https://jobs.ashbyhq.com']),
 lever:new Set(['https://jobs.lever.co','https://jobs.eu.lever.co'])
};
const req=async(url)=>{
 const r=await fetch(url,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(27000)});
 if(!r.ok)throw Error('OFFICIAL_HTTP_'+r.status);
 if(Number(r.headers.get('content-length')||0)>24*1024*1024)throw Error('OFFICIAL_RESPONSE_TOO_LARGE');
 return r.json();
};
const listEndpoint=(platform,slug)=>{
 const enc=encodeURIComponent(slug);
 if(platform==='greenhouse')return 'https://boards-api.greenhouse.io/v1/boards/'+enc+'/jobs?content=true';
 if(platform==='lever')return 'https://api.lever.co/v0/postings/'+enc+'?mode=json';
 if(platform==='ashby')return 'https://api.ashbyhq.com/posting-api/job-board/'+enc;
 throw Error('NOT_ALLOWED_ATS');
};
const normalize= v=>String(v||'').replace(/[^a-z0-9]+/gi,'').toLowerCase();
const blocked=['starlink','notion','coinbase','airbnb','anthropic','stripe','spacex'];
async function check(candidate){
 const {platform,slug,company}=candidate;
 const base={platform,slug,company,priority:candidate.priority,checked_at:new Date().toISOString(),
  admitted:false,job_count:0,with_content:0,exact_ats_links:0,external_links:0,status:'NOT_CHECKED'};
 if(!['greenhouse','lever','ashby'].includes(platform)||!/^[A-Za-z0-9_-]{1,100}$/.test(slug))
   return {...base,status:'INVALID_CANDIDATE'};
 try{
  const boardInfo=platform==='greenhouse'?await req('https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(slug)):null;
  const actualName=String(boardInfo?.name || company).trim().slice(0,180);
  const namesMatch=platform!=='greenhouse'||normalize(actualName).includes(normalize(company))||
    normalize(company).includes(normalize(actualName));
  if(!namesMatch)return {...base,status:'BOARD_OWNER_IDENTITY_MISMATCH',board_name:actualName};
  const raw=await req(listEndpoint(platform,slug));
  const jobs=Array.isArray(raw)?raw:Array.isArray(raw?.jobs)?raw.jobs:null;
  if(!jobs)throw Error('INVALID_OFFICIAL_JSON_ARRAY');
  const active=jobs.filter(j=>j && j.isListed!==false);
  if(active.length===0)return {...base,status:'NO_PUBLIC_JOBS',board_name:actualName};
  let exact=0,external=0,withContent=0,invalid=0,exampleId=null;
  for(const row of active){
    const id=row?.id,title=platform==='lever'?row?.text:row?.title;
    const link=platform==='greenhouse'?row?.absolute_url:platform==='lever'?row?.hostedUrl:row?.jobUrl;
    if(typeof title!=='string'||!title.trim()||id===null||id===undefined||!link){invalid++;continue}
    try{
      const u=new URL(link);
      if(u.protocol!=='https:'||u.port||u.username||u.password){invalid++;continue}
      if(allowedOrigins[platform].has(u.origin)&&u.pathname.split('/').includes(slug)){
        exact++;exampleId ||= String(id);
      }else{
        external++;
      }
    }catch{invalid++;continue}
    const jd=platform==='greenhouse'?row?.content:
      platform==='ashby'?row?.descriptionHtml:
      [row?.description,row?.descriptionPlain, ...(row?.lists||[]).map(x=>x?.content)].filter(Boolean).join(' ');
    if(typeof jd==='string' && jd.replace(/<[^>]+>/g,' ').trim().length>100)withContent++;
  }
  const admitted=exact>0 && withContent>0 && invalid===0;
  return {...base,board_name:actualName,job_count:active.length,with_content:withContent,
    exact_ats_links:exact,external_links:external,invalid_records:invalid,
    example_ats_native_id:exampleId,
    admitted,status:admitted?'ATS_BOARD_VERIFIED':'PUBLIC_BOARD_REQUIRES_URL_MAPPING_OR_CONTENT_REVIEW'};
 }catch(e){
  return {...base,status:'OFFICIAL_API_FAILED',
    error:String(e instanceof Error?e.message:'UNKNOWN_ERROR').slice(0,120)};
 }
}
const candidateResults=[];
for(const candidate of catalog.candidates){
 const result=await check(candidate);
 candidateResults.push(result);
 console.log('ATS_CANDIDATE',JSON.stringify(result));
}
const approved=candidateResults.filter(x=>x.admitted);
const report={kind:'HHBA_PRIORITY_OFFICIAL_ATS_PROBE_V1',checked_at:new Date().toISOString(),
 total_candidates:candidateResults.length,verified_boards:approved.length,
 total_official_jobs_on_verified_boards:approved.reduce((n,x)=>n+x.job_count,0),
 caveat:'Only exact ATS-hosted posting links and complete public descriptions are admitted; do not infer employer partnership or translation authorization.',
 candidates:candidateResults};
const target=resolve('dist','data');
await mkdir(target,{recursive:true});
await writeFile(resolve(target,'priority-ats-probe.json'),JSON.stringify(report,null,2)+'\n');
console.log('HHBA_PRIORITY_ATS_RESULT',JSON.stringify({tested:report.total_candidates,verified:report.verified_boards,
 jobs:report.total_official_jobs_on_verified_boards,results:candidateResults.map(x=>[x.company,x.status,x.job_count])}));
