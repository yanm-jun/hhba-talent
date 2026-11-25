// Operator-only synthetic probe. Disabled unless a short-lived encrypted operator token is installed.
// No user input, resume data, response text, credential, or redirect is returned.
import {geminiJobProvider,callGeminiJob,inspectGeminiContextCapabilities} from '../_lib/v4-gemini-job-provider.js';
import {v4ParseJson,v4ToolSources} from '../_lib/simple-match-v4.js';
import {v4ReadEmployerJob,v4PublicJobUrl,v4EmployerAuthorization} from '../_lib/v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from '../_lib/match-employer-source.js';
import {validateCuratedReport,validateGeminiGlobalOrder} from '../_lib/v4-curated-reports.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}});
const equal=async(a,b)=>{
 const encode=s=>new TextEncoder().encode(s);
 const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encode(a)),crypto.subtle.digest('SHA-256',encode(b))]);
 return new Uint8Array(x).reduce((n,v,i)=>n|(v^new Uint8Array(y)[i]),0)===0;
};
const RESUME='Synthetic candidate: 三年零售门店运营经验，负责销售培训、客户服务及区域经营数据分析。具备基础英语沟通能力。';
const basicPayload={instructions:'Return only JSON.',input:'Return the exact JSON object {"ok":true}.'};
const searchPayload={instructions:'Use actual Google Search to find several currently published direct employer job details in mainland China, retail operations or automotive channel operations in Shanghai. Return JSON only {jobs:[{company,title,location,url,employer_proof_url,employer_proof_urls}]}. Use original employer titles and direct job URLs, not commercial boards or search redirects. Provide an official employer career link or chain of links authorizing the ATS when needed.',input:'Synthetic capability acceptance: public recruitment in Shanghai, China. No personal data.',tools:[{type:'web_search'}],tool_choice:'required'};
// Independent stages keep a network timeout from obscuring a completed basic
// check. All inputs are fixed synthetic data or independently read public JDs.
export async function runGeminiProbe(provider,phase,{fetcher=fetch,signal}={}){
 const call=(payload,options={})=>callGeminiJob(fetcher,{...provider,...options},payload,{signal});
 if(phase==='basic'||phase==='stream'){
  const r=await call(basicPayload,{stream:phase==='stream'}),json=v4ParseJson(r);
  return {ok:r.status==='completed'&&json.ok===true&&(phase!=='stream'||r.native_stream===true),native_stream:r.native_stream===true,usage_present:Number.isFinite(r.usage?.total_tokens)};
 }
 if(phase==='metadata'){
  const capabilities=await inspectGeminiContextCapabilities(fetcher,provider,{signal});
  return {ok:capabilities.model_metadata&&capabilities.count_tokens,...capabilities};
 }
 if(phase==='url_context'){
  const r=await call({instructions:'Use URL Context to retrieve this public page. Return JSON only.',input:'Read https://www.google.com/about/careers/applications/ and return {"read":true} if retrieved.',tools:[{type:'web_search'}],publicUrlContext:true},{urlContext:true,stream:false});
  const retrieved=r.output.some(x=>x.type==='url_context_call'&&x.action?.sources?.length);
  return {ok:retrieved,url_context:retrieved};
 }
 if(phase==='cache'){
  // Repeated synthetic prefix measures real implicit cache hits. A miss is
  // inconclusive, not proof the model cannot cache. No private data or explicit
  // persistent remote cache is created.
  const prefix=Array.from({length:2200},(_,i)=>'Public synthetic job reference '+i+': retail channel operations, service quality, inventory planning.').join('\n');
  const one=await call({instructions:'Return only {"ok":true}.',input:prefix+'\nTest A.'},{stream:false});
  const two=await call({instructions:'Return only {"ok":true}.',input:prefix+'\nTest B.'},{stream:false});
  const counts=[one,two].map(r=>Number.isSafeInteger(r.usage?.input_tokens_details?.cached_tokens)?r.usage.input_tokens_details.cached_tokens:null);
  return {ok:counts.some(n=>n>0),cached_tokens:counts,cache_hit_observed:counts.some(n=>n>0)};
 }
 const search=await call(searchPayload,{stream:false}),data=v4ParseJson(search);
 const sources=v4ToolSources(search),jobs=[...new Map((Array.isArray(data.jobs)?data.jobs:[]).filter(j=>v4PublicJobUrl(j?.url)&&!isCommercialRecruitmentBoard(j.url,j)).map(j=>[v4PublicJobUrl(j.url),j])).values()];
 const grounded=search.status==='completed'&&sources.length>0;
 const summary={grounded,grounding_count:sources.length,job_count:jobs.length};
 if(phase==='search')return {ok:grounded&&jobs.length>0,...summary};
 if(!grounded||!jobs.length)return {ok:false,...summary,verified_count:0,scored_count:0,ranked_count:0};
 const verified=[],scored=[];
 // This small smoke fixture is not the 500-to-50 workload and does not
 // change production research limits. Need at least two real jobs for ranking.
 for(const job of jobs){
  if(signal?.aborted)throw signal.reason;
  let jd;
  try{
   jd=await v4ReadEmployerJob(job.url,{fetcher,signal,expected:job});
   if(!jd.source_confirmed){const auth=Array.isArray(job.employer_proof_urls)&&job.employer_proof_urls.length?job.employer_proof_urls:job.employer_proof_url;
    if(auth)jd.source_confirmed=await v4EmployerAuthorization(jd.canonical_url,jd.company,auth,{fetcher,signal});
   }
   if(!jd.independently_read||!jd.source_confirmed||!jd.full_jd||!jd.canonical_url||verified.some(x=>x.canonical_url===jd.canonical_url))continue;
  }catch(e){if(signal?.aborted)throw e;continue;}
  verified.push(jd);
  const result=await call({instructions:'Compare the synthetic resume to this independently read real job description. Return JSON {suitable,score,reason,resume_quote,jd_quote,comparisons:[{status,jd_quote,resume_quote,analysis}],strengths,risks,career_development,optimization_advice,competition}. Use exact continuous quotes from both source texts. No fabrication or fixed weighting. For this smoke test evaluate suitability honestly.',input:JSON.stringify({resume:RESUME,job:{company:jd.company,title:jd.title,location:jd.location,full_jd:jd.full_jd}})},{stream:false});
  const value=v4ParseJson(result),report=validateCuratedReport(value,RESUME,jd.full_jd);
  if(result.status==='completed'&&report.ok)scored.push({official_url:jd.canonical_url,company:jd.company,title:jd.title,location:jd.location,match_score:value.score,research_detail:report.report});
  if(scored.length>=2)break;
 }
 let order=null;
 if(scored.length>=2){
  const r=await call({instructions:'Independently compare the complete supplied candidate list and evidence-backed reports against the synthetic resume. Return JSON {ordered_urls:[all original URLs in best suitability order, exactly once]}. Do not invent or discard candidates.',input:JSON.stringify({resume:RESUME,candidates:scored})},{stream:false});
  if(r.status==='completed')order=validateGeminiGlobalOrder(v4ParseJson(r),scored);
 }
 return {ok:grounded&&verified.length>=2&&scored.length>=2&&!!order,...summary,verified_count:verified.length,scored_count:scored.length,ranked_count:order?.length||0};
}
export async function onRequest({request,env}){
 const raw=env.HHBA_V4_GEMINI_PROBE_SECRET||'';
 const [expiry,token]=raw.split(':');
 if(request.method!=='GET'||!token||token.length<48||!Number.isFinite(Number(expiry))||Date.now()>Number(expiry)||!await equal(request.headers.get('X-HHBA-Probe')||'',token))return reply({error:'NOT_FOUND'},404);
 const provider=geminiJobProvider(env);
 if(!provider){
  // Only reachable after the short-lived operator authentication above.
  // Report boolean validation results, never credentials or their lengths.
  const model=typeof env.GEMINI_MODEL==='string'?env.GEMINI_MODEL.trim():'';
  let endpointValid=false;
  try{const u=new URL(env.GOOGLE_GEMINI_BASE_URL||'https://api-c.reqtoken.com');endpointValid=u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{}
  return reply({ok:false,error:'AI_PROVIDER_NOT_CONFIGURED',configuration:{
   key_present:typeof env.GEMINI_API_KEY==='string'&&!!env.GEMINI_API_KEY.trim(),
   model_present:!!model,model_valid:!!model&&/^[-a-zA-Z0-9_.]+$/.test(model),
   endpoint_valid:endpointValid
  }},503);
 }
 const phase=new URL(request.url).searchParams.get('phase')||'basic';
 if(!['basic','search','pipeline','stream','url_context','metadata','cache'].includes(phase))return reply({error:'INVALID_PROBE_PHASE'},400);
 const start=Date.now();
 try{
  const result=await runGeminiProbe(provider,phase,{signal:request.signal});
  return reply({...result,phase,model:provider.model,elapsed_ms:Date.now()-start});
 }catch(e){
  // The operator probe completed even when the upstream model failed.
  // Keep its sanitized JSON visible instead of triggering an edge 502 HTML
  // error page. The logical ok flag is the acceptance gate, never HTTP 200.
  return reply({ok:false,phase,error:typeof e?.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'PROBE_FAILED',upstream_http_status:Number.isInteger(e?.upstreamStatus)?e.upstreamStatus:null,elapsed_ms:Date.now()-start});
 }
}
