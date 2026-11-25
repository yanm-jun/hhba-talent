// Operator-only synthetic probe. Disabled unless a short-lived encrypted operator token is installed.
// No user input, resume data, response text, credential, or redirect is returned.
import {geminiJobProvider,callGeminiJob} from '../_lib/v4-gemini-job-provider.js';
import {v4ParseJson,v4ToolSources} from '../_lib/simple-match-v4.js';
import {v4ReadEmployerJob,v4PublicJobUrl} from '../_lib/v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from '../_lib/match-employer-source.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'}});
const equal=async(a,b)=>{
 const encode=s=>new TextEncoder().encode(s);
 const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encode(a)),crypto.subtle.digest('SHA-256',encode(b))]);
 return new Uint8Array(x).reduce((n,v,i)=>n|(v^new Uint8Array(y)[i]),0)===0;
};
export async function onRequest({request,env}){
 const raw=env.HHBA_V4_GEMINI_PROBE_SECRET||'';
 const [expiry,token]=raw.split(':');
 if(request.method!=='GET'||!token||token.length<48||!Number.isFinite(Number(expiry))||Date.now()>Number(expiry)||!await equal(request.headers.get('X-HHBA-Probe')||'',token))return reply({error:'NOT_FOUND'},404);
 const provider=geminiJobProvider(env);
 if(!provider)return reply({error:'AI_PROVIDER_NOT_CONFIGURED'},503);
 const signal=request.signal,start=Date.now();
 let phase='basic';
 try{
  const basic=await callGeminiJob(fetch,provider,{instructions:'Return only JSON.',input:'Return the exact JSON object {"ok":true}.'},{signal});
  if(v4ParseJson(basic).ok!==true)throw Object.assign(Error(),{code:'PROBE_JSON_INVALID'});
  phase='search';
  const result=await callGeminiJob(fetch,provider,{instructions:'Return JSON only. Use Google Search to find one currently published employer-operated recruiting job detail in mainland China, not a commercial recruitment board. Output {"jobs":[{"company":"...","title":"...","location":"...","url":"https://..."}]}. Only real direct employer URLs, no fabricated postings or Google redirect links in jobs.',input:'Synthetic test: public retail operations or automotive channel operations jobs in Shanghai, China. No personal data.',tools:[{type:'web_search'}],tool_choice:'required'},{signal});
  const sources=v4ToolSources(result),parsed=v4ParseJson(result);
  const jobs=(Array.isArray(parsed.jobs)?parsed.jobs:[]).filter(j=>v4PublicJobUrl(j?.url)&&!isCommercialRecruitmentBoard(j.url,j));
  phase='jd';
  let independentlyRead=false;
  // Probe one real public job; not a cap on ordinary matching.
  if(jobs[0])try{const jd=await v4ReadEmployerJob(jobs[0].url,{signal,expected:jobs[0]});independentlyRead=Boolean(jd?.independently_read&&jd?.full_jd);}catch{}
  return reply({ok:sources.length>0&&jobs.length>0,phase:'complete',model:provider.model,grounding_count:sources.length,job_count:jobs.length,independent_jd_read:independentlyRead,elapsed_ms:Date.now()-start});
 }catch(e){return reply({ok:false,phase,error:typeof e?.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'PROBE_FAILED'},502);}
}
