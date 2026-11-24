/**
 * HHBA Agent V3 provider transport. This is a new, independent backend.
 * OpenAI official API and explicitly approved reqtoken relay are two
 * different trust zones, with completely separate server-side credentials.
 *
 * DO NOT send a user's resume to the relay until user consent and privacy
 * disclosure for that third party have been reviewed and accepted.
 */
const OFFICIAL='https://api.openai.com/v1';
const RELAY='https://api-c.reqtoken.com/v1';
const bad=(code)=>Object.assign(new Error(code),{code});
const modelName=(v)=>typeof v==='string'&&/^[A-Za-z0-9._-]{3,90}$/.test(v);
const secret=(v)=>typeof v==='string'&&v.trim().length>=16;

export const AGENT_V3_PROVIDER='HHBA_OPENAI_AGENT_V3';
export function resolveAgentProvider(env={}){
 const requested=String(env.HHBA_AGENT_PROVIDER||'openai').trim().toLowerCase();
 if(!['openai','relay'].includes(requested))return null;
 const base=requested==='relay'?RELAY:OFFICIAL;
 // The origin is set by server deployment configuration only. Arbitrary user
 // supplied URLs are not permitted, preventing credentials being exfiltrated.
 const configured=String(env.HHBA_AGENT_BASE_URL||base).replace(/\/$/,'');
 if(configured!==base)return null;
 const key=requested==='relay'?env.HHBA_AGENT_RELAY_API_KEY:
  (env.HHBA_AGENT_OPENAI_API_KEY||env.HHBA_MATCH_OPENAI_API_KEY);
 if(!secret(key))return null;
 const model=String(env.HHBA_AGENT_MODEL||'gpt-6.2-sol').trim();
 const reviewModel=String(env.HHBA_AGENT_REVIEW_MODEL||model).trim();
 if(!modelName(model)||!modelName(reviewModel))return null;
 const actor=String(env.HHBA_AGENT_ACTOR_AUTH||'').trim();
 // This nonstandard header is a relay/CLI setting, not an OpenAI feature.
 // Do not reflect arbitrary header values or accept newline injection.
 if(actor&&(requested!=='relay'||!/^[A-Za-z0-9._-]{1,80}$/.test(actor)))
  return null;
 return {name:requested,baseUrl:base,model,reviewModel,key,
  ...(actor?{actor}:{}),store:false};
}
function requestHeaders(provider){
 return {'content-type':'application/json','accept':'application/json',
  authorization:'Bearer '+provider.key,
  ...(provider.name==='relay'&&provider.actor?
   {'x-openai-actor-authorization':provider.actor}:{})};
}
function codeForHttp(status){
 if([401,403].includes(status))return 'AI_PROVIDER_KEY_REJECTED';
 if(status===429)return 'AI_PROVIDER_RATE_LIMITED';
 if(status===402)return 'AI_PROVIDER_BALANCE_INSUFFICIENT';
 if([400,404,422].includes(status))return 'AI_PROVIDER_REQUEST_REJECTED';
 if(status>=500)return 'AI_PROVIDER_UPSTREAM_ERROR';
 return 'AI_PROVIDER_HTTP_ERROR';
}
export async function agentV3Request(fetcher,provider,endpoint,{method='POST',payload,signal,timeoutMs=45000}={}){
 if(!provider||!secret(provider.key)||!['openai','relay'].includes(provider.name))
  throw bad('AI_PROVIDER_NOT_CONFIGURED');
 if(!['/responses','/models'].includes(endpoint))
  throw bad('AI_PROVIDER_REQUEST_REJECTED');
 if(signal?.aborted)throw bad('AI_AGENT_CANCELLED');
 const timeout=AbortSignal.timeout(timeoutMs);
 const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const url=provider.baseUrl+endpoint;
 let response;
 try{
  response=await fetcher(url,{method,redirect:'manual',
   headers:requestHeaders(provider),
   ...(method==='POST'?{body:JSON.stringify({
    ...payload,model:payload?.model||provider.model,
    // Enforce disable_response_storage=true even if callers provide true.
    store:false
   })}:{}),signal:combined});
 }catch{
  throw bad(signal?.aborted?'AI_AGENT_CANCELLED':
   timeout.aborted?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
 }
 // Redirects must never carry an Authorization header to a second origin.
 if(response.status>=300&&response.status<400)
  throw bad('AI_PROVIDER_UNEXPECTED_REDIRECT');
 if(!response.ok)throw bad(codeForHttp(response.status));
 let value;
 try{value=await response.json()}catch{throw bad('AI_PROVIDER_RESPONSE_INVALID')}
 if(endpoint==='/responses'&&
  (!Array.isArray(value?.output)||value?.status!=='completed'))
  throw bad('AI_PROVIDER_RESPONSE_INVALID');
 if(endpoint==='/models'&&!Array.isArray(value?.data))
  throw bad('AI_MODEL_CATALOG_UNAVAILABLE');
 return value;
}
export function agentV3OutputText(response){
 return (response?.output||[]).filter(x=>x?.type==='message')
  .flatMap(x=>(x.content||[]).filter(y=>y?.type==='output_text').map(y=>y.text||''))
  .join('\n').trim();
}
export async function agentV3Json(fetcher,provider,{instructions,input,maxTokens=5200,model,signal}){
 const data=await agentV3Request(fetcher,provider,'/responses',{
  payload:{model:model||provider.model,instructions,
   input:typeof input==='string'?input:JSON.stringify(input),
   text:{format:{type:'json_object'}},max_output_tokens:maxTokens},
  signal,timeoutMs:55000
 });
 const raw=agentV3OutputText(data);
 try{
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  return value;
 }catch{throw bad('AI_PROVIDER_RESPONSE_INVALID')}
}
export async function probeAgentV3(fetcher,provider,{signal}={}){
 const report={provider:provider.name,model:provider.model,
  protocol:'responses',models:false,json:false,web_search:false,
  status:'PARTIAL',errors:[]};
 try{
  const catalog=await agentV3Request(fetcher,provider,'/models',{
   method:'GET',timeoutMs:12000,signal
  });
  report.models=catalog.data.some(x=>x?.id===provider.model);
 }catch(e){report.errors.push({stage:'models',code:e.code||'AI_MODEL_CATALOG_UNAVAILABLE'})}
 try{
  const value=await agentV3Json(fetcher,provider,{
   instructions:'只返回 JSON 对象 {"ok":true}。',
   input:'测试 Responses JSON 接口。',maxTokens:160,signal
  });
  report.json=value.ok===true;
 }catch(e){report.errors.push({stage:'responses',code:e.code||'AI_PROVIDER_UNAVAILABLE'})}
 try{
  const result=await agentV3Request(fetcher,provider,'/responses',{signal,timeoutMs:30000,
   payload:{instructions:'用 web_search 工具检索招聘信息。回答简短。',
    input:'搜索一家中国大陆企业官网招聘页面。',
    tools:[{type:'web_search'}],tool_choice:'required',
    include:['web_search_call.action.sources'],max_output_tokens:800}
  });
  report.web_search=result.output.some(x=>x?.type==='web_search_call');
  if(!report.web_search)
   report.errors.push({stage:'web_search',code:'AI_SEARCH_TOOL_MISSING'});
 }catch(e){report.errors.push({stage:'web_search',code:e.code||'AI_SEARCH_TOOL_UNAVAILABLE'})}
 report.status=report.json&&report.web_search?'READY':'PARTIAL';
 return report;
}
