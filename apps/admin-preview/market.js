// Real employer/job observability. Public job snapshot and protected catalog are separate sources.
// No hardcoded company counts, synthetic jobs, background polling, or automatic D1 reads.
if(typeof window!=='undefined'){
 const $=id=>document.getElementById(id);
 const fmt=new Intl.NumberFormat('zh-CN');
 const allowed=new Set(['automotive','semiconductor','internet-ai','energy','manufacturing','finance','telecom','biomed','aerospace','logistics','construction','consumer-hardware','chem-materials','retail','agri-food','culture-media','education-research']);
 const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
 const showCount=(id,value)=>{$(id).textContent=nonnegative(value)?fmt.format(value):'—'};
 const readableDate=value=>{
  const t=Date.parse(value||'');
  return Number.isFinite(t)?new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+'（北京时间）':'未知';
 };
 let publicReadAt=0,catalogue=null,busy=false;
 function clearPublic(){
  for(const id of ['market-jobs','market-index-companies','market-jd'])showCount(id,null);
 }
 async function publicSnapshot(){
  const state=$('market-index-status');
  state.textContent='读取官网岗位索引中…';
  const path=location.hostname==='admin.hhba.work'||location.hostname==='hhba.work'||
   location.hostname==='hhba-talent.pages.dev'||location.hostname.endsWith('.hhba-talent.pages.dev')
    ?'/api/metrics/public':'/api/overview';
  try{
   const res=await fetch(path,{method:'GET',cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}});
   if(!res.ok)throw Error('HTTP '+res.status);
   const x=await res.json();
   const cloud=x?.kind==='HHBA_CLOUDFLARE_PUBLIC_METRICS_V1';
   if(!cloud&&x?.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2')throw Error('不可识别的快照');
   const valid=(x.quality==='current'||x.quality==='partial')&&nonnegative(x.counts?.displayableJobs);
   showCount('market-jobs',valid?x.counts.displayableJobs:null);
   showCount('market-index-companies',valid?x.counts.distinctIndexedCompanies:null);
   showCount('market-jd',valid?x.counts.auditedJobRequirements:null);
   const ts=cloud?x.sourceTime:x.asOf;
   $('market-index-time').textContent=readableDate(ts);
   state.textContent=valid?(x.quality==='current'?'同批次公开索引可用':'部分审计通过，仍需复核'):
    x.quality==='stale'?'快照已过期 · 不展示数量':'缺少可核验的最新数据';
   publicReadAt=Date.now();
  }catch(e){
   clearPublic();
   $('market-index-time').textContent='—';
   state.textContent='岗位快照不可用：'+String(e?.message||'网络异常');
   publicReadAt=0;
  }
 }
 function clearCatalog(message){
  catalogue=null;
  for(const id of ['market-urls','market-pending','market-missing'])showCount(id,null);
  $('market-catalog-status').textContent='未读取或不可用';
  $('market-catalog-time').textContent='—';
  const table=$('market-industry-rows');table.replaceChildren();
  const row=document.createElement('tr'),cell=document.createElement('td');
  cell.colSpan=8;cell.textContent=message;row.append(cell);table.append(row);
 }
 function renderCatalog(data){
  catalogue=data;
  const total=data.total;
  showCount('market-urls',total.unique_urls);
  showCount('market-pending',total.candidate);
  showCount('market-missing',total.missing);
  const base=data.archived?'历史 D1 导出基线 + KV 更新':data.readonly?'受保护的只读数据库':'实时数据库汇总';
  $('market-catalog-status').textContent=(data.syncWarning?'KV 增量读取异常 · 可能不完整':base)+
   (nonnegative(data.overlayCount)?' · '+fmt.format(data.overlayCount)+' 批缓存更新':'');
  $('market-catalog-time').textContent=data.asOf?readableDate(data.asOf)+'（基线）':'—';
  const table=$('market-industry-rows');table.replaceChildren();
  for(const hall of data.industries){
   const row=document.createElement('tr');
   for(const cellValue of [hall.label,hall.records,hall.unique_urls,hall.verified,hall.historical_verified,hall.candidate,hall.missing]){
    const cell=document.createElement('td');
    cell.textContent=typeof cellValue==='string'?cellValue:nonnegative(cellValue)?fmt.format(cellValue):'—';
    row.append(cell);
   }
   const td=document.createElement('td'),button=document.createElement('button');
   button.type='button';button.className='button-outline';button.textContent='进入馆';
   button.addEventListener('click',()=>window.hhbaAdminNavigation?.openLibrary(hall.id));
   td.append(button);row.append(td);table.append(row);
  }
 }
 function validCatalog(data){
  if(data?.kind!=='HHBA_RECRUITMENT_LIBRARY_V1'||data.mode!=='summary'||
   !data.total||!Array.isArray(data.industries)||data.industries.length!==17||
   !nonnegative(data.total.records)||!nonnegative(data.total.unique_urls)||
   !nonnegative(data.total.linked)||!nonnegative(data.total.candidate)||
   !nonnegative(data.total.verified)||!nonnegative(data.total.historical_verified)||
   !nonnegative(data.total.missing)||data.total.verified+data.total.historical_verified+data.total.candidate!==data.total.linked||
   data.total.linked+data.total.missing!==data.total.records)return false;
  const seen=new Set();
  for(const hall of data.industries){
   if(!allowed.has(hall?.id)||seen.has(hall.id))return false;
   seen.add(hall.id);
   for(const n of ['records','linked','unique_urls','verified','historical_verified','candidate','missing']){
    if(!nonnegative(hall[n]))return false;
   }
   if(hall.verified+hall.historical_verified+hall.candidate!==hall.linked||
    hall.linked+hall.missing!==hall.records)return false;
  }
  return true;
 }
 async function loadCatalog(){
  if(busy)return;
  busy=true;const button=$('market-load'),notice=$('market-notice');
  button.disabled=true;button.textContent='读取中…';notice.textContent='向受保护目录请求真实汇总，不使用演示记录。';
  try{
   const resp=await fetch('/admin-preview/api/library?mode=summary',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
   if(!resp.ok)throw Error('HTTP '+resp.status);
   const data=await resp.json();
   if(!validCatalog(data))throw Error('数据来源或汇总口径未通过检查');
   renderCatalog(data);
   notice.textContent=data.syncWarning?'注意：最近 KV 变更读取异常，当前数字可能缺少最新更新。':
    '企业目录已读取，候选待复核与管理员核实分类分开；与岗位索引不推导虚假转化率。';
  }catch(e){
   clearCatalog('企业目录读取失败，尚无可信的行业统计。');
   notice.textContent='读取失败：'+String(e?.message||'未知错误')+'。未使用旧数值或模拟数据。';
  }finally{busy=false;button.disabled=false;button.textContent='重新读取企业目录'}
 }
 $('market-load').addEventListener('click',()=>{void loadCatalog()});
 window.hhbaMarket={
  open(){
   // Public snapshot is independent of D1 and can be refreshed every two minutes.
   if(Date.now()-publicReadAt>120000)void publicSnapshot();
   if(!catalogue)$('market-notice').textContent='点击“手动读取企业目录”核对 17 个行业馆；未查询不等于零。';
  }
 };
}
