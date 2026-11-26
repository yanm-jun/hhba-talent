// Incremental parser for the discovery response's JSON job arrays.
// Each character is consumed once; a completed direct job object is decoded
// immediately, without waiting for its array, root document or SSE to finish.
// No model reasoning, arbitrary text, or personal resume fields are emitted.
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
import {candidateSummary,concreteCandidate,curatedUrl} from './v4-curated-reports.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';

const JOB_ARRAYS=new Set(['jobs','matches','recommendations','positions','job_recommendations','job_list','vacancies']);
const WRAPPERS=new Set(['result','data']);
const SPACE=/[\t\n\r ]/;
const DELIMITER=/[\t\n\r ,\]}]/;

export function createV4JobArrayParser(onObject=()=>{}){
 const stack=[];
 let started=false,finished=false,failed=false,lex=null,capture=null;
 const top=()=>stack[stack.length-1];
 const fail=()=>{failed=true;lex=null;capture=null;stack.length=0;};
 function beginValue(kind){
  const parent=top();
  if(!parent)return null;
  const valid=parent.type==='object'?parent.state==='value':['value','valueOrEnd'].includes(parent.state);
  if(!valid){fail();return null;}
  const key=parent.type==='object'?parent.key:null;
  parent.state='commaOrEnd';
  const frame=kind==='object'?{type:kind,state:'keyOrEnd',key:null,root:false,wrapper:parent.root&&WRAPPERS.has(key)}:
   {type:kind,state:'valueOrEnd',target:parent.type==='object'&&(parent.root||parent.wrapper)&&JOB_ARRAYS.has(key)};
  if(kind==='object'&&parent.type==='array'&&parent.target&&!capture)capture={frame,raw:'{'};
  return frame;
 }
 function token(kind,value){
  if(failed||finished)return;
  const frame=top();
  if(kind==='{'||kind==='['){
   if(!started){
    if(kind!=='{'){fail();return;}
    started=true;stack.push({type:'object',state:'keyOrEnd',key:null,root:true,wrapper:false});return;
   }
   const next=beginValue(kind==='{'?'object':'array');if(next)stack.push(next);return;
  }
  if(!frame){fail();return;}
  if(kind==='}'||kind===']'){
   const object=frame.type==='object';
   if((object?kind!=='}':kind!==']')||!(object?['keyOrEnd','commaOrEnd']:['valueOrEnd','commaOrEnd']).includes(frame.state)){fail();return;}
   stack.pop();
   if(capture?.frame===frame){
    const raw=capture.raw;capture=null;
    let item;try{item=JSON.parse(raw);}catch{fail();return;}
    // A callback is an observer and cannot interrupt the provider's work.
    try{onObject(item);}catch{}
   }
   if(!stack.length)finished=true;
   return;
  }
  if(kind===','){
   if(frame.state!=='commaOrEnd'){fail();return;}
   frame.state=frame.type==='object'?'key':'value';return;
  }
  if(kind===':'){
   if(frame.type!=='object'||frame.state!=='colon'){fail();return;}
   frame.state='value';return;
  }
  if(kind==='string'&&frame.type==='object'&&['key','keyOrEnd'].includes(frame.state)){
   frame.key=value;frame.state='colon';return;
  }
  if(kind==='string'||kind==='primitive'){
   if(!(frame.type==='object'?frame.state==='value':['value','valueOrEnd'].includes(frame.state))){fail();return;}
   frame.state='commaOrEnd';return;
  }
  fail();
 }
 function primitive(){
  const raw=lex.raw;lex=null;
  try{const value=JSON.parse(raw);if(value!==null&&typeof value==='object')throw Error();token('primitive',value);}catch{fail();}
 }
 return {push(chunk){
  if(typeof chunk!=='string'||failed||finished)return;
  for(const c of chunk){
   if(failed||finished)break;
   // Like the final V4 JSON decoder, permit a prefix such as a Markdown fence.
   if(!started){if(c==='{')token('{');continue;}
   if(capture)capture.raw+=c;
   if(lex?.kind==='string'){
    lex.raw+=c;
    if(lex.escaped){lex.escaped=false;continue;}
    if(c==='\\'){lex.escaped=true;continue;}
    if(c==='"'){
     const raw=lex.raw;lex=null;
     try{token('string',JSON.parse(raw));}catch{fail();}
    }
    continue;
   }
   if(lex?.kind==='primitive'){
    if(!DELIMITER.test(c)){lex.raw+=c;continue;}
    primitive();if(failed)break;
    // The delimiter belongs to the outer JSON grammar; consume it below.
   }
   if(SPACE.test(c))continue;
   if(c==='"'){lex={kind:'string',raw:'"',escaped:false};continue;}
   if('{}[],:'.includes(c)){token(c);continue;}
   if(/[-0-9tfn]/.test(c)){lex={kind:'primitive',raw:c};continue;}
   fail();
  }
 }};
}

// The only records leaving this parser are unverified candidate leads.
// Reuse the normal V4 URL / identity / commercial-board gates. Do not
// forward model scores, reasons, quotes, private prompts or raw JSON.
export function normalizeV4StreamCandidate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const url=v4PublicJobUrl(raw.official_url||raw.url||raw.job_url||raw.link||raw.apply_url||raw.application_url||raw.source_url||raw.job_link);
 if(!url||isCommercialRecruitmentBoard(url,raw))return null;
 const compact=candidateSummary(raw,curatedUrl(url));
 if(!concreteCandidate(compact))return null;
 const {preliminary_score,fit_summary,jd_quote,...candidate}=compact;
 return candidate;
}

// One observer per discovery response, with independent JSON framing for
// interleaved Responses output/content indexes and shared canonical URL
// deduplication. Final text is a reconciliation path, not a second emission.
export function createV4DiscoveryJobObserver(onCandidate){
 const seen=new Set(),channels=new Map();
 const accept=(raw,source)=>{
  const job=normalizeV4StreamCandidate(raw);
  if(!job||seen.has(job.url))return;
  seen.add(job.url);
  try{onCandidate(job,{source});}catch{}
 };
 const parseText=(text,source)=>createV4JobArrayParser(raw=>accept(raw,source)).push(text);
 return {
  event(event){
   if(event?.type==='response.output_text.delta'){
    const key=JSON.stringify([event.output_index??event.item_id??0,event.content_index??0]);
    if(!channels.has(key))channels.set(key,createV4JobArrayParser(raw=>accept(raw,'delta')));
    channels.get(key).push(event.delta);
   }else if(event?.type==='response.output_text.done'){
    parseText(event.text,'done');
   }
  },
  response(response){
   for(const item of response?.output||[]){
    if(item?.type!=='message')continue;
    for(const part of item.content||[])if(part?.type==='output_text')parseText(part.text,'terminal');
   }
  }
 };
}
