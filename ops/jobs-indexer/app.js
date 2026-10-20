const $=id=>document.getElementById(id);
let offset=0,token=0,total=0,searchDelay=null,language="zh";
try{language=localStorage.getItem("hhba-language")==="en"?"en":"zh"}catch{}
const english=()=>language==="en";
const words={
 zh:{header:"HHBA · 全球招聘市场（预发布）",tagline:"来自企业官方公开招聘接口的真实职位 · 直达官方投递",
  note:"这是独立测试服务，不替换现有 HHBA。国内原有职位仍保留在旧服务；历史缓存不代表岗位仍在招聘，申请状态请以官网为准。",
  footer:"HHBA 不是招聘企业官方平台，也不代表与任何招聘企业存在合作关系。岗位条件、所在地和开放状态以企业官网为准。",
  query:"搜索职位、公司、城市",all:"全部企业",work:"全部工作方式",remote:"仅远程",
  search:"搜索岗位",freshFilter:"近期官网同步",staleFilter:"历史缓存（单独查看）",more:"查看更多岗位",back:"← 返回岗位列表",
  apply:"前往企业官网投递 ↗",missing:"岗位详情仅包含经过验证的基础索引信息。尚未同步完整岗位职责与任职要求，请通过官方招聘链接核查，不应将缺失内容视为没有要求。",
  failed:"岗位数据暂时不可用，请重试；不会展示可能过时的搜索结果",
  missingJob:"该岗位不存在或已下架，请返回岗位列表",fresh:"本轮官方同步",stale:"历史缓存",
  remoteYes:"远程",remoteNo:"非远程",remoteUnknown:"远程未标注"},
 en:{header:"HHBA · Global Jobs (Preview)",tagline:"Real positions from public employer job APIs · Apply on official sites",
  note:"This is an independent preview, not the existing HHBA website. Existing China job listings remain on the legacy service. Cached jobs may no longer be open; verify on the official employer page.",
  footer:"HHBA is not an official employer recruitment platform and has no implied employer affiliation. Verify eligibility and availability with the employer.",
  query:"Search titles, companies, cities",all:"All companies",work:"All work modes",remote:"Remote only",
  search:"Search jobs",freshFilter:"Recently synced",staleFilter:"Cached archive only",more:"Load more",back:"← Back to job listings",
  apply:"Apply on official employer website ↗",missing:"The index currently includes verified basic metadata only, not full duties or qualifications. See the original employer posting for complete requirements.",
  failed:"Jobs are temporarily unavailable. Retry; potentially outdated results will not be shown.",
  missingJob:"This role is missing or closed. Return to listings.",fresh:"Synced this cycle",stale:"Cached listing",
  remoteYes:"Remote",remoteNo:"Not remote",remoteUnknown:"Remote unspecified"}
};
function labels(){return words[language]}
function updateLanguage(){
 const t=labels();
 document.documentElement.lang=english()?"en":"zh-CN";
 $("lang").value=language;
 $("site-title").textContent=t.header;$("site-tagline").textContent=t.tagline;
 $("site-note").textContent=t.note;$("site-footer").textContent=t.footer;
 $("q").placeholder=t.query;$("company").options[0].textContent=t.all;
 $("remote").options[0].textContent=t.work;$("remote").options[1].textContent=t.remote;
 $("status").options[0].textContent=t.freshFilter;$("status").options[1].textContent=t.staleFilter;
 $("filters").querySelector("button[type=submit]").textContent=t.search;
 $("more").textContent=t.more;
}
function localizedTitle(job){return english()?job.title:(job.titleZh||"职位名称待翻译")}
function localizedPlace(job){return english()?job.location:(job.locationZh||"工作地点待翻译")}
function remoteLabel(job){
 return job.remote===true?labels().remoteYes:job.remote===false?labels().remoteNo:labels().remoteUnknown;
}
function card(job){
 const item=document.createElement("article");item.className="job";
 const brand=document.createElement("div");brand.className="logo";
 brand.textContent=job.company.slice(0,2).toUpperCase();
 if(job.website){
  const img=document.createElement("img");
  img.src="https://"+job.website+"/favicon.ico";img.alt="";
  img.onerror=()=>{brand.textContent=job.company.slice(0,2).toUpperCase()};
  brand.replaceChildren(img);
 }
 const body=document.createElement("div");body.className="job-body";
 const title=document.createElement("a");title.href="/jobs/"+encodeURIComponent(job.id);
 title.textContent=localizedTitle(job);
 const company=document.createElement("div");company.className="company";company.textContent=job.company;
 const meta=document.createElement("div");meta.className="meta";
 meta.textContent=localizedPlace(job)+" · "+remoteLabel(job)+" · "+(job.status==="fresh"?labels().fresh:labels().stale)+" · "+job.platform.toUpperCase();
 body.append(title,company,meta);item.append(brand,body);return item;
}
async function load(append=false){
 const n=++token;
 const params=new URLSearchParams({q:$("q").value,company:$("company").value,remote:$("remote").value,status:$("status").value,limit:"30",offset:String(append?offset:0)});
 try{
  const r=await fetch("/api/jobs/page?"+params);
  if(!r.ok)throw Error("Unavailable");
  const d=await r.json();if(n!==token)return;
  if(append)$("jobs").append(...d.jobs.map(card));
  else $("jobs").replaceChildren(...d.jobs.map(card));
  offset=(append?offset:0)+d.jobs.length;total=d.total;
  const warning=d.query?.degreeUnknown?
   (english()?"Degree requirements have not been verified. Results do not imply a degree is unnecessary.":d.query.warnings.join("；")):"";
  $("summary").textContent=english()?
   ("Found "+d.total+" jobs · "+d.successBoards+"/"+d.boards+" connected boards · Updated "+(d.updatedAt||"pending")+(warning?" · Note: "+warning:"")):
   ("匹配 "+d.total+" 条岗位 · 成功连接 "+d.successBoards+"/"+d.boards+" 个官方招聘板 · 最近同步 "+(d.updatedAt||"待同步")+(warning?" · 注意："+warning:""));
  $("more").hidden=offset>=d.total;
 }catch{
  if(n!==token)return;
  offset=0;total=0;$("jobs").replaceChildren();
  $("more").hidden=true;$("summary").textContent=labels().failed;
 }
}
function showDetail(job){
 const main=document.querySelector("main"),list=$("jobs"),form=$("filters"),summary=$("summary"),more=$("more");
 main.querySelector("#detail")?.remove();
 const detail=document.createElement("section");detail.id="detail";detail.className="job-detail";
 const back=document.createElement("button");back.type="button";back.textContent=labels().back;
 back.onclick=()=>{history.pushState(null,"","/");detail.remove();list.hidden=false;form.hidden=false;summary.hidden=false;more.hidden=offset>=total};
 const heading=document.createElement("h2");heading.textContent=localizedTitle(job);
 const company=document.createElement("p");company.textContent=job.company+" · "+localizedPlace(job)+" · "+remoteLabel(job);
 const note=document.createElement("p");note.className="note";note.textContent=labels().missing;
 const apply=document.createElement("a");apply.href=job.url;apply.target="_blank";apply.rel="noopener noreferrer nofollow";apply.className="apply";apply.textContent=labels().apply;
 detail.append(back,heading,company,note,apply);main.append(detail);
 list.hidden=true;form.hidden=true;summary.hidden=true;more.hidden=true;
}
async function route(){
 const match=location.pathname.match(/^\/jobs\/([a-f0-9]{32})$/);
 if(!match){$("detail")?.remove();$("jobs").hidden=false;$("filters").hidden=false;$("summary").hidden=false;$("more").hidden=offset>=total;return}
 try{const r=await fetch("/api/jobs/"+match[1]);if(!r.ok)throw Error("not found");const data=await r.json();showDetail(data.job)}
 catch{$("summary").textContent=labels().missingJob;history.replaceState(null,"","/");route()}
}
$("filters").addEventListener("submit",e=>{e.preventDefault();offset=0;load()});
$("more").addEventListener("click",()=>load(true));
$("q").addEventListener("input",()=>{clearTimeout(searchDelay);searchDelay=setTimeout(()=>{offset=0;load()},280)});
$("company").addEventListener("change",()=>{offset=0;load()});
$("remote").addEventListener("change",()=>{offset=0;load()});
$("status").addEventListener("change",()=>{offset=0;load()});
$("lang").addEventListener("change",()=>{
 language=$("lang").value==="en"?"en":"zh";
 try{localStorage.setItem("hhba-language",language)}catch{}
 updateLanguage();offset=0;load();if(location.pathname.startsWith("/jobs/"))route();
});
document.addEventListener("click",e=>{
 const link=e.target.closest?.("a[href^='/jobs/']");
 if(!link)return;e.preventDefault();history.pushState(null,"",link.getAttribute("href"));route()
});
window.addEventListener("popstate",route);
updateLanguage();load();route();
