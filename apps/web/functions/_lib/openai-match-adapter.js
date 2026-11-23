/**
 * OpenAI-backed tools for Clean Match V2.
 *
 * Only server-side HTTPS requests, no browser key exposure. Web search returns
 * URLs from OpenAI web_search source annotations, NOT URLs imagined in answer
 * text. Official vacancy bodies are fetched independently and validated by
 * clean-match-v2.js before any candidate result is displayed.
 */
import {isDirectEmployerSourceHit,isMainlandEmployerJobUrl} from './match-employer-source.js';

const API='https://api.openai.com/v1/responses';
const failure=code=>Object.assign(new Error(code),{code});
const clean=(s,n=240)=>String(s??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);

export function selectCleanMatchProvider(env){
 const requested=String(env?.HHBA_MATCH_AI_PROVIDER||'').trim().toLowerCase();
 const hasOpenAI=typeof (env?.HHBA_MATCH_OPENAI_API_KEY||env?.HHBA_AI_OPENAI_API_KEY)==='string'&&
  (env?.HHBA_MATCH_OPENAI_API_KEY||env?.HHBA_AI_OPENAI_API_KEY).trim().length>=16;
 const name=requested||(hasOpenAI?'openai':'deepseek');
 if(name==='openai'){
  const key=env?.HHBA_MATCH_OPENAI_API_KEY||env?.HHBA_AI_OPENAI_API_KEY;
  if(typeof key!=='string'||key.trim().length<16)return null;
  const model=String(env?.HHBA_MATCH_OPENAI_MODEL||env?.HHBA_AI_OPENAI_MODEL||'gpt-6.2-sol').trim();
  if(!/^[a-zA-Z0-9._-]{3,90}$/.test(model))return null;
  return {name:'openai',key,model};
 }
 if(name==='deepseek'){
  const key=env?.HHBA_MATCH_DEEPSEEK_KEY;
  return typeof key==='string'&&key.trim().length>=16?
   {name:'deepseek',key,model:'deepseek-v4-pro'}:null;
 }
 return null;
}

function providerStatus(status){
 if(status===401||status===403)return failure('AI_PROVIDER_KEY_REJECTED');
 if(status===429)return failure('AI_PROVIDER_RATE_LIMITED');
 if(status===402)return failure('AI_PROVIDER_BALANCE_INSUFFICIENT');
 if([400,404,422].includes(status))return failure('AI_PROVIDER_REQUEST_REJECTED');
 return failure('AI_PROVIDER_UPSTREAM_ERROR');
}
export async function openAIResponses(fetcher,provider,payload,ms=30000,signal){
 if(provider?.name!=='openai'||!provider.key||!provider.model)throw failure('AI_PROVIDER_NOT_CONFIGURED');
 if(signal?.aborted)throw failure('AI_MATCH_CANCELLED');
 const timeout=AbortSignal.timeout(ms);
 let response;
 try{response=await fetcher(API,{method:'POST',redirect:'manual',
  headers:{Authorization:'Bearer '+provider.key,'Content-Type':'application/json',
   Accept:'application/json'},
  signal:signal?AbortSignal.any([signal,timeout]):timeout,
  body:JSON.stringify({model:provider.model,store:false,stream:false,...payload})});}
 catch{throw failure(signal?.aborted?'AI_MATCH_CANCELLED':
  timeout.aborted?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR')}
 if(!response.ok)throw providerStatus(response.status);
 let data;
 try{data=await response.json()}catch{throw failure('AI_PROVIDER_RESPONSE_INVALID')}
 if(data?.status!=='completed'||!Array.isArray(data.output))
  throw failure('AI_PROVIDER_RESPONSE_INVALID');
 return data;
}
function outputText(data){
 return (data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>
  (x.content||[]).filter(y=>y?.type==='output_text').map(y=>y.text||'')).join('');
}
export async function openAIJson(fetcher,provider,instructions,input,ms,signal,{maxOutput=4500}={}){
 const data=await openAIResponses(fetcher,provider,{
  instructions,input:typeof input==='string'?input:JSON.stringify(input),
  text:{format:{type:'json_object'}},max_output_tokens:maxOutput
 },ms,signal);
 let raw=outputText(data).trim();
 if(raw.startsWith('```'))raw=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(raw)}catch{throw failure('AI_PROVIDER_RESPONSE_INVALID')}
}
function sourceRows(data){
 const grounded=[];
 for(const item of data?.output||[]){
  if(item?.type==='web_search_call'){
   for(const entry of item?.action?.sources||[]){
    if(entry?.url)grounded.push({url:entry.url,title:entry.title||'',source:'web_search'});
   }
   for(const entry of item?.results||[]){
    if(entry?.url)grounded.push({url:entry.url,title:entry.title||'',source:'web_search'});
   }
  }
  if(item?.type==='message')for(const block of item.content||[]){
   for(const citation of block?.annotations||[]){
    if(citation?.type==='url_citation'&&citation?.url)
     grounded.push({url:citation.url,title:citation.title||'',source:'web_search'});
   }
  }
 }
 const seen=new Set();
 return grounded.filter(x=>{
  if(typeof x.url!=='string'||x.url.length>1400||seen.has(x.url))return false;
  seen.add(x.url);return true;
 });
}
export async function openAISearch(fetcher,provider,query,ms,signal){
 // Search result URLs MUST be present in web_search tool sources/citations.
 // An AI-authored JSON list is deliberately not an authoritative source.
 const result=await openAIResponses(fetcher,provider,{
  tools:[{type:'web_search'}],tool_choice:'required',
  include:['web_search_call.action.sources'],
  max_output_tokens:1400,
  instructions:'用联网搜索寻找中国大陆企业官方招聘网站上的具体职位详情页。不得编造网址或职位。只使用网页搜索工具来源。',
  input:'搜索企业官网真实职位详情，优先单岗位 JD 页面，不要招聘聚合网站、岗位列表或国外岗位。搜索词：'+clean(query,180)
 },ms,signal);
 if(!result.output.some(x=>x?.type==='web_search_call'))
  throw failure('AI_SEARCH_RESPONSE_INVALID');
 const rows=sourceRows(result);
 return {results:rows.map(x=>({url:x.url,title:clean(x.title,160),
  site_name:(()=>{try{return new URL(x.url).hostname}catch{return ''}})(),
  summary:''}))};
}
function decodeEntities(value){
 return String(value).replace(/&(?:nbsp|ensp|emsp);/gi,' ')
  .replace(/&(?:amp);/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&#(\d+);/g,(_,code)=>{const n=Number(code);return n>31&&n<=0x10ffff?String.fromCodePoint(n):' ';})
  .replace(/&#x([\da-f]+);/gi,(_,code)=>{const n=parseInt(code,16);return n>31&&n<=0x10ffff?String.fromCodePoint(n):' ';});
}
export function officialHtmlText(html){
 const data=String(html||'').slice(0,900000);
 if(!data)return '';
 // Retain heading and block boundaries to keep JD field extraction reliable.
 const stripped=data.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
  .replace(/<!--([\s\S]*?)-->/g,' ')
  .replace(/<(?:br|hr)\b[^>]*>/gi,'\n')
  .replace(/<\/(?:h[1-6]|p|li|div|section|article|tr|td|th|ul|ol)\s*>/gi,'\n')
  .replace(/<h[1-6]\b[^>]*>/gi,'\n## ')
  .replace(/<[^>]+>/g,' ');
 return decodeEntities(stripped).split('\n').map(x=>x.replace(/\s+/g,' ').trim())
  .filter(Boolean).join('\n').slice(0,18000);
}
async function boundedResponseText(response,max=900000){
 const expected=Number(response.headers?.get('content-length')||0);
 if(expected>max)throw failure('AI_FETCH_RESPONSE_TOO_LARGE');
 if(!response.body){
  const value=await response.text();
  if(value.length>max)throw failure('AI_FETCH_RESPONSE_TOO_LARGE');
  return value;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let chars='',total=0;
 try{while(true){
  const {done,value}=await reader.read();if(done)break;
  total+=value.byteLength;
  if(total>max){await reader.cancel();throw failure('AI_FETCH_RESPONSE_TOO_LARGE')}
  chars+=decoder.decode(value,{stream:true});
 }}finally{reader.releaseLock()}
 return chars+decoder.decode();
}
function publicEmployerHost(host){
 const h=String(host||'').toLowerCase().replace(/\.$/,'');
 const labels=h.split('.');
 const tld=labels.at(-1)||'';
 if(labels.length<2||h.length>253||!/^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(h)||
  !/^[a-z]{2,24}$/.test(tld))return false;
 if(/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(h)||
  /(?:^|\.)(?:nip\.io|sslip\.io|localtest\.me|localhost\.direct)$/.test(h))
  return false;
 return true;
}
export async function openAIFetchOfficial(fetcher,url,ms,signal){
 if(typeof url!=='string'||!isMainlandEmployerJobUrl(url)||
  !isDirectEmployerSourceHit({url,source:''}))throw failure('AI_FETCH_URL_REJECTED');
 let u;
 try{u=new URL(url)}catch{throw failure('AI_FETCH_URL_REJECTED')}
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||
  !publicEmployerHost(u.hostname))
  throw failure('AI_FETCH_URL_REJECTED');
 const timeout=AbortSignal.timeout(ms);
 let response;
 try{response=await fetcher(url,{method:'GET',redirect:'manual',
  headers:{Accept:'text/html, application/xhtml+xml, text/plain, application/json'},
  signal:signal?AbortSignal.any([signal,timeout]):timeout});}
 catch{throw failure(signal?.aborted?'AI_MATCH_CANCELLED':'AI_FETCH_NETWORK_ERROR')}
 if(!response.ok)throw failure('AI_FETCH_HTTP_ERROR');
 const type=(response.headers.get('content-type')||'').toLowerCase();
 if(type&& !/(?:text\/html|text\/plain|application\/xhtml\+xml|application\/json)/.test(type))
  throw failure('AI_FETCH_CONTENT_TYPE_REJECTED');
 const raw=await boundedResponseText(response);
 return {content:type.includes('html')||raw.slice(0,800).includes('<html')?
  officialHtmlText(raw):raw.slice(0,18000)};
}
export async function openAIMatchToolCall(fetcher,provider,path,payload,ms,signal){
 if(path==='/responses'){
  const {instructions,input,max_output_tokens}=payload||{};
  const data=await openAIResponses(fetcher,provider,{
   instructions,input,max_output_tokens:max_output_tokens||4500,
   text:{format:{type:'json_object'}}
  },ms,signal);
  return data;
 }
 if(path==='/v1/tools/search')return openAISearch(fetcher,provider,payload?.query,ms,signal);
 if(path==='/v1/tools/fetch')return openAIFetchOfficial(fetcher,payload?.url,ms,signal);
 throw failure('AI_PROVIDER_REQUEST_REJECTED');
}
export async function checkOpenAIMatchProvider(provider,{fetcher=fetch,signal}={}){
 const parsed=await openAIJson(fetcher,provider,'仅返回JSON对象 {"ok":true}',
  '健康检查，返回 {"ok":true}',20000,signal,{maxOutput:300});
 if(parsed?.ok!==true)throw failure('AI_PROVIDER_RESPONSE_INVALID');
 const result=await openAISearch(fetcher,provider,
  '中国大陆 腾讯 企业招聘 职位详情 site:careers.tencent.com',30000,signal);
 return {ok:true,status:'READY',capabilities:['openai_responses_json','openai_web_search'],
  searches_returned:result.results.length,
  warning:result.results.length?'SEARCH_SOURCES_PRESENT':'SEARCH_TOOL_READY_NO_SOURCES'};
}
