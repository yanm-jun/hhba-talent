/**
 * Read-only real employer ATS verification check.
 * No candidate CVs, auth tokens, D1 or R2. These are publicly available
 * job-detail APIs; the checker emits only provider, status and JD length.
 *
 * Re-run periodically: these particular job IDs can legitimately close.
 * One active posting from each provider is sufficient for a provider PASS.
 */
import {fetchPublicAtsJd} from '../functions/_lib/public-ats-jd.js';

const samples={
 greenhouse:[
  'https://job-boards.greenhouse.io/sesai/jobs/4186798005',
  'https://job-boards.greenhouse.io/sesai/jobs/4186771005',
  'https://job-boards.greenhouse.io/generalatlantic/jobs/6177751004'
 ],
 lever:[
  'https://jobs.lever.co/neowiz/f4a35a45-377c-4d1e-a604-da7c92359e76',
  'https://jobs.lever.co/elfbeauty/2f1f98ca-cfb6-406b-9dfb-255354aeb9a2',
  'https://jobs.lever.co/elfbeauty/e9b8be89-e31f-435c-ad05-d4e86e05ff6f'
 ]
};
let failures=0;
for(const [provider,urls] of Object.entries(samples)){
 let verified=null,attempts=[];
 for(const url of urls){
  try{
   const jd=await fetchPublicAtsJd(url);
   if(!jd?.full_jd||!jd?.sections?.some(x=>x.kind==='requirements')||
     !jd.sections.some(x=>x.kind==='responsibilities')||
     jd.canonical_url!==url||jd.content_status!=='VERIFIED_SECTIONS')
     throw Error('SOURCE_MISSING_INTEGRITY_REQUIREMENTS');
   verified={provider,title:jd.title,location:jd.location,bytes:new TextEncoder().encode(jd.full_jd).length,
    sections:jd.sections.length,source:jd.canonical_url,proof:jd.proof_method};
   break;
  }catch(error){
   attempts.push({url,error:String(error?.message||'SOURCE_UNAVAILABLE').slice(0,85),
    status:error?.httpStatus||null});
  }
 }
 console.log('HHBA_LIVE_PUBLIC_JD_CHECK',JSON.stringify({provider,verified,attempts}));
 if(!verified)failures++;
}
if(failures){
 console.error('HHBA_LIVE_PUBLIC_JD_SOURCE_FAILED',failures,'of',Object.keys(samples).length);
 process.exitCode=1;
}else{
 console.log('HHBA_LIVE_PUBLIC_JD_READ_ONLY_PASS Greenhouse + Lever, private D1/R2 unchanged');
}
