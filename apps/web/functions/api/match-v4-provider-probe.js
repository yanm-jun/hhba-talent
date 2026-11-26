// Operator-only synthetic probe. Disabled unless a short-lived encrypted operator token is installed.
// No user input, resume data, response text, credential, or redirect is returned.
import {v4ParseJson,v4ToolSources,v4Provider,v4Call} from '../_lib/simple-match-v4.js';
import {v4ReadEmployerJob,v4PublicJobUrl,v4EmployerAuthorization} from '../_lib/v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from '../_lib/match-employer-source.js';
import {batchScoringPayload,collectBatchAssessments} from '../_lib/v4-batch-scoring.js';
import {validateCuratedReport,validateGlobalOrder} from '../_lib/v4-curated-reports.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}});
const equal=async(a,b)=>{
 const encode=s=>new TextEncoder().encode(s);
 const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encode(a)),crypto.subtle.digest('SHA-256',encode(b))]);
 return new Uint8Array(x).reduce((n,v,i)=>n|(v^new Uint8Array(y)[i]),0)===0;
};
const RESUME='Synthetic candidate: 三年零售门店运营经验，负责销售培训、客户服务及区域经营数据分析。具备基础英语沟通能力。';
const basicPayload={instructions:'Return only JSON.',input:'Return the exact JSON object {"ok":true}.'};
const searchPayload={instructions:'Use actual web_search to find several currently published direct employer job details in mainland China, retail operations or automotive channel operations in Shanghai. Return JSON only {jobs:[{company,title,location,url,employer_proof_url,employer_proof_urls}]}. Use original employer titles and direct job URLs, not commercial boards or search redirects. Provide an official employer career link or chain of links authorizing the ATS when needed.',input:'Synthetic capability acceptance: public recruitment in Shanghai, China. No personal data.',tools:[{type:'web_search'}],tool_choice:'required'};
// Separate OpenAI smoke test, using the active Responses adapter and only
// synthetic input. A returned reasoning-token count is an observation, not
// proof that the relay applied a particular effort level.
export async function runOpenAIProbe(provider,phase,{fetcher=fetch,signal}={}){
 if(phase==='openai_token_efficiency'){
  const resume='虚构测试：负责门店日常运营，使用 Excel 汇总每周销售数据。协助培训新人。';
  const items=[{id:'a',job:{company:'虚构公司甲',title:'运营',location:'上海',full_jd:'负责销售数据汇总，熟悉 Excel。'}},{id:'b',job:{company:'虚构公司乙',title:'培训',location:'上海',full_jd:'负责新员工培训，记录培训反馈。'}}];
  const results=[];
  for(const group of [[items[0]],[items[1]],items]){
   const payload=batchScoringPayload(group,resume,'运营');
   delete payload.tools;delete payload.tool_choice;delete payload.include;
   let effort;
   const r=await v4Call((url,opts)=>{effort=JSON.parse(opts.body).reasoning?.effort;return fetcher(url,opts);},provider,payload,{signal,stage:'score'});
   const accepted=r.status==='completed'?collectBatchAssessments(v4ParseJson(r),group,resume).size:0;
   const u=r.usage,known=['input_tokens','output_tokens','total_tokens'].every(k=>Number.isSafeInteger(u?.[k])&&u[k]>=0);
   results.push({batch_size:group.length,requested_effort:effort,accepted,usage_present:known,input_tokens:known?u.input_tokens:null,output_tokens:known?u.output_tokens:null,total_tokens:known?u.total_tokens:null});
   if(effort!=='medium'||accepted!==group.length||!known)return {ok:false,results,scope:'SYNTHETIC_ONLY'};
  }
  return {ok:true,results,single_input:results[0].input_tokens+results[1].input_tokens,batch_input:results[2].input_tokens,single_total:results[0].total_tokens+results[1].total_tokens,batch_total:results[2].total_tokens,scope:'SYNTHETIC_ONLY_NOT_500_TO_50'};
 }
 const call=(payload,options={})=>v4Call(fetcher,{...provider,...options},payload,{signal,stage:'probe'});
 const usage=r=>({usage_present:Number.isFinite(r.usage?.total_tokens),reasoning_tokens:Number.isSafeInteger(r.usage?.output_tokens_details?.reasoning_tokens)?r.usage.output_tokens_details.reasoning_tokens:null});
 if(phase==='openai_basic'||phase==='openai_reasoning'){
  const reasoning=phase==='openai_reasoning';
  const r=await call(reasoning?{instructions:'Return only JSON with the exact integer answer; do not include reasoning text.',input:'A fictional store has 17 boxes, each with 13 items. It sells 38 items and receives 7. Return {"answer":integer} for the resulting stock.'}:basicPayload,reasoning?{reasoningEffort:'high'}:{});
  const data=v4ParseJson(r);
  return {ok:r.status==='completed'&&(reasoning?data.answer===190:data.ok===true),requested_effort:reasoning?'high':provider.reasoningEffort||'provider_default',...usage(r)};
 }
 const payload={...searchPayload,instructions:searchPayload.instructions,include:['web_search_call.action.sources']};
 const r=await call(payload),data=v4ParseJson(r),sources=v4ToolSources(r);
 const jobs=[...new Map((Array.isArray(data.jobs)?data.jobs:[]).filter(j=>v4PublicJobUrl(j?.url)&&!isCommercialRecruitmentBoard(j.url,j)).map(j=>[v4PublicJobUrl(j.url),j])).values()];
 const grounded=r.status==='completed'&&r.output.some(x=>x?.type==='web_search_call')&&sources.length>0;
 if(phase==='openai_search')return {ok:grounded&&jobs.length>0,grounded,grounding_count:sources.length,job_count:jobs.length,...usage(r)};
 // Reuse the same official JD, evidence scoring and comparison validations.
 // Do not infer the full production pipeline works from a single answer.
 let verified=0,scored=0;const assessments=[];
 if(grounded)for(const j of jobs){
  let jd;
  try{
   jd=await v4ReadEmployerJob(j.url,{fetcher,signal,expected:j});
   if(!jd.source_confirmed){const auth=Array.isArray(j.employer_proof_urls)&&j.employer_proof_urls.length?j.employer_proof_urls:j.employer_proof_url;if(auth)jd.source_confirmed=await v4EmployerAuthorization(jd.canonical_url,jd.company,auth,{fetcher,signal});}
   if(!jd.independently_read||!jd.source_confirmed||!jd.full_jd||!jd.canonical_url||assessments.some(a=>a.official_url===jd.canonical_url))continue;
  }catch(e){if(signal?.aborted)throw e;continue;}
  verified++;
  const response=await call({instructions:'Compare the synthetic resume against the actual independently read JD; output JSON {suitable,score,reason,resume_quote,jd_quote,comparisons:[{status,jd_quote,resume_quote,analysis}],strengths,risks,career_development,optimization_advice,competition}. Cite exact continuous quotes. Never invent evidence.',input:JSON.stringify({resume:RESUME,job:{company:jd.company,title:jd.title,location:jd.location,full_jd:jd.full_jd}})});
  const value=v4ParseJson(response),report=validateCuratedReport(value,RESUME,jd.full_jd);
  if(response.status==='completed'&&report.ok){scored++;assessments.push({official_url:jd.canonical_url,company:jd.company,title:jd.title,location:jd.location,match_score:value.score,research_detail:report.report});}
  if(scored>=2)break;
 }
 let order=null;
 if(scored>=2){
  const response=await call({instructions:'Return JSON {ordered_urls:[all original URLs in suitability order, each exactly once]} based on the synthetic resume and evidence reports. Do not invent or omit URLs.',input:JSON.stringify({resume:RESUME,candidates:assessments})});
  if(response.status==='completed')order=validateGlobalOrder(v4ParseJson(response),assessments);
 }
 return {ok:grounded&&scored>=2&&!!order,grounded,grounding_count:sources.length,job_count:jobs.length,verified_count:verified,scored_count:scored,ranked_count:order?.length||0};
}
export async function onRequest({request,env}){
 const raw=env.HHBA_V4_OPENAI_PROBE_SECRET||'';
 const [expiry,token]=raw.split(':');
 if(request.method!=='GET'||!token||token.length<48||!Number.isFinite(Number(expiry))||Date.now()>Number(expiry)||!await equal(request.headers.get('X-HHBA-Probe')||'',token))return reply({error:'NOT_FOUND'},404);
 const phase=new URL(request.url).searchParams.get('phase')||'openai_basic';
 if(!['openai_basic','openai_reasoning','openai_search','openai_pipeline','openai_token_efficiency'].includes(phase))return reply({error:'INVALID_PROBE_PHASE'},400);
 const provider=v4Provider(env);
 if(!provider)return reply({ok:false,error:'AI_PROVIDER_NOT_CONFIGURED',phase},503);
 const start=Date.now();
 try{
  const result=await runOpenAIProbe(provider,phase,{signal:request.signal});
  return reply({...result,phase,model:provider.model,elapsed_ms:Date.now()-start});
 }catch(e){
  // The operator probe completed even when the upstream model failed.
  // Keep its sanitized JSON visible instead of triggering an edge 502 HTML
  // error page. The logical ok flag is the acceptance gate, never HTTP 200.
  return reply({ok:false,phase,error:typeof e?.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'PROBE_FAILED',upstream_http_status:Number.isInteger(e?.upstreamStatus)?e.upstreamStatus:null,elapsed_ms:Date.now()-start});
 }
}
