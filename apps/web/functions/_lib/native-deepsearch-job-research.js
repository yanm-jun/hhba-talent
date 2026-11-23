/**
 * Opt-in DeepSeek native deep-thinking web search.
 * Search is done by the model via server tools; public URL provenance and
 * HHBA's verified-JD/score/history rules remain enforced independently.
 */
import {parseJobAnswer,outputText,safeJobDetailLink} from './deepseek-native-match.js';
import {isMainlandEmployerJobUrl} from './match-employer-source.js';
export const NATIVE_DEEPSEARCH_VERSION='HHBA_DEEPSEEK_NATIVE_DEEP_RESEARCH_TRIAL_V1';
const ENDPOINT='https://api.deepseek.com/responses';
const clean=(v,n=400)=>String(v||'').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const failure=code=>Object.assign(new Error(code),{code});
const providerError=status=>status===401||status===403?'AI_PROVIDER_KEY_REJECTED':
 status===402?'AI_PROVIDER_BALANCE_INSUFFICIENT':status===429?'AI_PROVIDER_RATE_LIMITED':
 [400,404,422].includes(status)?'AI_PROVIDER_REQUEST_REJECTED':'AI_PROVIDER_UNAVAILABLE';

export function nativeDeepSearchInstructions(limit=10){
 return [
  '你是 HHBA 求职深度研究员。你的任务是根据真实简历寻找中国大陆企业的真实具体职位，必须主动执行联网搜索并阅读招聘详情。',
  '先理解简历中的实际职业技能、工作经历和求职城市；自己探索相关岗位、相邻岗位、跨行业可迁移职位，不要只搜一个职称就结束。',
  '优先满足简历意向城市；主动拓展合理邻近城市和全国值得考虑的高匹配机会。比如简历意向上海时，先搜索上海，再考虑苏州、昆山、嘉兴、杭州、无锡、南京等长三角地区，最后全国。职位必须有真实中国大陆工作城市，不得误判销售区域为办公地点。',
  '目标至多 '+Math.min(10,Math.max(1,limit))+' 个不同岗位。找不到就少报，不许为了达到数量杜撰职位或链接。',
  '只找企业真实单岗位招聘页，优先企业自有招聘网站，不接受第三方招聘平台、大学就业网、Greenhouse、Lever 或其他国外 ATS。仅凭搜索摘要不可声称已经核实在招。',
  '多轮联网搜索、打开招聘详情，逐条寻找岗位职责、任职要求、招聘状态；若页面信息不完整，明确说明证据不足。',
  '最终每个岗位都要填写本次搜索返回的精确职位 URL。绝不拼接、猜测、创造职位 URL，也不能输出公司首页或职位列表。',
  '推荐理由需对照简历具体经历、岗位公开要求以及职位实际城市，说明优势与差距。没有 JD 依据就不能凭空评分，不虚构经历和薪资。',
  '不要把候选人姓名、手机号、电子邮箱、身份证号码、私人住址或简历原文发送到搜索词。',
  '最终只输出一个 JSON 对象，不加 Markdown 或说明文字；工具搜索和阅读由你自主完成。',
  '{"jobs":[{"company":"企业名称","title":"真实职位名称","location":"中国大陆实际工作城市","salary":"","reason":"根据真实经历与公开要求进行解释","match_score":null,"score_basis":"证据不足则说明不足之处","job_basis":"岗位职责及要求摘要，无法核实请明说","url":"搜索工具返回的具体职位HTTPS链接"}]}'
 ].join('\n');
}

/** Only completed real provider SEARCH results can authorize a displayed URL. */
export function nativeDeepSearchSources(responseOrOutput){
 const output=Array.isArray(responseOrOutput)?responseOrOutput:responseOrOutput?.output;
 const found=new Map();
 if(!Array.isArray(output))return [];
 for(const item of output){
  if(item?.type!=='web_search_call'||item.status!=='completed'||
   item.action?.type!=='search'||!Array.isArray(item.action.sources))continue;
  for(const source of item.action.sources){
   const url=safeJobDetailLink(source?.url);
   if(!url||!isMainlandEmployerJobUrl(url)||found.has(url))continue;
   found.set(url,{url,title:clean(source.title,180),site_name:clean(source.site_name,100),
    summary:clean(source.snippet,650)});
   if(found.size>=90)return [...found.values()];
  }
 }
 return [...found.values()];
}
export function groundedNativeJobAnswer(response,limit=10,observed=[]){
 const anchors=new Map(nativeDeepSearchSources(response).map(row=>[row.url,row]));
 for(const row of observed){
  const url=safeJobDetailLink(row?.url);
  if(url&&isMainlandEmployerJobUrl(url)&&!anchors.has(url))anchors.set(url,row);
 }
 let raw=outputText(response);
 const fenced=raw.match(/\x60{3}(?:json)?\s*([\s\S]*?)\x60{3}/i);
 if(fenced)raw=fenced[1];
 else if(!raw.trim().startsWith('{')){
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a>=0&&b>a)raw=raw.slice(a,b+1);
 }
 let answer;
 try{answer=JSON.parse(raw)}catch{return {matches:[],received:0,rejected:0,invalid_answer:true}}
 const candidates=parseJobAnswer({output:[{type:'message',content:[
  {type:'output_text',text:JSON.stringify(answer)}
 ]}]},limit);
 const matches=[],seen=new Set();
 for(const job of candidates.matches){
  const anchor=anchors.get(job.official_url);
  if(!anchor||seen.has(job.official_url))continue;
  seen.add(job.official_url);
  matches.push({...job,source_type:'站外招聘职位',
   source_status:'SOURCE_SEARCH_PREVIEW',
   recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE',
   recruitment_source_note:'DeepSeek 原生深度搜索来源，仍需核验岗位 JD',
   research_anchor:{url:anchor.url,title:anchor.title,
    site_name:anchor.site_name,summary:anchor.summary},
   evidence_sources:[{url:anchor.url,kind:'EMPLOYER_PAGE_CANDIDATE'}],
   match_score:null,reference_score:0,score_basis:'',
   evidence_status:'RESEARCH_PENDING'});
 }
 return {matches,received:candidates.received,
  rejected:Math.max(0,candidates.received-matches.length),invalid_answer:false};
}

/** Real provider SSE events become compact user-visible progress, not model thought text. */
export async function runNativeDeepSearchJobs(key,resume,roleHint,limit=10,options={},deps={}){
 const fetcher=deps.fetcher||fetch,onProgress=options.onProgress||(()=>{}),
  onActivity=options.onActivity||(()=>{}),onSources=options.onSources||(()=>{});
 const start=Date.now(),sources=new Map();
 let searches=0,reads=0,sourceBatches=0,completed=null,terminal='';
 const timeout=AbortSignal.timeout(155000);
 const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
 const payload={model:'deepseek-flash',reasoning:{effort:'high'},
  tools:[{type:'deepseek_web_search'},{type:'deepseek_read_url'}],
  safety_check:{level:'high'},max_output_tokens:16000,
  instructions:nativeDeepSearchInstructions(limit),
  input:'目标岗位方向（可空）：'+clean(roleHint,80)+
   '\n以下是用户授权的已脱敏简历，仅用于岗位匹配，不要把个人信息用于搜索词：\n'+
   String(resume||'').slice(0,12000),stream:true};
 onProgress('searching');
 onActivity({stage:'searching',message:'DeepSeek 原生深度思考搜索已开始，正在自主规划岗位、城市和企业来源。'});
 let response;
 try{response=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',signal,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'text/event-stream'},
  body:JSON.stringify(payload)})}
 catch{
  throw failure(options.signal?.aborted?'AI_MATCH_CANCELLED':
   signal.aborted?'AI_NATIVE_DEEPSEARCH_TIMEOUT':'AI_PROVIDER_UNAVAILABLE');
 }
 if(!response.ok)throw failure(providerError(response.status));
 if(!response.body||!(response.headers.get('content-type')||'').includes('text/event-stream'))
  throw failure('AI_PROVIDER_RESPONSE_INVALID');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',toolActivity=0;
 const consume=block=>{
  const raw=block.split('\n').filter(line=>line.startsWith('data:'))
   .map(line=>line.slice(5).trimStart()).join('\n');
  if(!raw||raw==='[DONE]')return;
  let obj;try{obj=JSON.parse(raw)}catch{return}
  if(obj.type==='response.output_item.done'){
   const item=obj.item,action=item?.action;
   if(item?.type==='web_search_call'&&item.status==='completed'){
    if(action?.type==='search'){
     searches++;
     const fresh=nativeDeepSearchSources([item]).filter(x=>!sources.has(x.url));
     for(const row of fresh)sources.set(row.url,row);
     if(fresh.length&&sourceBatches++<5)onSources([],[],fresh.map(x=>x.url));
     onProgress('searching');
     onActivity({stage:'searching',message:'DeepSeek 完成 '+searches+
      ' 轮联网检索，找到 '+sources.size+' 条国内企业岗位页线索，继续核对。'});
    }else if(['open_page','find_in_page'].includes(action?.type)){
     reads++;onProgress('reading');
     onActivity({stage:'reading',message:'DeepSeek 已执行 '+reads+' 次网页阅读或页内查找。'});
    }
   }
  }
  if(['response.web_search_call.searching','response.web_search_call.in_progress'].includes(obj.type)
   &&toolActivity++<2)onActivity({stage:'searching',message:'DeepSeek 正在自主调用原生联网工具。'});
  if(obj.type==='response.completed'){completed=obj.response;terminal='completed'}
  if(obj.type==='response.failed'||obj.type==='response.incomplete'){
   completed=obj.response;terminal=obj.type;
  }
 };
 try{
  while(true){
   let part;
   try{part=await reader.read()}
   catch{throw failure(options.signal?.aborted?'AI_MATCH_CANCELLED':
    signal.aborted?'AI_NATIVE_DEEPSEARCH_TIMEOUT':'AI_PROVIDER_STREAM_BROKEN')}
   if(part.done)break;
   buffer+=decoder.decode(part.value,{stream:true}).replace(/\r/g,'');
   if(buffer.length>95000)throw failure('AI_PROVIDER_RESPONSE_INVALID');
   const blocks=buffer.split('\n\n');buffer=blocks.pop()||'';
   for(const block of blocks)consume(block);
  }
  if(buffer.trim())consume(buffer);
 }finally{try{await reader.cancel()}catch{}try{reader.releaseLock()}catch{}}
 if(terminal!=='completed'||!completed||completed.status!=='completed')
  throw failure(terminal==='response.incomplete'?'AI_NATIVE_DEEPSEARCH_INCOMPLETE':
   'AI_NATIVE_DEEPSEARCH_FAILED');
 for(const row of nativeDeepSearchSources(completed))sources.set(row.url,row);
 const toolUse=completed.usage?.server_tool_use||{};
 if(!sources.size||!Number(toolUse.tool_search||searches))
  throw failure('AI_EMPLOYER_JOBS_NOT_FOUND');
 const parsed=groundedNativeJobAnswer(completed,limit,[...sources.values()]);
 if(parsed.invalid_answer)throw failure('AI_NATIVE_DEEPSEARCH_INVALID_ANSWER');
 onProgress('writing');
 onActivity({stage:'writing',message:'深度搜索已结束，发现 '+sources.size+' 个国内企业职位页线索；'+
  parsed.matches.length+' 个通过职位来源比对，正在核验 JD 与匹配依据。'});
 return {matches:parsed.matches,incomplete:parsed.matches.length<limit,
  diagnostic:{mode:NATIVE_DEEPSEARCH_VERSION,model:'deepseek-flash',
   searches:Number(toolUse.tool_search||searches),page_reads:Number(toolUse.tool_fetch||reads),
   provider_items:sources.size,candidate_links:sources.size,visible_jobs:parsed.matches.length,
   discarded:parsed.rejected,elapsed_ms:Date.now()-start,
   native_search_calls:searches,native_read_calls:reads,third_party_results_shown:0}};
}
