// Server-only native Gemini GenerateContent adapter for V4 job research.
// Existing V4 response consumers retain their evidence and parsing contract.
const fault=code=>Object.assign(new Error(code),{code});
const DEFAULT_BASE='https://api-c.reqtoken.com';
export function geminiJobProvider(env={}){
 const key=env.GEMINI_API_KEY?.trim(),model=env.GEMINI_MODEL?.trim();
 if(!key||!model||!/^[-a-zA-Z0-9_.]+$/.test(model))return null;
 try{
  const u=new URL(env.GOOGLE_GEMINI_BASE_URL||DEFAULT_BASE);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)return null;
  const baseUrl=u.href.replace(/\/+$/,'').replace(/\/v1beta$/,'');
  return {kind:'gemini',key,model,baseUrl};
 }catch{return null;}
}
export function logV4Usage(provider,usage,elapsed,status){
 const number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
 // Never log prompts, queries, URLs, user identifiers, keys or response text.
 console.info('HHBA_V4_MODEL_USAGE',JSON.stringify({provider:provider.kind==='gemini'?'gemini':'openai',model:provider.model,status,elapsed_ms:elapsed,
  input_tokens:number(usage?.input_tokens),output_tokens:number(usage?.output_tokens),total_tokens:number(usage?.total_tokens),reasoning_tokens:number(usage?.output_tokens_details?.reasoning_tokens),cached_tokens:number(usage?.input_tokens_details?.cached_tokens)}));
}
export async function callGeminiJob(fetcher,provider,payload,{signal,onEvent}={}){
 const start=Date.now(),search=(payload.tools||[]).some(t=>t.type==='web_search');
 if(typeof payload.input!=='string'||(payload.instructions!=null&&typeof payload.instructions!=='string')||(payload.tools||[]).some(t=>t.type!=='web_search'))throw fault('AI_PROVIDER_REQUEST_REJECTED');
 const instructions=(payload.instructions||'')+(search?'\n仅以公开职业、行业、地点、企业关键词调用联网搜索，不得将简历个人信息写入搜索查询。返回完整JSON及实际招聘网页URL，不要将搜索引擎跳转链接当作官网。':'')+(search&&payload.tool_choice==='required'?'\n本轮必须实际使用Google Search工具检索公开来源。':'');
 const body={systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:payload.input}]}],...(search?{tools:[{google_search:{}}]}:{})};
 let usage,status='AI_PROVIDER_RESPONSE_INVALID';
 try{
  if(signal?.aborted)throw fault('AI_AGENT_CANCELLED');
  if(search)try{onEvent?.('response.web_search_call.searching')}catch{}
  let r;
  try{r=await fetcher(provider.baseUrl+'/v1beta/models/'+encodeURIComponent(provider.model)+':generateContent',{method:'POST',redirect:'manual',headers:{'x-goog-api-key':provider.key,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body),...(signal?{signal}:{})});}
  catch(e){throw fault(signal?.aborted?'AI_AGENT_CANCELLED':e?.name==='TimeoutError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');}
  if(r.status>=300&&r.status<400)throw fault('AI_PROVIDER_REDIRECT_BLOCKED');
  if(!r.ok){
   if(r.status===413)throw fault('AI_PROVIDER_CONTEXT_TOO_LARGE');
   if([401,403].includes(r.status))throw fault('AI_PROVIDER_KEY_REJECTED');
   if(r.status===402)throw fault('AI_PROVIDER_BALANCE_INSUFFICIENT');
   if(r.status===429)throw fault('AI_PROVIDER_RATE_LIMITED');
   if(r.status>=500)throw fault('AI_PROVIDER_UPSTREAM_ERROR');
   if([400,422].includes(r.status)){
    let error;try{error=(await r.json())?.error}catch{}
    if(/context window|context length|input.*too long|token count.*exceed/i.test(error?.message||''))throw fault('AI_PROVIDER_CONTEXT_TOO_LARGE');
   }
   throw fault('AI_PROVIDER_REQUEST_REJECTED');
  }
  let data;try{data=await r.json()}catch{throw fault('AI_PROVIDER_RESPONSE_INVALID')}
  const m=data?.usageMetadata;usage=m?{input_tokens:m.promptTokenCount,output_tokens:m.candidatesTokenCount,total_tokens:m.totalTokenCount,output_tokens_details:{reasoning_tokens:m.thoughtsTokenCount},input_tokens_details:{cached_tokens:m.cachedContentTokenCount}}:undefined;
  const candidate=data?.candidates?.[0],ground=candidate?.groundingMetadata;
  const parts=(candidate?.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string');
  if(!parts.length||!['STOP','MAX_TOKENS'].includes(candidate?.finishReason))throw fault('AI_PROVIDER_RESPONSE_INVALID');
  const sources=(ground?.groundingChunks||[]).map(x=>x.web?.uri).filter(u=>typeof u==='string'&&u.startsWith('https://')).map(url=>({url}));
  const searched=!!(sources.length||ground?.webSearchQueries?.length);
  if(search&&payload.tool_choice==='required'&&!searched)throw fault('AI_PROVIDER_RESPONSE_INVALID');
  if(searched)try{onEvent?.('response.web_search_call.completed')}catch{}
  const output=[...(searched?[{type:'web_search_call',action:{sources}}]:[]),{type:'message',content:[{type:'output_text',text:parts.map(p=>p.text).join('\n'),annotations:sources.map(s=>({type:'url_citation',url:s.url}))}]}];
  status=candidate.finishReason==='MAX_TOKENS'?'incomplete':'completed';
  return {status,output,usage};
 }catch(e){status=e?.code||'AI_PROVIDER_RESPONSE_INVALID';throw e;}
 finally{logV4Usage(provider,usage,Date.now()-start,status);}
}
