/**
 * Official OpenAI-only transport for HHBA Clean Match V2.
 * No configurable proxy, OpenAI-compatible third-party host, or DeepSeek fallback.
 * Search results must be actual web_search sources, never model-written links.
 */
const ENDPOINT='https://api.openai.com/v1/responses';
export const DEFAULT_OPENAI_MATCH_MODEL='gpt-6.2-astra';
const fail=code=>Object.assign(new Error(code),{code});
export function openAIConfig(value){
 const key=typeof value==='string'?value:value?.key;
 const model=typeof value==='string'?DEFAULT_OPENAI_MATCH_MODEL:
  value?.model||DEFAULT_OPENAI_MATCH_MODEL;
 if(typeof key!=='string'||!key.trim())throw fail('AI_PROVIDER_NOT_CONFIGURED');
 if(typeof model!=='string'||!/^[a-zA-Z0-9._-]{3,80}$/.test(model))
  throw fail('AI_PROVIDER_MODEL_INVALID');
 return {key,model};
}
export function openAIOutputText(payload){
 return (payload?.output||[]).filter(x=>x?.type==='message')
  .flatMap(x=>(x.content||[]).filter(y=>y?.type==='output_text')
   .map(y=>typeof y.text==='string'?y.text:'')).join('');
}
export async function openAIResponse(fetcher,provider,request,{signal=null,timeoutMs=40000}={}){
 const {key,model}=openAIConfig(provider);
 const timeout=AbortSignal.timeout(timeoutMs),merged=signal?
  AbortSignal.any([signal,timeout]):timeout;
 let response;
 try{
  response=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',signal:merged,
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
    Accept:'application/json'},
   body:JSON.stringify({model,store:false,stream:false,...request})});
 }catch{
  throw fail(signal?.aborted?'AI_MATCH_CANCELLED':
   timeout.aborted?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
 }
 if(response.status>=300&&response.status<400)
  throw fail('AI_PROVIDER_UNEXPECTED_REDIRECT');
 if(!response.ok){
  if([401,403].includes(response.status))throw fail('AI_PROVIDER_KEY_REJECTED');
  if(response.status===402)throw fail('AI_PROVIDER_BALANCE_INSUFFICIENT');
  if(response.status===429)throw fail('AI_PROVIDER_RATE_LIMITED');
  if([400,404,405,422].includes(response.status))
   throw fail('AI_PROVIDER_REQUEST_REJECTED');
  throw fail('AI_PROVIDER_UPSTREAM_ERROR');
 }
 let data;
 try{data=await response.json()}catch{throw fail('AI_PROVIDER_RESPONSE_INVALID')}
 if(data?.status!=='completed'||!Array.isArray(data.output))
  throw fail(data?.status==='incomplete'?'AI_PROVIDER_RESPONSE_TRUNCATED':'AI_PROVIDER_RESPONSE_INVALID');
 return data;
}
export async function openAIJson(fetcher,provider,instructions,input,ms=40000,signal=null){
 const data=await openAIResponse(fetcher,provider,{
  instructions,input:JSON.stringify(input),reasoning:{effort:'medium'},
  text:{format:{type:'json_object'}},max_output_tokens:9000
 },{signal,timeoutMs:ms});
 const raw=openAIOutputText(data).trim().replace(/^```(?:json)?\s*|\s*```$/gi,'');
 try{
  const v=JSON.parse(raw);
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error();
  return v;
 }catch{throw fail('AI_PROVIDER_RESPONSE_INVALID')}
}
export function openAISearchSources(data){
 const out=[],seen=new Set();
 const take=(source)=>{
  const url=source?.url;
  if(typeof url!=='string'||seen.has(url))return;
  let parsed;
  try{parsed=new URL(url)}catch{return}
  if(parsed.protocol!=='https:')return;
  seen.add(url);
  out.push({url,title:String(source?.title||parsed.hostname).slice(0,160),
   site_name:parsed.hostname,summary:''});
 };
 for(const item of data?.output||[]){
  if(item?.type==='web_search_call'&&item?.status==='completed'){
   for(const source of item.action?.sources||[])take(source);
  }
  if(item?.type==='message'){
   for(const block of item.content||[]){
    for(const annotation of block.annotations||[])
     if(annotation?.type==='url_citation')take(annotation);
   }
  }
 }
 return out;
}
export async function openAIEmployerSearch(fetcher,provider,query,signal){
 // Never send a résumé, phone, name or private profile to web_search.
 const request={
  instructions:'检索中国大陆企业自身招聘官网的单个社会招聘职位详情。务必实际使用联网搜索工具。不要编造网址、岗位、招聘状态。优先回答检索到的企业职位页面，不要将招聘聚合平台作为结果。',
  input:'请联网检索：'+String(query).slice(0,160),
  tools:[{type:'web_search',external_web_access:true}],
  tool_choice:'required',include:['web_search_call.action.sources'],
  reasoning:{effort:'low'},max_output_tokens:1200
 };
 let response;
 for(let attempt=0;attempt<2;attempt++){
  try{response=await openAIResponse(fetcher,provider,request,{signal,timeoutMs:45000});break}
  catch(e){
   if(attempt===1||signal?.aborted||
    !['AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_UPSTREAM_ERROR'].includes(e?.code))throw e;
   await new Promise(resolve=>setTimeout(resolve,180));
  }
 }
 if(!response.output.some(x=>x?.type==='web_search_call'&&x?.status==='completed'))
  throw fail('AI_SEARCH_RESPONSE_INVALID');
 return {results:openAISearchSources(response)};
}
export function safePublicEmployerUrl(raw){
 try{
  const u=new URL(raw),h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||
   h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||
   h.endsWith('.internal')||h.endsWith('.test')||
   /^\d+(?:\.\d+){3}$/.test(h)||h.includes(':')||
   /(?:^|\.)(?:nip\.io|sslip\.io)$/.test(h))return false;
  return true;
 }catch{return false}
}
export async function readOfficialEmployerPage(fetcher,url,signal){
 if(!safePublicEmployerUrl(url))throw fail('AI_FETCH_URL_REJECTED');
 const timeout=AbortSignal.timeout(14000),merged=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;
 for(let attempt=0;attempt<2;attempt++){
  try{response=await fetcher(url,{method:'GET',redirect:'manual',signal:merged,
   headers:{Accept:'text/html,text/plain,application/xhtml+xml;q=0.8'}})}
  catch{
   throw fail(signal?.aborted?'AI_MATCH_CANCELLED':'AI_FETCH_TIMEOUT');
  }
  if(response.ok)break;
  if(attempt===0&&[429,500,502,503,504].includes(response.status)){
   await new Promise(resolve=>setTimeout(resolve,150));
   continue;
  }
  throw fail([401,403].includes(response.status)?'AI_FETCH_ACCESS_DENIED':'AI_FETCH_UPSTREAM_ERROR');
 }
 const length=Number(response.headers?.get('content-length')||0);
 if(length>320000)throw fail('AI_FETCH_TOO_LARGE');
 const type=response.headers?.get('content-type')||'';
 if(type&&!/(?:html|text\/plain|application\/xhtml\+xml)/i.test(type))
  throw fail('AI_FETCH_UNREADABLE_JD');
 // Read a bounded amount even when Content-Length is absent.
 let text='',bytes=0;
 if(response.body?.getReader){
  const reader=response.body.getReader(),dec=new TextDecoder();
  try{
   for(;;){
    const {value,done}=await reader.read();if(done)break;
    bytes+=value.length;
    if(bytes>320000){await reader.cancel();throw fail('AI_FETCH_TOO_LARGE')}
    text+=dec.decode(value,{stream:true});
   }
   text+=dec.decode();
  }finally{reader.releaseLock()}
 }else{text=(await response.text()).slice(0,320001)}
 if(text.length>320000)throw fail('AI_FETCH_TOO_LARGE');
 const normalized=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<!--([\s\S]*?)-->/g,'')
  .replace(/<(?:h[1-6]|dt|th)\b[^>]*>/gi,'\n## ')
  .replace(/<(?:p|div|li|tr|br|section|dd|td)\b[^>]*>/gi,'\n')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
  .replace(/\r/g,'').replace(/[ \t]+/g,' ')
  .replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n')
  .trim().slice(0,18000);
 if(normalized.replace(/\s/g,'').length<100)throw fail('AI_FETCH_EMPTY_CONTENT');
 return {content:normalized};
}
