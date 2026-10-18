const $=id=>document.getElementById(id);
let limit=30,token=0;
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
async function load(){
 const n=++token;
 const params=new URLSearchParams({q:$("q").value,company:$("company").value,remote:$("remote").value,limit:String(limit)});
 try{
  const r=await fetch("/api/jobs/page?"+params);
  if(!r.ok)throw Error("Unavailable");
  const d=await r.json();if(n!==token)return;
  $("jobs").replaceChildren(...d.jobs.map(card));
  $("summary").textContent="匹配 "+d.total+" 条岗位 · 成功连接 "+d.successBoards+"/"+d.boards+" 个官方招聘板 · 最近同步 "+(d.updatedAt||"待同步");
  $("more").hidden=d.total<=d.jobs.length;
 }catch{
  if(n!==token)return;
  $("jobs").replaceChildren();
  $("more").hidden=true;
  $("summary").textContent="岗位数据暂时不可用，请重试；不会展示可能过时的搜索结果";
 }
}
$("filters").addEventListener("submit",e=>{e.preventDefault();limit=30;load()});
$("more").addEventListener("click",()=>{limit=Math.min(5000,limit+30);load()});
$("q").addEventListener("input",()=>{clearTimeout(window.searchDelay);window.searchDelay=setTimeout(()=>{limit=30;load()},280)});
$("company").addEventListener("change",()=>{limit=30;load()});
$("remote").addEventListener("change",()=>{limit=30;load()});
load();
