import type { LiveJob } from './liveRecruitment';

export type OfficialJdBlock = {
  kind: 'heading' | 'bullet' | 'paragraph';
  text: string;
  section: 'responsibilities' | 'requirements' | 'benefits' | 'other';
};
export type OfficialJd = {
  blocks: OfficialJdBlock[];
  checkedAt: string;
  sourceUrl: string;
  roleTitle: string;
  status: 'LIVE_CONTENT';
  // Exact official sanitized plain text from the internal verified JD service.
  // Only present when browser access and source identity have been validated.
  originalText?: string;
};
const ATS_HOSTS: Record<string, readonly string[]> = {
  greenhouse: ['job-boards.greenhouse.io','boards.greenhouse.io','boards.eu.greenhouse.io'],
  ashby: ['jobs.ashbyhq.com'],
  lever: ['jobs.lever.co','jobs.eu.lever.co']
};
const MAX_HTML = 240_000;
const BRANDED_GREENHOUSE:Record<string,{host:string;path:string}>={
 stripe:{host:'stripe.com',path:'/jobs/search'},
 coinbase:{host:'www.coinbase.com',path:'/careers/positions/'},
 airbnb:{host:'careers.airbnb.com',path:'/positions/'},
 databricks:{host:'databricks.com',path:'/company/careers/open-positions/job'}
};
function sameOfficialPosting(a:string,b:string){const left=new URL(a),right=new URL(b);return left.origin===right.origin&&left.pathname===right.pathname&&left.searchParams.get('gh_jid')===right.searchParams.get('gh_jid');}

function getJobId(job: LiveJob) {
  const platform = job.platform || '';
  const slug = job.source || '';
  if(!['greenhouse','lever','ashby'].includes(platform) ||
     !/^[a-zA-Z0-9_-]{1,100}$/.test(slug) ||
     !job.id.startsWith(platform+'-'+slug+'-')) return null;
  const native = job.id.slice(platform.length+slug.length+2);
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(native))return null;
  try {
    const u = new URL(job.url);
    if(u.protocol!=='https:' || u.port || u.username || u.password)return null;
    const standard=ATS_HOSTS[platform].includes(u.hostname) && u.pathname.split('/').includes(slug);
    const branded=platform==='greenhouse'?BRANDED_GREENHOUSE[slug]:null;
    const corporate=!!branded && /^[0-9]{5,20}$/.test(native)&&u.hostname===branded.host &&
      (branded.path.endsWith('/')?u.pathname.startsWith(branded.path):u.pathname===branded.path) &&
      u.searchParams.get('gh_jid')===native;
    if(!standard&&!corporate)return null;
    return {platform,slug,native,url:u.href};
  } catch {return null}
}
function headingSection(value: string):OfficialJdBlock['section'] | null {
  const v=value.toLocaleLowerCase().trim();
  if(/responsibilit|what you.ll do|what you will do|duties|about the role|the role|岗位职责|工作职责|主要职责/.test(v))return 'responsibilities';
  if(/requirement|qualification|what we.re looking|who you are|experience|skills|technical|technology|must.have|you bring|knowledge|任职|条件|技能|专业能力|岗位要求/.test(v))return 'requirements';
  if(/benefit|compensation|salary|perks|薪资|福利|薪酬/.test(v))return 'benefits';
  return null;
}
// Parse into React text nodes. Never inject third-party HTML into the document.
export function parseOfficialBlocks(html:string): OfficialJdBlock[] {
  if(typeof html!=='string'||html.length>MAX_HTML)throw new Error('官方职位描述超过安全读取上限');
  // Some ATS boards double-encode markup: decode safely before structural parsing.
  for(let i=0;i<3 && /&(?:amp;)?lt;\s*\/?(?:p|div|ul|li|h[1-6]|section)/i.test(html);i++){
    const textarea=document.createElement('textarea');textarea.innerHTML=html;
    const decoded=textarea.value;
    if(decoded===html)break;
    html=decoded;
  }
  const doc=new DOMParser().parseFromString(html,'text/html');
  const root=doc.body;
  root.querySelectorAll('script,style,iframe,svg,noscript,form,button,img').forEach(n=>n.remove());
  const blocks:OfficialJdBlock[]=[];
  let current:OfficialJdBlock['section']='other';
  const push=(kind:OfficialJdBlock['kind'],raw:string)=>{
    const text=raw.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
    if(!text || text.length>12_000 || blocks.length>=250)return;
    if(kind==='heading') current=headingSection(text) || 'other';
    else if(current==='other') {
      const inferred=headingSection(text.slice(0,80));
      if(inferred && text.length<100)current=inferred;
    }
    const previous=blocks.at(-1);
    if(previous && previous.kind===kind && previous.text===text)return;
    blocks.push({kind,text,section:current});
  };
  function visit(node:Node) {
    if(blocks.length>=250 || node.nodeType===Node.COMMENT_NODE)return;
    if(node.nodeType===Node.TEXT_NODE){
      if(node.parentNode===root)push('paragraph',node.textContent||'');
      return;
    }
    if(!(node instanceof Element))return;
    const tag=node.tagName.toLowerCase();
    if(/^h[1-6]$/.test(tag)){push('heading',node.textContent||'');return;}
    if(tag==='li'){
      const copy=node.cloneNode(true) as Element;
      copy.querySelectorAll('ul,ol').forEach(n=>n.remove());
      push('bullet',copy.textContent||'');
      node.querySelectorAll(':scope > ul > li, :scope > ol > li').forEach(n=>visit(n));
      return;
    }
    if(['p','pre'].includes(tag)){push('paragraph',node.textContent||'');return;}
    if(['div','section','article','blockquote','td'].includes(tag)){
      if(!node.querySelector('p,li,h1,h2,h3,h4,h5,h6,div,section,article')){
        push('paragraph',node.textContent||'');return;
      }
    }
    node.childNodes.forEach(visit);
  }
  root.childNodes.forEach(visit);
  if(!blocks.length && root.textContent?.trim())push('paragraph',root.textContent);
  return blocks;
}
function validateOfficialDetail(raw:any,info:NonNullable<ReturnType<typeof getJobId>>,job:LiveJob) {
  if(!raw || String(raw.id)!==info.native || raw.isListed===false)
    throw new Error('企业官方职位 ID 已更新或撤回');
  const publishedTitle=info.platform==='lever'?raw.text:raw.title;
  const publishedUrl=info.platform==='greenhouse'?raw.absolute_url:
    info.platform==='lever'?raw.hostedUrl:raw.jobUrl;
  if(typeof publishedTitle!=='string' || typeof publishedUrl!=='string')
    throw new Error('官方岗位信息缺少必要字段');
  const url=new URL(publishedUrl);
  if(!sameOfficialPosting(publishedUrl,job.url))
    throw new Error('官方岗位链接与索引不一致');
  let html='';
  if(info.platform==='ashby') html=String(raw.descriptionHtml||'');
  if(info.platform==='greenhouse')html=String(raw.content||'');
  if(info.platform==='lever'){
    const pieces=[raw.description||raw.descriptionPlain||''];
    if(Array.isArray(raw.lists))for(const part of raw.lists.slice(0,60)){
      if(typeof part.text==='string')pieces.push('<h3>'+part.text.replace(/</g,'&lt;')+'</h3>');
      pieces.push(part.content||'');
    }
    pieces.push(raw.additional||raw.additionalPlain||'',raw.salaryDescription||'');
    html=pieces.filter(v=>typeof v==='string').join('<p></p>');
  }
  const blocks=parseOfficialBlocks(html);
  if(!blocks.length)throw new Error('企业官方接口当前没有公开完整职位说明');
  return {blocks,checkedAt:new Date().toISOString(),sourceUrl:job.url,
    roleTitle:publishedTitle,status:'LIVE_CONTENT' as const};
}
const boardCache=new Map<string,{created:number,promise:Promise<any>}>();
async function readBoard(url:string, signal:AbortSignal) {
  // On-demand official ATS reads only. Reuse the same Ashby board response.
  const old=boardCache.get(url);
  if(!old || Date.now()-old.created>10*60_000){
    const promise=fetch(url,{method:'GET',credentials:'omit',redirect:'error',signal,
      headers:{Accept:'application/json'}}).then(r=>{
      if(!r.ok)throw new Error('官方详情接口 HTTP '+r.status);
      return r.json();
    }).catch(e=>{boardCache.delete(url);throw e});
    boardCache.set(url,{created:Date.now(),promise});
  }
  return boardCache.get(url)!.promise;
}
// Greenhouse's documented Job Board JSONP GET can support browsers even if the
// JSON endpoint does not expose Access-Control-Allow-Origin. Only its official,
// checked host is used. The response still must pass ID and URL validation.
let jsonpSerial=0;
function readGreenhouseJsonp(endpoint:string,signal:AbortSignal):Promise<any> {
  const parsed=new URL(endpoint);
  if(parsed.origin!=='https://boards-api.greenhouse.io' ||
     !/^\/v1\/boards\/[A-Za-z0-9_-]+\/jobs\/[A-Za-z0-9_-]+$/.test(parsed.pathname))
    return Promise.reject(new Error('不允许使用未经验证的 JSONP 来源'));
  return new Promise((resolve,reject)=>{
    if(signal.aborted)return reject(new DOMException('Aborted','AbortError'));
    const callback='__hhbaOfficialJd'+(++jsonpSerial);
    const script=document.createElement('script');
    let done=false;
    let timeout:ReturnType<typeof setTimeout>;
    const cleanup=()=>{
      clearTimeout(timeout);
      script.remove();
      delete (window as unknown as Record<string,unknown>)[callback];
      signal.removeEventListener('abort',onAbort);
    };
    const finish=(error?:Error,value?:unknown)=>{
      if(done)return;
      done=true;cleanup();
      if(error)reject(error);else resolve(value);
    };
    const onAbort=()=>finish(new DOMException('Aborted','AbortError'));
    (window as unknown as Record<string,unknown>)[callback]=(value:unknown)=>finish(undefined,value);
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.onerror=()=>finish(new Error('官方 JSONP 读取暂时失败'));
    parsed.searchParams.set('callback',callback);
    script.src=parsed.href;
    timeout=setTimeout(()=>finish(new Error('官方职位读取超时')),12000);
    signal.addEventListener('abort',onAbort,{once:true});
    document.head.appendChild(script);
  });
}
// Retain the existing Railway service only as a verified JD API for the white site.
// Avoid cross-origin calls when the white frontend and verified ATS reader share Railway.
const JD_API_ORIGIN=import.meta.env.VITE_HHBA_VERIFIED_SNAPSHOT==='1' ? '' : 'https://hhba-web-production-024c.up.railway.app';
const htmlToBlocks=(raw:string):OfficialJdBlock[]=>{
  let section:OfficialJdBlock['section']='other';
  return raw.split(/\n{2,}/).map(entry=>{
    const text=entry.trim();
    const kind:OfficialJdBlock['kind']=text.startsWith('# ')?'heading':text.startsWith('- ')?'bullet':'paragraph';
    const body=kind==='paragraph'?text:text.slice(2);
    if(kind==='heading')section=headingSection(body)||'other';
    return {kind,text:body,section};
  }).filter(x=>x.text.length>0 && x.text.length<=12_000).slice(0,250);
};
export type PreparedBilingualJd={jd:OfficialJd;chinese:string|null;ready:boolean;sourceHash:string};
// The user receives a complete saved document in ONE request.
// HTTP 202 means no ready private cache yet. It never starts translation.
export async function fetchPreparedBilingualJd(job:LiveJob,signal:AbortSignal):Promise<PreparedBilingualJd|null>{
 const response=await fetch(JD_API_ORIGIN+'/api/jobs/'+encodeURIComponent(job.id)+'/ready-jd',{
  method:'GET',mode:'cors',credentials:'omit',redirect:'error',
  headers:{Accept:'application/json'},signal
 });
 if(response.status===202||response.status===503||response.status===404)return null;
 if(!response.ok)throw new Error('预处理岗位详情服务不可用');
 const data=await response.json();
 if(data.jobId!==job.id||data.sourceUrl!==job.url||
    data.job?.id!==job.id||data.job?.url!==job.url||
    !/^[a-f0-9]{64}$/.test(data.sourceHash||'')||
    typeof data.originalText!=='string'||data.originalText.length>100000||
    data.originalText.length<1||
    (data.chineseText!==null&&typeof data.chineseText!=='string')||
    (data.ready===true&&(!data.chineseText||!/[\u3400-\u9fff]/u.test(data.chineseText)))||
    !Number.isFinite(Date.parse(data.checkedAt))||
    Date.now()-Date.parse(data.checkedAt)>7*86400000)
  throw new Error('已保存的双语职位版本或来源校验失败');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.originalText));
 const sourceHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(sourceHash!==data.sourceHash)throw new Error('岗位原文哈希已更新，请等待后台重新核验');
 const blocks=htmlToBlocks(data.originalText);
 if(!blocks.length)throw new Error('预处理的英文职位说明内容为空');
 return {jd:{blocks,originalText:data.originalText,roleTitle:job.title,
   checkedAt:data.checkedAt,sourceUrl:job.url,status:'LIVE_CONTENT'},
   chinese:data.ready?data.chineseText:null,ready:data.ready===true,sourceHash};
}
async function readGreenDetail(job:LiveJob,signal:AbortSignal):Promise<OfficialJd>{
  const response=await fetch(JD_API_ORIGIN+'/api/jobs/'+encodeURIComponent(job.id),{
    method:'GET',mode:'cors',credentials:'omit',redirect:'error',
    headers:{Accept:'application/json'},signal});
  if(!response.ok)throw new Error('官方 JD 服务暂时不可用（HTTP '+response.status+'）');
  const body=await response.json();
  if(body?.job?.id!==job.id || body?.status!=='LIVE_CONTENT' || typeof body.description!=='string' ||
     body.description.length<1 || body.description.length>100_000)throw new Error('官方 JD 来源身份或内容校验失败');
  // Match source posting identity; do not show a description from another job.
  const source=new URL(body.job.url),expected=new URL(job.url);
  if(!sameOfficialPosting(source.href,expected.href))
    throw new Error('官方 JD 来源地址发生变化');
  const blocks=htmlToBlocks(body.description);
  if(!blocks.length)throw new Error('官方 JD 正文为空');
  return {blocks,originalText:body.description,roleTitle:body.job.title,
    checkedAt:body.checkedAt||new Date().toISOString(),sourceUrl:job.url,status:'LIVE_CONTENT'};
}
export async function translateGreenJd(job:LiveJob,originalText:string,signal:AbortSignal,
  onProgress?:(done:number,total:number)=>void):Promise<string> {
  if(originalText.length>100_000)throw new Error('岗位原文超过翻译服务限制');
  const sha=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(originalText));
  const hash=[...new Uint8Array(sha)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const cacheKey='hhba-jd-zh:'+job.id+':'+hash;
  try{
    const cached=sessionStorage.getItem(cacheKey);
    if(cached&&/[\u3400-\u9fff]/u.test(cached))return cached;
  }catch{}
  const translated:string[]=[];let total=1;
  const maxAttempts=3;
  // Chunk cache is private to the current browser session and bound to the
  // exact source JD hash. Failed translations resume without hiding gaps.
  const partPrefix=cacheKey+':part:';
  for(let part=0;part<total;part++){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    if(part>0){
      let saved:string|null=null;
      try{saved=sessionStorage.getItem(partPrefix+part)}catch{}
      if(saved){
        try{
          const parsed=JSON.parse(saved) as {text:string,total:number};
          if(parsed.total===total && typeof parsed.text==='string' &&
             /[\u3400-\u9fff]/u.test(parsed.text) && !/\uFFFD/.test(parsed.text)){
            translated.push(parsed.text);onProgress?.(part+1,total);continue;
          }
        }catch{}
      }
    }
    let response:Response|null=null;
    for(let attempt=0;attempt<maxAttempts;attempt++){
      response=await fetch(JD_API_ORIGIN+'/api/jobs/'+encodeURIComponent(job.id)+'/translate-part',{
        method:'POST',mode:'cors',credentials:'omit',redirect:'error',signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({part,sourceHash:hash})
      });
      if(response.status!==429 && response.status!==502 && response.status!==503)break;
      if(attempt===maxAttempts-1)break;
      await new Promise<void>((resolve,reject)=>{
        if(signal.aborted)return reject(new DOMException('Aborted','AbortError'));
        const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},Math.min(2400,700*(attempt+1)));
        const stop=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))};
        signal.addEventListener('abort',stop,{once:true});
      });
    }
    if(!response?.ok){
      let errorCode='';
      try{const payload=await response?.json();errorCode=typeof payload?.error==='string'?payload.error:''}catch{}
      const reasons:Record<string,string>={
        translation_numbers_mismatch:'机器译文的薪资、年限或百分比与企业官方数字不一致，已停止展示错误译文',
        translation_unverified:'翻译引擎暂时没有返回可以核验的中文内容',
        translation_incomplete:'机器译文仍有未翻译的英文段落',
        translation_markup_leak:'机器译文格式异常，正在保护页面内容',
        source_unavailable:'企业官网职位内容暂时无法再次核验',
        translator_offline:'开源翻译服务暂时不可用',
        reader_busy:'当前翻译请求较多，请稍后重试'
      };
      throw new Error(response?.status===409?
        '企业官方职位内容已经更新，请刷新页面':
        reasons[errorCode]||'中文翻译暂时不可用，请稍后重试');
    }
    const data=await response.json();
    if(data.jobId!==job.id || data.part!==part || data.sourceHash!==hash ||
      !Number.isInteger(data.total) || data.total<1 || data.total>150 ||
      typeof data.text!=='string' || data.numbersVerified!==true ||
      !/[\u3400-\u9fff]/u.test(data.text))throw new Error('翻译校验未通过');
    if(part===0)total=data.total;
    else if(total!==data.total)throw new Error('翻译时岗位正文发生变化');
    // One English source chunk must have one valid Chinese counterpart.
    // Keep an incomplete job out of the "fully translated" count.
    if(data.text.trim().length<3 || /\uFFFD/.test(data.text) || 
       /(?:[A-Za-z]{3,}\s+){12,}[A-Za-z]{3,}/.test(data.text))
       throw new Error('检测到不完整或乱码译文，此岗位不计为完成');
    translated.push(data.text);
    try{sessionStorage.setItem(partPrefix+part,JSON.stringify({text:data.text,total}))}catch{}
    onProgress?.(part+1,total);
  }
  const result=translated.join('\n\n');
  if(!result.trim())throw new Error('中文译文为空');
  try{sessionStorage.setItem(cacheKey,result)}catch{}
  return result;
}
export async function fetchOfficialJd(job:LiveJob,signal:AbortSignal):Promise<OfficialJd> {
  const info=getJobId(job);
  if(!info)throw new Error('此岗位来源暂未提供 HHBA 可验证的完整职位说明');
  let endpoint='';
  if(info.platform==='greenhouse')
    endpoint='https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(info.slug)+'/jobs/'+encodeURIComponent(info.native)+'?content=true';
  if(info.platform==='lever')
    endpoint='https://api.lever.co/v0/postings/'+encodeURIComponent(info.slug)+'/'+encodeURIComponent(info.native)+'?mode=json';
  if(info.platform==='ashby')
    endpoint='https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(info.slug);
  try {
    // Prefer verified JD source via the existing read API. Hash parity is
    // required before its translations can be shown on the white site.
    try{return await readGreenDetail(job,signal);}
    catch(e){if(signal.aborted)throw e;}
    let raw:any;
    try{raw=await readBoard(endpoint,signal);}
    catch(e){
      if(signal.aborted)throw e;
      if(info.platform!=='greenhouse'||!(e instanceof TypeError))throw e;
      raw=await readGreenhouseJsonp(endpoint,signal);
    }
    const record=info.platform==='ashby' ?
      Array.isArray(raw?.jobs)?raw.jobs.find((v:any)=>String(v?.id)===info.native):null : raw;
    return validateOfficialDetail(record,info,job);
  }catch(e){
    if(signal.aborted)throw e;
    if(e instanceof TypeError)throw new Error('浏览器暂时无法连接官方 JD 数据源，请在本页重试');
    throw e;
  }
}
