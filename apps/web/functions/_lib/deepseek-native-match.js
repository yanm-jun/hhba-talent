// DeepSeek V4 Pro native-web output adapter. No employer whitelist or custom ranker.
import {isMainlandJobLocation} from './mainland-job-location.js';
const DIRECT_JOB=/(?:job|jobs|position|career|recruit|vacanc|apply|detail|post|advertisement|talent|jobid|job_id|positionid|jobadid|jobunionid|职位|招聘)/i;
const FOREIGN_TITLES=/(?:驻外|海外岗位|境外工作|赴日|赴美|海外派驻|global remote|work abroad|overseas position)/i;
const FORBIDDEN_HOST=/(?:^|\.)(?:localhost|local|internal|example|invalid|test)$/i;
// Search snippets sometimes contain encoded numeric entities such as &#x610F;.
// Decode them as plain text, NEVER as HTML; React handles output escaping.
export function decodeSearchText(value){
 if(typeof value!=='string')return '';
 return value.replace(/&(?:#x([0-9a-f]{1,7})|#([0-9]{1,8})|(amp|lt|gt|quot|apos|nbsp));/gi,
  (whole,hex,dec,named)=>{
   if(named)return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[named.toLowerCase()]||whole;
   const cp=Number.parseInt(hex||dec,hex?16:10);
   return cp>0&&cp<=0x10ffff&&(cp<0xd800||cp>0xdfff)?
    String.fromCodePoint(cp):whole;
  });
}
const trim=(v,max)=>decodeSearchText(v).replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function safeJobDetailLink(raw){
 if(typeof raw!=='string'||raw.length>1400)return null;
 try{
  const u=new URL(raw),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||host.length<4||
   FORBIDDEN_HOST.test(host)||!host.includes('.')||
   /^(\d{1,3}\.){3}\d{1,3}$/.test(host)||/^\[/.test(host))return null;
  if(/(?:^|\.)(?:google|bing|baidu|so|sogou|zhihu|xiaohongshu|weibo|douyin|github|reddit|linkedin|indeed|glassdoor)\.(?:com|cn|org|net|io)$/i.test(host))return null;
  if([...u.searchParams.keys()].some(k=>/token|password|session|auth|redirect_uri/i.test(k)))return null;
  const path=u.pathname;
  const detail=(path.length>8&&DIRECT_JOB.test(path+' '+host))||
   [...u.searchParams.entries()].some(([k,v])=>DIRECT_JOB.test(k)&&v.length>=4);
  if(!detail||/\/(?:login|register|signup|search|list|index)(?:\/|$)/i.test(path))return null;
  return u.href;
 }catch{return null;}
}
export function outputText(response){
 if(!response||!Array.isArray(response.output))return '';
 return response.output.filter(x=>x?.type==='message').flatMap(x=>
  Array.isArray(x.content)?x.content.filter(c=>c?.type==='output_text').map(c=>c.text||''):[]
 ).join('\n').trim();
}
export function wasWebSearched(response){
 const use=response?.usage?.server_tool_use;
 return Number(use?.tool_search||0)>0 ||
  (Array.isArray(response?.output)&&response.output.some(x=>
   x?.type==='web_search_call'&&x.status==='completed'));
}
export function parseJobAnswer(response,limit=10){
 const raw=outputText(response);
 const answer=raw.replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
 let parsed;
 try{parsed=JSON.parse(answer)}catch{throw new Error('AI_RESPONSE_INVALID');}
 const rows=Array.isArray(parsed?.jobs)?parsed.jobs:[];
 const matches=[],seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object')continue;
  const company=trim(row.company,90),title=trim(row.title,110),
   location=trim(row.location,105),url=safeJobDetailLink(row.url||row.link),
   reason=trim(row.reason||row.recommendation_reason,360);
  // Location and URL are safety checks; DeepSeek decides relevance itself.
  if(!company||!title||!reason||!url||
   !isMainlandJobLocation(location)||FOREIGN_TITLES.test(title))continue;
  const key=(company+'|'+title+'|'+location).toLowerCase().replace(/\s/g,'');
  if(seen.has(key))continue;seen.add(key);
  const domain=new URL(url).hostname;
  matches.push({
   id:'native-web-'+matches.length+'-'+domain.replace(/[^a-z0-9]/ig,'-'),
   company,title,title_zh:title,location,
   official_url:url,platform:'deepseek-native-web',source:domain,
   source_type:'站外官方招聘',source_status:'MODEL_SEARCH_REPORTED',
   application_status:'NEEDS_OFFICIAL_CONFIRMATION',
   remote:false,reference_score:0,
   matched:[reason],recommendation_reason:reason,not_evidenced:[],
   needs_verification:['请在岗位原始页面核实目前是否开放申请。'],
   requirements_basis:trim(row.job_basis||'',220),
   salary:trim(row.salary,65)||null,experience_requirement:null,
   checked_at:new Date().toISOString()
  });
  if(matches.length>=Math.min(10,Math.max(1,limit)))break;
 }
 return {matches,received:rows.length,rejected:rows.length-matches.length};
}


// Only extract fully closed JSON objects from a streamed {"jobs":[...]} response.
// Reuses the exact same Mainland/HTTPS checks as the final parser.
export function partialJobMatchesFromText(text,limit=10){
 if(typeof text!=='string'||text.length>50000)return [];
 const key=text.search(/"jobs"\s*:/),array=key>=0?text.indexOf('[',key):-1;
 if(array<0)return [];
 let inString=false,escaped=false,depth=0,start=-1;
 const rows=[];
 for(let i=array+1;i<text.length;i++){
  const ch=text[i];
  if(inString){
   if(escaped)escaped=false;
   else if(ch==='\\')escaped=true;
   else if(ch==='"')inString=false;
   continue;
  }
  if(ch==='"'){inString=true;continue;}
  if(ch==='{'){if(depth===0)start=i;depth++;continue;}
  if(ch==='}'&&depth>0){
   depth--;
   if(depth===0&&start>=0){
    try{rows.push(JSON.parse(text.slice(start,i+1)))}catch{}
    start=-1;
    if(rows.length>=14)break;
   }
  }
 }
 if(!rows.length)return [];
 const synthetic={output:[{type:'message',content:[
  {type:'output_text',text:JSON.stringify({jobs:rows})}
 ]}]};
 return parseJobAnswer(synthetic,limit).matches;
}
