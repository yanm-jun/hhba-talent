import { convert } from "html-to-text@9";
import sanitizeHtml from "sanitize-html@2";

type Job={id:string;company:string;title:string;location:string;remote:boolean|null;url:string;platform:string;source:string};
type Board={platform:"greenhouse"|"ashby"|"lever";company:string;slug:string};
const boards:Board[]=[
 {platform:"greenhouse",company:"Greenhouse",slug:"greenhouse"},
 {platform:"ashby",company:"Ashby",slug:"ashby"},
 {platform:"lever",company:"Spotify",slug:"spotify"},
 {platform:"greenhouse",company:"Canonical",slug:"canonical"},
 {platform:"ashby",company:"Airwallex",slug:"airwallex"},
 {platform:"lever",company:"Palantir",slug:"palantir"}
];
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const urlOK=(value:unknown,slug:string,platform:string)=>{
 try {let u=new URL(String(value||""));let hosts=platform==="greenhouse"?["job-boards.greenhouse.io","boards.greenhouse.io","boards.eu.greenhouse.io"]:platform==="ashby"?["jobs.ashbyhq.com"]:["jobs.lever.co","jobs.eu.lever.co"];
 return u.protocol==="https:"&&!u.username&&!u.password&&hosts.includes(u.hostname)&&u.pathname.split("/").includes(slug)?u.href:null;}catch{return null;}
};
function id(platform:string,slug:string,uid:unknown){return platform+"-"+slug+"-"+String(uid||"").slice(0,85);}
function normalize(board:Board,x:any):Job|null{
 const title=board.platform==="lever"?x?.text:x?.title;
 const native=x?.id;
 const url=board.platform==="greenhouse"?x?.absolute_url:board.platform==="ashby"?x?.jobUrl:x?.hostedUrl;
 const safe=urlOK(url,board.slug,board.platform);
 if(!safe||!title||!native||x?.isListed===false)return null;
 const location=board.platform==="lever"?x?.categories?.location:board.platform==="greenhouse"?x?.location?.name:x?.location;
 const remote=typeof x?.isRemote==="boolean"?x.isRemote:typeof x?.workplaceType==="string"?x.workplaceType.toLowerCase()==="remote":null;
 return {id:id(board.platform,board.slug,native),company:board.company,title:String(title).slice(0,220),
  location:typeof location==="string"?location.slice(0,170):"未披露",
  remote,url:safe,platform:board.platform,source:board.slug};
}
async function getBoard(b:Board):Promise<Job[]>{
 const endpoint=b.platform==="greenhouse"?"https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(b.slug)+"/jobs":
 b.platform==="ashby"?"https://api.ashbyhq.com/posting-api/job-board/"+encodeURIComponent(b.slug):
 "https://api.lever.co/v0/postings/"+encodeURIComponent(b.slug)+"?mode=json";
 let resp=await fetch(endpoint,{headers:{"Accept":"application/json","User-Agent":"HHBA-public-job-index/0.1"},signal:AbortSignal.timeout(12000),redirect:"error"});
 if(!resp.ok||Number(resp.headers.get("content-length")||0)>8000000)throw Error("source unavailable");
 const body=await resp.json() as any;
 const arr=Array.isArray(body)?body:Array.isArray(body?.jobs)?body.jobs:[];
 return arr.slice(0,3000).map((x:any)=>normalize(b,x)).filter((x:Job|null):x is Job=>!!x);
}
let cache:{at:number;rows:Job[];boards:number;failures:number;updated:string}|null=null;
let inflight:Promise<typeof cache>|null=null;
async function load(){
 if(cache&&Date.now()-cache.at<10*60*1000)return cache;
 if(inflight)return await inflight;
 inflight=(async()=>{
  const outcomes=await Promise.allSettled(boards.map(getBoard));
  const rows:Job[]=[];const seen=new Set<string>();let ok=0,failed=0;
  outcomes.forEach(o=>{if(o.status==="fulfilled"){ok++;for(const j of o.value){if(!seen.has(j.url)){seen.add(j.url);rows.push(j);}}}else failed++;});
  rows.sort((a,b)=>a.company.localeCompare(b.company)||a.title.localeCompare(b.title));
  if(ok===0&&cache)return cache;
  cache={at:Date.now(),rows,boards:ok,failures:failed,updated:new Date().toISOString()};
  return cache;
 })();
 try{return await inflight;}finally{inflight=null;}
}

type Detail={job:Job;description:string;richHtml:string;applyUrl:string|null;status:"LIVE_CONTENT"|"DESCRIPTION_UNAVAILABLE";checkedAt:string};
// Read the official published job on the user's click. No local JD corpus,
// no untrusted URL parameters, no AI paraphrase and no fabricated sections.
function approvedApplyUrl(value:unknown,b:Board):string|null{
 return urlOK(value,b.slug,b.platform);
}
async function officialDetail(job:Job):Promise<Detail|null>{
 const board=boards.find(b=>b.slug===job.source&&b.platform===job.platform);
 if(!board)return null;
 const native=job.id.slice(board.platform.length+board.slug.length+2);
 if(!native || native.length>100 || !/^[A-Za-z0-9_-]+$/.test(native))return null;
 const api=board.platform==="greenhouse"
  ?"https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(board.slug)+"/jobs/"+encodeURIComponent(native)+"?content=true"
  :board.platform==="lever"
  ?"https://api.lever.co/v0/postings/"+encodeURIComponent(board.slug)+"/"+encodeURIComponent(native)+"?mode=json"
  :"https://api.ashbyhq.com/posting-api/job-board/"+encodeURIComponent(board.slug);
 try{
  const r=await fetch(api,{headers:{"Accept":"application/json","User-Agent":"HHBA-job-detail/0.2"},
   signal:AbortSignal.timeout(12000),redirect:"error"});
  if(!r.ok||Number(r.headers.get("content-length")||0)>8000000)return null;
  const body=await r.json() as any;
  const raw=board.platform==="ashby"?(Array.isArray(body?.jobs)?
    body.jobs.find((x:any)=>String(x?.id)===native&&x?.isListed!==false):null):body;
  if(!raw||String(raw?.id)!==native)return null;
  const title=board.platform==="lever"?raw.text:raw.title;
  const original=board.platform==="greenhouse"?raw.absolute_url:
    board.platform==="lever"?raw.hostedUrl:raw.jobUrl;
  if(!title||!urlOK(original,board.slug,board.platform)||original!==job.url)return null;
  let html="";
  if(board.platform==="greenhouse")html=typeof raw.content==="string"?raw.content:"";
  if(board.platform==="ashby")html=typeof raw.descriptionHtml==="string"?raw.descriptionHtml:"";
  if(board.platform==="lever"){
    const pieces=[];
    if(typeof raw.description==="string")pieces.push(raw.description);
    else if(typeof raw.descriptionPlain==="string")pieces.push(raw.descriptionPlain);
    if(Array.isArray(raw.lists)){
      for(const item of raw.lists.slice(0,50)){
        if(typeof item?.text==="string")pieces.push("<h3>"+esc(item.text)+"</h3>");
        if(typeof item?.content==="string")pieces.push(item.content);
      }
    }
    if(typeof raw.additional==="string")pieces.push(raw.additional);
    else if(typeof raw.additionalPlain==="string")pieces.push(raw.additionalPlain);
    if(typeof raw.salaryDescription==="string")pieces.push(raw.salaryDescription);
    html=pieces.join("\n");
  }
  const plain=board.platform==="ashby"&&typeof raw.descriptionPlain==="string"?
    raw.descriptionPlain:convert(html,{wordwrap:false,
      selectors:[{selector:"img",format:"skip"},{selector:"a",options:{hideLinkHrefIfSameAsText:true}}]});
  if(plain.length>200000||html.length>250000)return null;
  const richHtml = html.trim()?sanitizeHtml(html,{
    allowedTags:["p","div","span","br","h1","h2","h3","h4","h5","h6","strong","b","em","i","u","ul","ol","li","blockquote","hr","table","thead","tbody","tr","td","th","pre","code","a"],
    allowedAttributes:{"a":["href","title","target","rel"]},
    allowedSchemes:["https","mailto"],
    transformTags:{"a":(_tag,atts)=>({tagName:"a",attribs:{href:atts.href||"",target:"_blank",rel:"noopener noreferrer nofollow"}})}
  }):"";
  return {job,description:plain,richHtml,status:plain.trim()?"LIVE_CONTENT":"DESCRIPTION_UNAVAILABLE",
   applyUrl:approvedApplyUrl(raw.applyUrl,board),
   checkedAt:new Date().toISOString()};
 }catch{return null;}
}
function detailHtml(d:Detail):string{
 const j=d.job;
 const official=esc(j.url),apply=esc(d.applyUrl||j.url);
 const body=d.status==="LIVE_CONTENT"?
   '<div class="full-jd">'+(d.richHtml||esc(d.description))+'</div>':
   '<p class="missing">这个职位的官方接口暂未提供可展示的完整 JD，请直接阅读原始企业页面。</p>';
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="robots" content="noindex,nofollow">'+
  '<title>'+esc(j.title)+' · '+esc(j.company)+' · HHBA</title><style>'+
  '*{box-sizing:border-box}body{margin:0;background:#f5f7f4;color:#173627;font-family:system-ui,"PingFang SC","Microsoft Yahei",sans-serif}'+
  'header{background:#fff;border-bottom:1px solid #e4eae3;padding:22px max(5%,calc((100% - 1080px)/2))}'+
  'header a{text-decoration:none;color:#204c37;font-size:24px;font-weight:900}.wrap{max-width:940px;margin:0 auto;padding:34px 20px 75px}'+
  '.back{text-decoration:none;color:#4a7760;font-size:13px;font-weight:700}.hero{padding:35px 0 25px}'+
  '.eyebrow{color:#649477;font-size:13px;font-weight:750}.hero h1{font-size:clamp(27px,4vw,40px);line-height:1.3;margin:13px 0}'+
  '.meta{color:#5e786b;line-height:1.8;font-size:14px}.panel{background:#fff;border:1px solid #e4eae3;border-radius:14px;padding:clamp(20px,4vw,42px)}'+
  '.panel h2{font-size:21px;margin:0 0 10px}.source{color:#819185;font-size:12px;margin:0 0 28px}'+
  '.full-jd{overflow-wrap:anywhere;line-height:1.85;font-size:15px;color:#304539}.full-jd p{margin:12px 0}.full-jd li{margin:7px 0}.full-jd h2,.full-jd h3{margin-top:28px}.full-jd a{color:#147343;text-decoration:underline}'+
  '.missing{line-height:1.8;color:#7b7656}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:27px}'+
  '.btn{display:inline-block;text-decoration:none;border-radius:9px;padding:13px 20px;font-weight:800;font-size:14px;background:#1e6740;color:white}'+
  '.btn.secondary{color:#1e6740;background:#e7f4e9}.notice{font-size:12px;color:#74857a;line-height:1.8;margin-top:25px}'+
  '</style></head><body><header><a href="/">HHBA <small style="font-size:13px;font-weight:400;color:#728d79">· 招聘市场</small></a></header>'+
  '<main class="wrap"><a class="back" href="/">← 返回招聘市场</a>'+
  '<section class="hero"><div class="eyebrow">'+esc(j.company)+' · '+esc(j.platform.toUpperCase())+'</div>'+
  '<h1>'+esc(j.title)+'</h1><div class="meta">📍 '+esc(j.location)+' · '+(j.remote===true?'远程':j.remote===false?'非远程':'远程方式未标明')+'</div></section>'+
  '<section class="panel"><h2>官方职位描述（原文）</h2><p class="source">按岗位 ID 实时读取 · '+esc(d.checkedAt)+
  ' · 未经 AI 改写</p>'+body+'</section>'+
  '<div class="actions"><a class="btn" href="'+apply+'" target="_blank" rel="noopener noreferrer">前往企业官网申请 ↗</a>'+
  '<a class="btn secondary" href="'+official+'" target="_blank" rel="noopener noreferrer">查看对应官方职位页 ↗</a></div>'+
  '<p class="notice">资料来自企业公开招聘系统。HHBA 不代表任何招聘企业。信息可能随时变动；申请资格和最终岗位状态以企业官网为准。'+
  '原始站点中的表单、视频和自定义交互不复制到本站。</p></main></body></html>';
}

const page=(payload:any)=>`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HHBA · 全球招聘市场</title><meta name="description" content="HHBA 全球招聘市场：真实海外企业公开招聘职位索引，点击跳企业官网。"><style>
:root{font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#172821;background:#f6f7f4}
*{box-sizing:border-box}body{margin:0}a{color:inherit;text-decoration:none}
nav{background:#fff;border-bottom:1px solid #e7ebe6;padding:18px max(5%,calc((100% - 1120px)/2));display:flex;align-items:center;justify-content:space-between}
.logo{font-size:24px;letter-spacing:-1.4px;font-weight:900;color:#204c37}.logo em{font-size:11px;color:#789081;letter-spacing:1px;font-style:normal;margin-left:8px}
nav .lab{font-size:12px;color:#71877b}
.hero{background:#143f2b;color:#fff;padding:70px 6% 64px}.wrap{max-width:1120px;margin:auto}.eyebrow{color:#b1e0bc;font-size:12px;letter-spacing:3px;font-weight:800}
h1{font-size:clamp(32px,5vw,52px);margin:18px 0;letter-spacing:-1px;line-height:1.2}
.hero p{color:#d5e6d9;max-width:700px;line-height:1.85;font-size:15px}
.numbers{display:flex;gap:30px;flex-wrap:wrap;margin-top:30px}.num b{font-size:28px;display:block}.num span{font-size:12px;color:#b5c8bc}
main{max-width:1120px;margin:0 auto;padding:36px 20px 90px}.filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
input,select{font:inherit;border:1px solid #d6e0d8;border-radius:10px;background:white;padding:13px 14px;outline-color:#76bd90}
input{flex:2;min-width:220px}select{flex:1;min-width:140px}.section-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:28px 0}
h2{font-size:20px;margin:0}.section-title span{color:#7f9085;font-size:12px}
.list{display:grid;gap:12px}.job{background:#fff;border:1px solid #e5ebe4;border-radius:13px;padding:22px 24px;display:flex;justify-content:space-between;gap:18px;align-items:center;transition:border-color .2s}
.job:hover{border-color:#98c8ab}.brand{font-size:12px;font-weight:800;color:#527e60}.title{font-size:17px;font-weight:800;margin:8px 0 12px}
.meta{display:flex;gap:8px;flex-wrap:wrap}.meta span{border-radius:20px;background:#f1f5ef;color:#657669;padding:5px 10px;font-size:11px}
.visit{white-space:nowrap;background:#e8f5ec;color:#1e5c39;border-radius:8px;padding:10px 13px;font-size:12px;font-weight:800}
.disclaimer{font-size:12px;color:#728378;margin-top:30px;line-height:1.8}.status{padding:14px;border:1px solid #f0debd;background:#fffaf1;color:#886e40;border-radius:10px;margin-bottom:24px;font-size:12px}
.empty{padding:48px;text-align:center;color:#68776b;background:white;border-radius:12px}
footer{padding:25px;text-align:center;color:#8a9b8f;font-size:11px;border-top:1px solid #e5eae4}
@media(max-width:600px){.hero{padding:50px 22px}nav{padding:16px 22px}.job{display:block;padding:18px}.visit{display:inline-block;margin-top:15px}.numbers{gap:23px}}
</style></head><body><nav><div class="logo">HHBA <em>招聘市场</em></div><div class="lab">真实企业招聘索引 · 公测</div></nav><section class="hero"><div class="wrap"><div class="eyebrow">GLOBAL CAREERS · OFFICIAL SOURCES</div><h1>发现全球工作机会</h1><p>搜索海外企业公开招聘岗位，点击直接前往企业官方职位详情页。岗位来自 Greenhouse、Lever、Ashby 的公开招聘接口；没有虚构职位，不在本网站复制完整 JD。</p><div class="numbers"><div class="num"><b id="count">${payload.total}</b><span>本次获取的岗位</span></div><div class="num"><b>${payload.boards}</b><span>成功读取的招聘板</span></div><div class="num"><b>3</b><span>ATS 数据平台</span></div></div></div></section>
<main><div class="status">公测版说明：当前接入 6 个样本企业招聘板，不代表全量全球职位。最近同步：${esc(payload.updated)}。职位是否仍接受申请以企业官网为准。${payload.failures?" 有 "+payload.failures+" 个来源本轮暂不可用。":""}</div>
<div class="filters"><input id="q" aria-label="搜索岗位或企业" placeholder="搜索岗位、公司、地点（支持英文）"><select id="company" aria-label="企业"><option value="">全部企业</option></select><select id="remote" aria-label="远程筛选"><option value="">全部工作方式</option><option value="yes">标注远程</option></select></div>
<div class="section-title"><h2>官方岗位列表</h2><span id="shown"></span></div><div class="list" id="jobs"></div><p class="disclaimer">数据源为外部企业公开招聘板。部分企业官网在不同网络环境下可能无法访问。岗位发布时间、工作类型、远程标记在接口未披露时不会推断，具体资格要求和投递方式请到企业官网核实。HHBA 不代表与招聘企业存在合作关系。</p></main><footer>HHBA · Global Job Index · 仅公开职位元数据与官方跳转</footer>
<script>
let all=[],filtered=[],limit=30;
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const q=document.querySelector("#q"),c=document.querySelector("#company"),remote=document.querySelector("#remote"),list=document.querySelector("#jobs");
function render(reset=true){
 if(reset)limit=30;
 const key=q.value.trim().toLowerCase();
 filtered=all.filter(x=>(!key||[x.title,x.company,x.location].some(z=>String(z||"").toLowerCase().includes(key)))&&(!c.value||x.company===c.value)&&(!remote.value||x.remote===true));
 document.querySelector("#shown").textContent="显示 "+Math.min(filtered.length,limit)+" / "+filtered.length+" 条";
 list.innerHTML=filtered.slice(0,limit).map(x=>'<article class="job"><div><div class="brand">'+safe(x.company)+' · '+safe(x.platform.toUpperCase())+'</div><div class="title">'+safe(x.title)+'</div><div class="meta"><span>📍 '+safe(x.location)+'</span><span>'+(x.remote===true?'远程':x.remote===false?'非远程':'远程未标注')+'</span><span>官网原始职位</span></div></div><a class="visit" href="/jobs/'+encodeURIComponent(x.id)+'">站内查看完整 JD →</a></article>').join("");
 if(!filtered.length)list.innerHTML='<div class="empty">当前没有匹配的真实职位</div>';
 if(filtered.length>limit)list.innerHTML+='<div style="text-align:center;padding:20px"><button style="padding:12px 35px;border-radius:9px;border:1px solid #c7dacc;background:#fff;cursor:pointer" id="more">查看更多职位</button></div>';
 document.querySelector("#more")?.addEventListener("click",()=>{limit+=30;render(false)});
}
async function start(){try{const r=await fetch('/api/jobs');if(!r.ok)throw Error();const d=await r.json();all=d.jobs||[];let companies=[...new Set(all.map(x=>x.company))].sort();for(let name of companies){let op=document.createElement("option");op.value=name;op.textContent=name;c.append(op)}render();}catch{list.innerHTML='<div class="empty">官方岗位接口暂时不可用，请稍后刷新</div>';}}
q.addEventListener("input",()=>render());c.addEventListener("change",()=>render());remote.addEventListener("change",()=>render());start();
</script></body></html>`;
Bun.serve({port:Number(Bun.env.PORT||3000),hostname:"0.0.0.0",async fetch(req){
 const u=new URL(req.url);
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"};
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers});
 if(u.pathname==="/health")return Response.json({ok:true,kind:"hhba-ats-public-preview"},{headers});
 if(u.pathname==="/api/jobs"){const data=await load();return Response.json({jobs:data?.rows||[],total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""},{headers});}

 if(u.pathname.startsWith("/jobs/")||u.pathname.startsWith("/api/jobs/")){
  const nativeId=decodeURIComponent(u.pathname.split("/").pop()||"");
  if(nativeId.length>180||!/^[A-Za-z0-9_-]+$/.test(nativeId))
   return new Response("Not found",{status:404,headers});
  const market=await load(),job=market?.rows.find(x=>x.id===nativeId);
  if(!job)return new Response("该岗位不在当前官方公开列表中",{status:404,headers});
  const result=await officialDetail(job);
  if(!result)return new Response("官方职位详情暂不可用，请从招聘列表进入企业官网",{status:503,headers});
  if(u.pathname.startsWith("/api/"))return Response.json(result,{headers});
  return new Response(detailHtml(result),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
 }

 if(u.pathname!=="/")return new Response("Not found",{status:404,headers});
 const data=await load();return new Response(page({total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
}});

// One-time deployment diagnostic: no JD text or personal data is logged.
void (async()=>{
 try{
  const catalog=await load();
  console.log("HHBA_SOURCE_SYNC",JSON.stringify({jobs:catalog?.rows.length||0,boards:catalog?.boards||0,failures:catalog?.failures||0}));
  for(const platform of ["greenhouse","lever","ashby"]){
   const job=catalog?.rows.find(x=>x.platform===platform);
   if(!job){console.log("HHBA_DETAIL_PROBE",platform,"NO_LISTED_JOB");continue;}
   const d=await officialDetail(job);
   console.log("HHBA_DETAIL_PROBE",platform,JSON.stringify({found:!!d,chars:d?.description.length||0,richMarkup:d?.richHtml.length||0}));
  }
 }catch(ex){console.log("HHBA_DETAIL_PROBE_ERROR",ex instanceof Error?ex.name:"Unknown");}
})();

void (async()=>{
 try{
  const catalog=await load();
  const sample=catalog?.rows.find(x=>x.platform==="greenhouse");
  if(!sample)return;
  const root="http://127.0.0.1:"+String(Bun.env.PORT||3000);
  const path="/jobs/"+encodeURIComponent(sample.id);
  const res=await fetch(root+path,{signal:AbortSignal.timeout(13000)});
  const markup=await res.text();
  const api=await fetch(root+"/api/jobs/"+encodeURIComponent(sample.id),
   {signal:AbortSignal.timeout(13000)});
  let match=false,desc=0;
  if(api.ok){const d=await api.json() as any;
    match=d?.job?.id===sample.id&&d?.job?.url===sample.url;
    desc=String(d?.description||"").length;}
  console.log("HHBA_DETAIL_ROUTE_PROOF",JSON.stringify({
    pageHttp:res.status,hasTitle:markup.includes(esc(sample.title)),
    containsJD:markup.includes("官方职位描述"),apiHttp:api.status,
    matchedOfficialJob:match,plainChars:desc
  }));
 }catch(ex){console.log("HHBA_DETAIL_ROUTE_PROOF_ERROR",ex instanceof Error?ex.name:"Unknown");}
})();
