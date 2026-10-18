const $=id=>document.getElementById(id);
let offset=0,token=0,total=0;
function card(job){
 const item=document.createElement("article");item.className="job";
 const brand=document.createElement("div");brand.className="logo";
 brand.textContent=job.company.slice(0,2).toUpperCase();
 if(job.website){const img=document.createElement("img");img.src="https://"+job.website+"/favicon.ico";img.alt="";img.onerror=()=>{brand.textContent=job.company.slice(0,2).toUpperCase()};brand.replaceChildren(img)}
 const body=document.createElement("div");body.className="job-body";
 const title=document.createElement("a");title.href=job.url;title.target="_blank";title.rel="noopener noreferrer nofollow";title.textContent=job.title+" ↗";
 const company=document.createElement("div");company.className="company";company.textContent=job.company;
 const meta=document.createElement("div");meta.className="meta";
 meta.textContent=job.location+" · "+(job.remote===true?"远程":job.remote===false?"非远程":"远程未标注")+" · "+(job.status==="fresh"?"本轮官方同步":"历史缓存")+" · "+job.platform.toUpperCase();
 body.append(title,company,meta);item.append(brand,body);return item;
}
async function load(append=false){
 const n=++token;
 const params=new URLSearchParams({q:$("q").value,company:$("company").value,remote:$("remote").value,limit:"30",offset:String(append?offset:0)});
 try{
  const r=await fetch("/api/jobs/page?"+params);
  if(!r.ok)throw Error("Unavailable");
  const d=await r.json();if(n!==token)return;
  if(append)$("jobs").append(...d.jobs.map(card));else $("jobs").replaceChildren(...d.jobs.map(card));
  offset=(append?offset:0)+d.jobs.length;total=d.total;
  $("summary").textContent="匹配 "+d.total+" 条岗位 · 成功连接 "+d.successBoards+"/"+d.boards+" 个官方招聘板 · 最近同步 "+(d.updatedAt||"待同步");
  $("more").hidden=offset>=d.total;
 }catch{
  if(n!==token)return;
  offset=0;total=0;$("jobs").replaceChildren();
  $("more").hidden=true;
  $("summary").textContent="岗位数据暂时不可用，请重试；不会展示可能过时的搜索结果";
 }
}
$("filters").addEventListener("submit",e=>{e.preventDefault();offset=0;load()});
$("more").addEventListener("click",()=>{load(true)});
$("q").addEventListener("input",()=>{clearTimeout(window.searchDelay);window.searchDelay=setTimeout(()=>{offset=0;load()},280)});
$("company").addEventListener("change",()=>{offset=0;load()});
$("remote").addEventListener("change",()=>{offset=0;load()});
load();
