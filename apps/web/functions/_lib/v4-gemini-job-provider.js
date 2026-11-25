// Server-only native Gemini GenerateContent adapter for V4 job research.
// Existing V4 response consumers retain their evidence and parsing contract.
const fault=(code,upstreamStatus)=>Object.assign(new Error(code),{code,...(Number.isInteger(upstreamStatus)?{upstreamStatus}:{})});
const DEFAULT_BASE='https://api-c.reqtoken.com';
export function geminiJobProvider(env={}){
 const key=env.GEMINI_API_KEY?.trim(),model=env.GEMINI_MODEL?.trim(),authMode=env.GEMINI_AUTH_MODE?.trim()||'native';
 if(!['native','bearer'].includes(authMode))return null;
 if(!key||!model||!/^[-a-zA-Z0-9_.]+$/.test(model))return null;
 try{
  const u=new URL(env.GOOGLE_GEMINI_BASE_URL||DEFAULT_BASE);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)return null;
  const baseUrl=u.href.replace(/\/+$/,'').replace(/\/v1beta$/,'');
  return {kind:'gemini',key,model,baseUrl,...(authMode==='bearer'?{authMode}:{}),...(env.GEMINI_STREAM==='1'?{stream:true}:{}),...(env.GEMINI_URL_CONTEXT==='1'?{urlContext:true}:{})};
 }catch{return null;}
}
// Both schemes use only the separately configured Gemini credential at the
// operator-selected Gemini endpoint. Never try another provider or key.
export function geminiRequestHeaders(provider,accept='application/json'){
 return {...(provider.authMode==='bearer'?{authorization:'Bearer '+provider.key}:{'x-goog-api-key':provider.key}),'content-type':'application/json',accept};
}
export function logV4Usage(provider,usage,elapsed,status){
 const number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
 // Never log prompts, queries, URLs, user identifiers, keys or response text.
 console.info('HHBA_V4_MODEL_USAGE',JSON.stringify({provider:provider.kind==='gemini'?'gemini':'openai',model:provider.model,status,elapsed_ms:elapsed,
  input_tokens:number(usage?.input_tokens),output_tokens:number(usage?.output_tokens),total_tokens:number(usage?.total_tokens),reasoning_tokens:number(usage?.output_tokens_details?.reasoning_tokens),cached_tokens:number(usage?.input_tokens_details?.cached_tokens)}));
}
// Parse native SSE without exposing thought parts or inventing tool progress.
export async function readGeminiResponse(response,{signal,onEvent}={}){
 if(!(response.headers.get('content-type')||'').includes('text/event-stream'))return response.json();
 if(!response.body)throw fault('AI_PROVIDER_RESPONSE_INVALID');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',usageMetadata,candidate={content:{parts:[]}},groundingMetadata={},urlContextMetadata={},seen=false,grounded=false;
 const uniq=(a,b)=>[...new Map([...a,...b].map(x=>[JSON.stringify(x),x])).values()];
 function frame(raw){
  const data=raw.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(!data||data==='[DONE]')return;
  let value;try{value=JSON.parse(data)}catch{throw fault('AI_PROVIDER_RESPONSE_INVALID')}
  if(value.error)throw fault('AI_PROVIDER_UPSTREAM_ERROR');
  if(value.usageMetadata)usageMetadata=value.usageMetadata;
  const c=value.candidates?.find(x=>(x.index??0)===0);
  if(!c)return;
  seen=true;
  for(const p of c.content?.parts||[])if(!p.thought&&typeof p.text==='string'){
   candidate.content.parts.push({text:p.text});
   try{onEvent?.('response.output_text.delta')}catch{}
  }
  if(c.finishReason)candidate.finishReason=c.finishReason;
  if(c.groundingMetadata){
   const g=c.groundingMetadata;
   groundingMetadata={...groundingMetadata,...g,webSearchQueries:uniq(groundingMetadata.webSearchQueries||[],g.webSearchQueries||[]),groundingChunks:uniq(groundingMetadata.groundingChunks||[],g.groundingChunks||[])};
   if(!grounded&&(groundingMetadata.webSearchQueries.length||groundingMetadata.groundingChunks.length)){grounded=true;try{onEvent?.('response.web_search_call.completed')}catch{}}
  }
  if(c.urlContextMetadata)urlContextMetadata={...urlContextMetadata,urlMetadata:uniq(urlContextMetadata.urlMetadata||[],c.urlContextMetadata.urlMetadata||[])};
 }
 try{
  for(;;){
   if(signal?.aborted)throw fault('AI_AGENT_CANCELLED');
   const chunk=await reader.read();if(chunk.done)break;
   buffer+=decoder.decode(chunk.value,{stream:true});let m;
   while((m=/\r?\n\r?\n/.exec(buffer))){frame(buffer.slice(0,m.index));buffer=buffer.slice(m.index+m[0].length);}
  }
  buffer+=decoder.decode();if(buffer.trim())frame(buffer);
 }catch(e){if(signal?.aborted||e?.code==='AI_AGENT_CANCELLED')throw fault('AI_AGENT_CANCELLED');if(!seen)throw fault(e?.code||'AI_PROVIDER_NETWORK_ERROR');candidate.finishReason='STREAM_INTERRUPTED';}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(!seen)throw fault('AI_PROVIDER_RESPONSE_INVALID');
 return {usageMetadata,candidates:[{...candidate,finishReason:candidate.finishReason||'STREAM_INTERRUPTED',groundingMetadata,urlContextMetadata}]};
}
export async function callGeminiJob(fetcher,provider,payload,{signal,onEvent}={}){
 const start=Date.now(),search=(payload.tools||[]).some(t=>t.type==='web_search');
 // URL Context is restricted to explicitly public-only job-source research, never a CV/scoring payload.
 const urlContext=provider.urlContext===true&&payload.publicUrlContext===true&&search;
 if(typeof payload.input!=='string'||(payload.instructions!=null&&typeof payload.instructions!=='string')||(payload.tools||[]).some(t=>t.type!=='web_search'))throw fault('AI_PROVIDER_REQUEST_REJECTED');
 const instructions=(payload.instructions||'')+(search?'\n仅以公开职业、行业、地点、企业关键词调用联网搜索，不得将简历个人信息写入搜索查询。返回完整JSON及实际招聘网页URL，不要将搜索引擎跳转链接当作官网。':'')+(search&&payload.tool_choice==='required'?'\n本轮必须实际使用Google Search工具检索公开来源。':'');
 const body={systemInstruction:{parts:[{text:instructions+(urlContext?'\n可自主利用 URL Context 读取公开招聘页面，结果仅作研究线索。':'')}]},contents:[{role:'user',parts:[{text:payload.input}]}],...(search?{tools:[{google_search:{}},...(urlContext?[{url_context:{}}]:[])]}:{})};
 let usage,status='AI_PROVIDER_RESPONSE_INVALID';
 try{
  if(signal?.aborted)throw fault('AI_AGENT_CANCELLED');
  // A request is not proof that the provider executed a search.
  try{onEvent?.('response.in_progress')}catch{}
  let r;
  try{r=await fetcher(provider.baseUrl+'/v1beta/models/'+encodeURIComponent(provider.model)+(provider.stream?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',redirect:'manual',headers:geminiRequestHeaders(provider,provider.stream?'text/event-stream':'application/json'),body:JSON.stringify(body),...(signal?{signal}:{})});}
  catch(e){throw fault(signal?.aborted?'AI_AGENT_CANCELLED':e?.name==='TimeoutError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');}
  if(r.status>=300&&r.status<400)throw fault('AI_PROVIDER_REDIRECT_BLOCKED');
  if(!r.ok){
   if(r.status===413)throw fault('AI_PROVIDER_CONTEXT_TOO_LARGE',r.status);
   if([401,403].includes(r.status))throw fault('AI_PROVIDER_KEY_REJECTED',r.status);
   if(r.status===402)throw fault('AI_PROVIDER_BALANCE_INSUFFICIENT',r.status);
   if(r.status===429)throw fault('AI_PROVIDER_RATE_LIMITED',r.status);
   // Distinguish real context rejection from tool incompatibility: repage
   // oversized inputs, and retain search when the relay explicitly rejects
   // the optional URL Context combination. Never retry authentication or
   // balance failures as a different model/provider.
   if([400,422].includes(r.status)){
    let error;try{error=(await r.json())?.error}catch{}
    const message=String(error?.message||'');
    if(/context window|context length|input.*too long|token count.*exceed/i.test(message))throw fault('AI_PROVIDER_CONTEXT_TOO_LARGE',r.status);
    if(urlContext&&/url[ _-]?context|urlContext/i.test(message)&&/not supported|unsupported|not available|cannot be combined|incompatible|unknown (?:field|tool)|unrecognized/i.test(message)){
     console.info('HHBA_V4_URL_CONTEXT_FALLBACK');
     return callGeminiJob(fetcher,{...provider,urlContext:false},payload,{signal,onEvent});
    }
   }
   if([400,404,405,422,501].includes(r.status)&&provider.stream){await r.body?.cancel().catch(()=>{});return callGeminiJob(fetcher,{...provider,stream:false},payload,{signal,onEvent});}
   if(r.status>=500)throw fault('AI_PROVIDER_UPSTREAM_ERROR',r.status);
   throw fault('AI_PROVIDER_REQUEST_REJECTED',r.status);
  }
  let data;try{data=await readGeminiResponse(r,{signal,onEvent})}catch(e){throw fault(e?.code||'AI_PROVIDER_RESPONSE_INVALID')}
  const m=data?.usageMetadata;usage=m?{input_tokens:m.promptTokenCount,output_tokens:m.candidatesTokenCount,total_tokens:m.totalTokenCount,output_tokens_details:{reasoning_tokens:m.thoughtsTokenCount},input_tokens_details:{cached_tokens:m.cachedContentTokenCount}}:undefined;
  const candidate=data?.candidates?.[0],ground=candidate?.groundingMetadata;
  const parts=(candidate?.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string');
  if(!parts.length&&!ground?.groundingChunks?.length&&!ground?.webSearchQueries?.length)throw fault('AI_PROVIDER_RESPONSE_INVALID');
  if(!['STOP','MAX_TOKENS','STREAM_INTERRUPTED'].includes(candidate?.finishReason))throw fault('AI_PROVIDER_RESPONSE_INVALID');
  const sources=(ground?.groundingChunks||[]).map(x=>x.web?.uri).filter(u=>typeof u==='string'&&u.startsWith('https://')).map(url=>({url}));
  const queries=[...new Set((ground?.webSearchQueries||[]).filter(q=>typeof q==='string'&&q.trim()))];
  const searched=!!(sources.length||queries.length);
  // Preserve ungrounded output as a lead, not as a successful search.
  const missingRequired=search&&payload.tool_choice==='required'&&!searched;
  const retrieved=(candidate?.urlContextMetadata?.urlMetadata||[]).filter(x=>x.urlRetrievalStatus==='URL_RETRIEVAL_STATUS_SUCCESS'&&typeof x.retrievedUrl==='string'&&x.retrievedUrl.startsWith('https://')).map(x=>({url:x.retrievedUrl}));
  if(searched)try{onEvent?.('response.web_search_call.completed')}catch{}
  const output=[...(searched?[{type:'web_search_call',action:{sources,queries}}]:[]),...(retrieved.length?[{type:'url_context_call',action:{sources:retrieved}}]:[]),{type:'message',content:[{type:'output_text',text:parts.map(p=>p.text).join(''),annotations:[...sources,...retrieved].map(s=>({type:'url_citation',url:s.url}))}]}];
  status=candidate.finishReason!=='STOP'||missingRequired?'incomplete':'completed';
  return {status,output,usage,native_stream:(r.headers.get('content-type')||'').includes('text/event-stream')};
 }catch(e){status=e?.code||'AI_PROVIDER_RESPONSE_INVALID';throw e;}
 finally{logV4Usage(provider,usage,Date.now()-start,status);}
}

// Safe capability inspection: only model metadata and a synthetic token count.
// Never create a remote cache or send private CV data during a probe.
export async function inspectGeminiContextCapabilities(fetcher,provider,{signal}={}){
 const model=provider.baseUrl+'/v1beta/models/'+encodeURIComponent(provider.model);
 const headers=geminiRequestHeaders(provider);
 const result={model_metadata:false,input_token_limit:null,output_token_limit:null,count_tokens:false,cached_content_advertised:false,metadata_http_status:null,count_tokens_http_status:null};
 const integer=x=>Number.isSafeInteger(x)&&x>0?x:null;
 try{const r=await fetcher(model,{headers,redirect:'manual',signal});result.metadata_http_status=r.status;if(r.ok){const m=await r.json();result.model_metadata=true;result.input_token_limit=integer(m.inputTokenLimit);result.output_token_limit=integer(m.outputTokenLimit);result.cached_content_advertised=(m.supportedGenerationMethods||[]).some(x=>typeof x==='string'&&/cache/i.test(x));}else await r.body?.cancel().catch(()=>{});}catch(e){if(signal?.aborted)throw e;}
 try{const r=await fetcher(model+':countTokens',{method:'POST',headers,redirect:'manual',signal,body:JSON.stringify({contents:[{role:'user',parts:[{text:'Synthetic public job search capability test.'}]}]})});result.count_tokens_http_status=r.status;if(r.ok){const m=await r.json();result.count_tokens=integer(m.totalTokens)!==null;}else await r.body?.cancel().catch(()=>{});}catch(e){if(signal?.aborted)throw e;}
 return result;
}
