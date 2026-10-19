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
};
const ATS_HOSTS: Record<string, readonly string[]> = {
  greenhouse: ['job-boards.greenhouse.io','boards.greenhouse.io','boards.eu.greenhouse.io'],
  ashby: ['jobs.ashbyhq.com'],
  lever: ['jobs.lever.co','jobs.eu.lever.co']
};
const MAX_HTML = 240_000;
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
    if(u.protocol!=='https:' || u.port || u.username || u.password ||
      !ATS_HOSTS[platform].includes(u.hostname) || !u.pathname.split('/').includes(slug))
      return null;
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
  if(url.origin+url.pathname!==new URL(job.url).origin+new URL(job.url).pathname)
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
  // Per-page only, no persistent JD harvesting. Reuse same Ashby board response.
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
// Greenhouse's documented Job Board JSONP GET supports browsers even if the
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
export async function fetchOfficialJd(job:LiveJob,signal:AbortSignal):Promise<OfficialJd> {
  const info=getJobId(job);
  if(!info)throw new Error('这个来源暂不支持直接读取完整 JD，请使用企业官方链接');
  let endpoint='';
  if(info.platform==='greenhouse')
    endpoint='https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(info.slug)+'/jobs/'+encodeURIComponent(info.native)+'?content=true';
  if(info.platform==='lever')
    endpoint='https://api.lever.co/v0/postings/'+encodeURIComponent(info.slug)+'/'+encodeURIComponent(info.native)+'?mode=json';
  if(info.platform==='ashby')
    endpoint='https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(info.slug);
  try {
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
    if(e instanceof TypeError)throw new Error('浏览器暂时无法直连企业官方接口，请使用原招聘市场查看完整职位说明');
    throw e;
  }
}
export function greenDetailLink(job:LiveJob){
  return /^[-\w]{1,180}$/.test(job.id) ?
    'https://hhba-web-production-024c.up.railway.app/jobs/'+encodeURIComponent(job.id) : null;
}
