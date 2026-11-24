/**
 * Synthetic-only real relay smoke test in V4 Cloudflare Pages Preview build.
 * No real candidate resumes, no credential, model text, or private URLs logged.
 */
import {v4Provider,v4Call,v4ParseJson,v4Sources} from '../functions/_lib/simple-match-v4.js';
const label='HHBA_V4_LIVE_SMOKE=';
if(!['feat/simple-resume-match-v4-20261124','fix/v4-open-job-discovery-20261124'].includes(process.env.CF_PAGES_BRANCH)){
 console.log(label+JSON.stringify({status:'SKIPPED_OTHER_BRANCH'}));process.exit(0);
}
const provider=v4Provider(process.env);
if(!provider){console.log(label+JSON.stringify({status:'MISSING_RELAY_KEY'}));process.exit(0)}
const report={status:'PARTIAL',model:provider.model,model_catalog:'NOT_TESTED',
 responses:'NOT_TESTED',web_search:'NOT_TESTED',cited_official_links:0};
try{
 const r=await fetch('https://api-c.reqtoken.com/v1/models',{
  headers:{authorization:'Bearer '+provider.key,
   'x-openai-actor-authorization':'local-image-extension'},
  redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(r.status===200){
  const j=await r.json();
  report.model_catalog=Array.isArray(j?.data)&&j.data.some(x=>x?.id===provider.model)?
   'MODEL_LISTED':'MODEL_NOT_LISTED';
 }else report.model_catalog='HTTP_'+r.status;
}catch{report.model_catalog='NETWORK_OR_TIMEOUT'}
try{
 const d=await v4Call(fetch,provider,{
  instructions:'Only emit a JSON object with one boolean field ok, set to true.',
  input:'Synthetic API diagnostic. Respond with {"ok":true}.',
  max_output_tokens:800
 },{timeoutMs:37000});
 report.responses=v4ParseJson(d).ok===true?'JSON_OK':'JSON_UNEXPECTED';
}catch(e){report.responses=e?.code||'PROVIDER_ERROR'}
try{
 const d=await v4Call(fetch,provider,{
  instructions:'Use web_search to find specific open job details on employer career websites across China, including automotive regional channel and dealer operations. Return the exact HTTPS job detail URL in your response. Do not invent links.',
  input:'Find currently available automotive regional channel supervisor and dealer operations openings on real company recruitment websites in mainland China. Include the exact job detail URL.',
  tools:[{type:'web_search'}],tool_choice:'required',
  include:['web_search_call.action.sources'],max_output_tokens:1500
 },{timeoutMs:50000});
 report.web_search=d.output.some(x=>x?.type==='web_search_call')?'TOOL_CALLED':'TOOL_NOT_CALLED';
 report.cited_official_links=v4Sources(d).length;
}catch(e){report.web_search=e?.code||'PROVIDER_ERROR'}
report.status=report.responses==='JSON_OK'&&report.web_search==='TOOL_CALLED'?'READY':'PARTIAL';
console.log(label+JSON.stringify(report));
