/**
 * Agent V3 relay integration smoke test, run ONLY on the isolated Pages
 * preview branch while building. Synthetic prompts, no user résumé.
 * Never print the credential, source URLs, model text, or response bodies.
 */
const BRANCH='feat/hhba-agent-v3-relay-20261124';
const BASE='https://api-c.reqtoken.com/v1';
const label='HHBA_AGENT_V3_LIVE_SMOKE=';
const key=process.env.HHBA_AGENT_RELAY_API_KEY;
const branch=process.env.CF_PAGES_BRANCH;
if(branch!==BRANCH){
 console.log(label+JSON.stringify({status:'SKIPPED_OTHER_BRANCH'}));
 process.exit(0);
}
if(!key||key.trim().length<16){
 console.log(label+JSON.stringify({status:'NOT_RUN_SECRET_MISSING'}));
 process.exit(0);
}
const model=process.env.HHBA_AGENT_MODEL||'gpt-6.2-sol';
const actor=process.env.HHBA_AGENT_ACTOR_AUTH||'';
if(!/^[A-Za-z0-9._-]{3,90}$/.test(model)||
 (actor&&!/^[A-Za-z0-9._-]{1,80}$/.test(actor))){
 console.log(label+JSON.stringify({status:'CONFIG_INVALID'}));
 process.exit(0);
}
const headers={'content-type':'application/json',accept:'application/json',
 authorization:'Bearer '+key,
 ...(actor?{'x-openai-actor-authorization':actor}:{})};
const summary={status:'PARTIAL',model,provider:'relay',
 catalog:'NOT_TESTED',responses:'NOT_TESTED',web_search:'NOT_TESTED',
 web_search_call_seen:false};
async function request(path,body,ms){
 try{
  const response=await fetch(BASE+path,{
   method:body?'POST':'GET',headers,redirect:'manual',
   ...(body?{body:JSON.stringify({model,store:false,stream:false,...body})}:{}),
   signal:AbortSignal.timeout(ms)});
  if(response.status>=300&&response.status<400)return {status:'REDIRECT_REJECTED'};
  if(!response.ok)return {status:'HTTP_'+response.status};
  const data=await response.json().catch(()=>null);
  return data&&typeof data==='object'?{status:'HTTP_200',data}:{status:'INVALID_JSON'};
 }catch(e){return {status:e?.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR'}}
}
const catalog=await request('/models',null,12000);
summary.catalog=catalog.status==='HTTP_200'&&Array.isArray(catalog.data?.data)?
 catalog.data.data.some(x=>x?.id===model)?'MODEL_LISTED':'MODEL_NOT_LISTED':
 catalog.status;
const text=await request('/responses',{
 instructions:'Return a short JSON object with exactly one property, ok, set to true.',
 input:'Anonymous API connectivity diagnostic. Return {"ok":true}.',
 text:{format:{type:'json_object'}},max_output_tokens:800
},35000);
const combined=(text.data?.output||[]).filter(x=>x?.type==='message')
 .flatMap(x=>(x.content||[]).filter(c=>c?.type==='output_text')
 .map(c=>c.text||'')).join('');
let parsed;
try{parsed=JSON.parse(combined)}catch{}
summary.responses=text.status==='HTTP_200'&&text.data?.status==='completed'&&
 parsed?.ok===true?'JSON_OK':text.status==='HTTP_200'?'RESPONSE_UNEXPECTED':text.status;
const search=await request('/responses',{
 instructions:'Use web_search to find an official public company careers site. Do not invent URLs. Keep output brief.',
 input:'Locate a public company recruitment page in mainland China. Synthetic smoke test only.',
 tools:[{type:'web_search'}],tool_choice:'required',
 include:['web_search_call.action.sources'],max_output_tokens:1000
},45000);
summary.web_search_call_seen=Array.isArray(search.data?.output)&&
 search.data.output.some(x=>x?.type==='web_search_call');
summary.web_search=search.status==='HTTP_200'?
 search.data?.status==='completed'&&summary.web_search_call_seen?
 'TOOL_CALLED':'TOOL_NOT_CONFIRMED':search.status;
summary.status=summary.responses==='JSON_OK'&&summary.web_search==='TOOL_CALLED'?
 'READY':'PARTIAL';
console.log(label+JSON.stringify(summary));
