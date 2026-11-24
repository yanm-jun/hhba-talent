/**
 * Synthetic-only real relay smoke test in V4 Cloudflare Pages Preview build.
 * No real candidate resumes, no credential, model text, or private URLs logged.
 */
import {v4Provider,v4Call,v4ParseJson,v4Sources} from '../functions/_lib/simple-match-v4.js';
const label='HHBA_V4_LIVE_SMOKE=';
if(!['feat/simple-resume-match-v4-20261124','fix/v4-open-job-discovery-20261124','fix/v4-direct-ai-recommend-20261124','fix/v4-autonomous-pipeline-20261124'].includes(process.env.CF_PAGES_BRANCH)){
 console.log(label+JSON.stringify({status:'SKIPPED_OTHER_BRANCH'}));process.exit(0);
}
const provider=v4Provider(process.env);
if(!provider){console.log(label+JSON.stringify({status:'MISSING_RELAY_KEY'}));process.exit(1)}
const report={status:'PARTIAL',model:provider.model,model_catalog:'NOT_TESTED',
 responses:'NOT_TESTED',web_search:'NOT_TESTED',cited_official_links:0,model_job_rows:0,format:'NOT_TESTED'};
try{
 const r=await fetch((provider.baseUrl||'https://api-c.reqtoken.com/v1')+'/models',{
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
  input:'Synthetic API diagnostic. Respond with {"ok":true}.'
 },{signal:AbortSignal.timeout(180000)});
 report.responses=v4ParseJson(d).ok===true?'JSON_OK':'JSON_UNEXPECTED';
}catch(e){report.responses=e?.code||'PROVIDER_ERROR'}
try{
 const d=await v4Call(fetch,provider,{
  instructions:'You help job seekers in China. Use web_search to find currently hiring, real employer job pages for automotive channel supervisor or dealer operations roles in China. Return ONE VALID JSON OBJECT with profile:{roles:[...]}, jobs:[{company,title,location,url,score,reason,resume_quote}]. Do not invent links. Find as many as the research actually supports; no company allowlist or numerical cap.',
  input:JSON.stringify({resume_text:'曾负责汽车经销商销售运营、销售人员培训、渠道数据分析及终端督导。',preferred_city:'上海或全国',scope:'中国大陆真实岗位'}),
  tools:[{type:'web_search'}],tool_choice:'required',
  include:['web_search_call.action.sources']
 },{signal:AbortSignal.timeout(300000)});
 report.web_search=d.output.some(x=>x?.type==='web_search_call')?'TOOL_CALLED':'TOOL_NOT_CALLED';
 report.cited_official_links=v4Sources(d).length;
 try{
  const value=v4ParseJson(d);
  report.format='JSON_OK';
  report.model_job_rows=Array.isArray(value.jobs)?value.jobs.length:0;
 }catch{report.format='JSON_INVALID'}
}catch(e){report.web_search=e?.code||'PROVIDER_ERROR'}
try{
 const streamed=await v4Call(fetch,{...provider,stream:true},{
  instructions:'Only return JSON with the boolean field ok set to true.',
  input:'Synthetic streaming capability check. No applicant data.'
 },{signal:AbortSignal.timeout(180000)});
 report.native_stream=v4ParseJson(streamed).ok===true?'FINAL_RESPONSE_OK':'UNEXPECTED';
}catch(e){report.native_stream=e?.code||'PROVIDER_ERROR'}
report.status=report.responses==='JSON_OK'&&report.web_search==='TOOL_CALLED'&&report.format==='JSON_OK'&&report.model_job_rows>0?'READY':'PARTIAL';
console.log(label+JSON.stringify(report));
if(report.status!=='READY')process.exitCode=1;
