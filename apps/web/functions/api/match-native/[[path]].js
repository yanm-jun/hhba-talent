// HHBA V4 Pro single-call experience:
// resume -> DeepSeek Responses API + native web_search -> Top10 reasons and links.
// No internal job index, no ATS whitelists, no separate search/fetch passes, no self scoring.
import {sessionOfBearer,getUserByPhone} from '../../_lib/real-auth.js';
import {redactForModel} from '../../_lib/resume-match-core.js';
import {parseJobAnswer,wasWebSearched} from '../../_lib/deepseek-native-match.js';

const KIND='HHBA_NATIVE_WEB_MATCH_V1';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status)=>json({ok:false,error:code},status);
const enabled=env=>env.HHBA_MATCH_SERVICE_ENABLED==='1'&&
 typeof env.HHBA_MATCH_DEEPSEEK_KEY==='string'&&env.HHBA_MATCH_DEEPSEEK_KEY.length>=16&&
 typeof env.HHBA_PNVS_AUTH_DB?.prepare==='function';
const prompt=[
 '你是 HHBA 求职助手。自己使用 web_search 联网检索实际招聘岗位、判断适合程度、推荐并解释。',
 '只找中国大陆工作地点（不含港澳台/海外/中外混合工作），允许外资公司在华招聘。',
 '按简历目标城市、方向、经历优先搜索，也考虑合理转岗；尽量提供10条不同企业及职位；不足如实输出。',
 '必须是公开搜索得到的单个招聘职位详情/投递 HTTPS URL，不能猜链接或用列表主页代替。',
 '每条写针对简历真实项目/工作经历的简明推荐理由；岗位是否在招以实际页面为准。不泄露简历隐私。',
 '尽快完成，不要冗长说明。只返回 JSON，无 markdown：',
 '{"jobs":[{"company":"公司","title":"岗位","location":"实际工作城市","salary":"有则写薪资否则空","reason":"简历依据及匹配理由","url":"具体职位详情链接"}]}'
].join('\n');
function providerError(status){
 if(status===401||status===403)return 'AI_PROVIDER_KEY_REJECTED';
 if(status===402)return 'AI_PROVIDER_BALANCE_INSUFFICIENT';
 if(status===429)return 'AI_PROVIDER_RATE_LIMITED';
 if([400,404,422].includes(status))return 'AI_PROVIDER_REQUEST_REJECTED';
 return 'AI_PROVIDER_UNAVAILABLE';
}
async function candidateSession(env,request){
 const db=env.HHBA_PNVS_AUTH_DB;
 const session=await sessionOfBearer(db,request,Date.now());
 if(!session)return null;
 const user=await getUserByPhone(db,session.phone);
 return user?.role==='candidate'?session:null;
}
async function providerCheck(key){
 const r=await fetch('https://api.deepseek.com/user/balance',{
  method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),
  headers:{Authorization:'Bearer '+key,Accept:'application/json'}
 });
 if(!r.ok)return {error:providerError(r.status)};
 const data=await r.json();
 return data?.is_available===true?{ok:true}:{error:'AI_PROVIDER_BALANCE_INSUFFICIENT'};
}
// DeepSeek Responses emits semantic SSE rather than a single blocking JSON body.
// We listen to search progress and only trust its terminal response.completed event.
async function readProviderEvents(response,onProgress=()=>{}){
 const ct=(response.headers.get('content-type')||'').toLowerCase();
 if(!ct.includes('text/event-stream'))return await response.json();
 if(!response.body)throw Error('AI_PROVIDER_RESPONSE_INVALID');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',completed=null,receivedSearch=false;
 const eventOf=chunk=>{
  if(!chunk.trim())return;
  const lines=chunk.split('\n');
  const event=lines.find(x=>x.startsWith('event:'))?.slice(6).trim()||'';
  const raw=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
  if(!raw)return;
  let obj;try{obj=JSON.parse(raw)}catch{return}
  const type=obj.type||event;
  if(type==='response.created')onProgress('connected');
  if(type==='response.web_search_call.in_progress'||
     type==='response.web_search_call.searching'){
   receivedSearch=true;onProgress('searching');
  }
  if(type==='response.web_search_call.completed'){
   receivedSearch=true;onProgress('writing');
  }
  if(type==='response.completed')completed=obj.response;
  if(type==='response.failed'||type==='response.incomplete'){
   const e=new Error('AI_PROVIDER_INCOMPLETE');e.code=e.message;throw e;
  }
 };
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
   if(buffer.length>3_000_000)throw Error('AI_PROVIDER_RESPONSE_INVALID');
   let idx;
   while((idx=buffer.indexOf('\n\n'))>=0){
    eventOf(buffer.slice(0,idx));buffer=buffer.slice(idx+2);
   }
  }
  if(buffer.trim())eventOf(buffer);
 }finally{reader.releaseLock();}
 if(!completed){
  const err=new Error('AI_PROVIDER_RESPONSE_INVALID');err.code=err.message;throw err;
 }
 if(receivedSearch)onProgress('writing');
 return completed;
}
function nativeResponsePayload(result){
 return {
  status:'COMPLETE',
  profile:{education:null,education_evidence:null,experience_years:null,
   experience_evidence:null,skills:[],target_roles:[],warnings:[]},
  matches:result.matches,
  matched_official_jobs:result.matches.length,
  native_search:result.diagnostic,
  source:'DeepSeek V4 Pro 自主联网搜索',
  scoring:'AI 根据简历和招聘信息推荐；不代表录用概率',
  privacy:'本次授权仅向 DeepSeek 发送脱敏简历文字，不存储原始简历。',
  disclaimer:'仅中国大陆工作城市；职位开放状态、薪资、要求以原招聘网页为准。'
 };
}

export async function runNativeJobMatch(key,text,roleHint,limit=10,{fetcher=fetch,onProgress=()=>{}}={}){
 const start=Date.now();
 const body={
  model:'deepseek-v4-pro',
  reasoning:{effort:'none'},
  tools:[{type:'web_search'}],
  tool_choice:'required',
  text:{format:{type:'json_object'}},
  max_output_tokens:2600,
  stream:true,
  instructions:prompt,
  input:'请自行联网搜索真实职位，再给出推荐，不用先让我确认。\n'+
   '目标岗位补充：'+String(roleHint||'').slice(0,80)+'\n\n求职者简历（已遮盖联系方式）：\n'+text.slice(0,9000)
 };
 let response;
 try{
  response=await fetcher('https://api.deepseek.com/responses',{
   method:'POST',redirect:'manual',signal:AbortSignal.timeout(95000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(body)
  });
 }catch(e){
  const err=new Error(e?.name==='TimeoutError'||e?.name==='AbortError'?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
  err.code=err.message;throw err;
 }
 if(!response.ok){
  const err=new Error(providerError(response.status));err.code=err.message;throw err;
 }
 let data;
 try{data=await readProviderEvents(response,onProgress);}catch(e){
  if(e?.name==='TimeoutError'||e?.name==='AbortError'){
   const err=new Error('AI_PROVIDER_TIMEOUT');err.code=err.message;throw err;
  }
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_RESPONSE_INVALID';
  const err=new Error(code);err.code=code;throw err;
 }
 if(data?.status!=='completed'){
  const e=new Error('AI_PROVIDER_RESPONSE_INVALID');e.code=e.message;throw e;
 }
 if(!wasWebSearched(data)){
  const e=new Error('AI_WEB_SEARCH_NOT_USED');e.code=e.message;throw e;
 }
 let parsed;
 try{parsed=parseJobAnswer(data,limit);}catch{
  const e=new Error('AI_PROVIDER_RESPONSE_INVALID');e.code=e.message;throw e;
 }
 // Diagnostics contain counts and duration only; no resume or provider payload.
 return {matches:parsed.matches,diagnostic:{
  model:'deepseek-v4-pro',searches:Number(data.usage?.server_tool_use?.tool_search||0),
  page_reads:Number(data.usage?.server_tool_use?.tool_fetch||0),
  provider_items:parsed.received,visible_jobs:parsed.matches.length,
  discarded:parsed.rejected,elapsed_ms:Date.now()-start
 }};
}
export async function onRequest({request,env}){
 const url=new URL(request.url);
 const tail=url.pathname.slice('/api/match-native'.length).replace(/\/$/,'')||'/';
 if(tail==='/status'&&request.method==='GET')
  return json({kind:KIND,enabled:enabled(env),scope:'CN_MAINLAND_ONLY',formats:['pdf','docx']});
 if(!enabled(env))return fail('MATCH_NOT_ENABLED',503);
 if(tail==='/provider-check'&&request.method==='GET'){
  try{
   if(!(await candidateSession(env,request)))return fail('SESSION_INVALID',401);
   const result=await providerCheck(env.HHBA_MATCH_DEEPSEEK_KEY);
   return result.ok?json({ok:true,status:'READY'}):fail(result.error,502);
  }catch{return fail('AI_PROVIDER_UNAVAILABLE',502);}
 }
 if(tail!=='/resume'||request.method!=='POST')return fail('NOT_FOUND',404);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')
  return fail('ORIGIN_REQUIRED',403);
 try{if(!(await candidateSession(env,request)))return fail('SESSION_INVALID',401);}
 catch{return fail('SESSION_INVALID',401);}
 let input;
 try{
  const raw=await request.text();
  if(raw.length>65000)throw Error('too large');
  input=JSON.parse(raw);
 }catch{return fail('INVALID_RESUME_TEXT',400);}
 if(input?.consent!==true)return fail('EXPLICIT_AI_SHARING_CONSENT_REQUIRED',400);
 const options=input?.options;
 if(typeof input?.text!=='string'||input.text.length>20000||
    input.text.replace(/\s/g,'').length<30||!options||
    options.country!=='CN'||options.remote_only!==false||
    typeof options.role_hint!=='string'||options.role_hint.length>80||
    !Number.isInteger(options.limit)||options.limit<1||options.limit>10)
  return fail('INVALID_RESUME_TEXT',400);
 const redacted=redactForModel(input.text);
 if(redacted.replace(/\s/g,'').length<30)return fail('INVALID_RESUME_TEXT',400);
 // Same-origin, authorized one-shot call. No raw resume stored in HHBA database.
 const streaming=request.headers.get('Accept')?.includes('text/event-stream');
 if(streaming){
  const encoder=new TextEncoder();
  let ended=false;
  const readable=new ReadableStream({
   start(controller){
    const send=(type,data)=>{
     if(ended)return;
     try{controller.enqueue(encoder.encode('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n'))}
     catch{ended=true;}
    };
    send('progress',{stage:'preparing'});
    // The stream starts immediately; do not make ReadableStream.start await
    // the full DeepSeek model/search result before the browser can read.
    void (async()=>{
     const started=Date.now();
     let phase='preparing';
     const heartbeat=setInterval(()=>{
      if(!ended)send('progress',{stage:'waiting'});
     },12000);
     try{
      const result=await runNativeJobMatch(env.HHBA_MATCH_DEEPSEEK_KEY,redacted,
       options.role_hint,options.limit,{onProgress:stage=>{
        phase=stage;send('progress',{stage});
       }});
      console.info('HHBA_MATCH_NATIVE_RESULT',JSON.stringify(result.diagnostic));
      send('complete',nativeResponsePayload(result));
     }catch(e){
      const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
      console.warn('HHBA_MATCH_NATIVE_ERROR',JSON.stringify({
       code,phase,elapsed_ms:Date.now()-started
      }));
      send('failure',{error:code});
     }finally{
      clearInterval(heartbeat);
      if(!ended){ended=true;try{controller.close()}catch{}}
     }
    })();
   }
  });
  return new Response(readable,{status:200,headers:{
   'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private, no-store, no-transform',
   'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no',
   'Referrer-Policy':'no-referrer'
  }});
 }

 try{
  const result=await runNativeJobMatch(env.HHBA_MATCH_DEEPSEEK_KEY,redacted,
   options.role_hint,options.limit);
  console.info('HHBA_MATCH_NATIVE_RESULT',JSON.stringify(result.diagnostic));
  return json(nativeResponsePayload(result));
 }catch(e){
  const code=typeof e?.code==='string'?e.code:'AI_PROVIDER_UNAVAILABLE';
  console.warn('HHBA_MATCH_NATIVE_ERROR',code);
  return fail(code,code==='AI_PROVIDER_RATE_LIMITED'?429:502);
 }
}
