// HHBA Admin Console — Phase 1, read-only local preview.
// All remote content is restricted to the server's validated aggregate metrics.
const byId=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('zh-CN');
const formatTime=value=>{
 try{return new Date(value).toLocaleString('zh-CN',{
   timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',hour12:false
 })+'（北京时间）'}catch{return '—'}
};
let snapshot=null,selectedPeriod='30d',customRange=null,activeView='overview';
const titles={overview:'数据总览',users:'用户分析',market:'岗位与企业',operations:'运营监控',
 finance:'财务成本',investor:'融资展示',settings:'系统设置'};
const details={
 users:['注册与活跃用户','未来接入真实身份系统、用户事件与留存数据；不从访问量反推注册用户。'],
 market:['企业和岗位质量分析','未来接入岗位状态、ATS 来源及招聘质量报表；当前公开索引汇总在数据总览。'],
 operations:['系统运行与数据同步','未来接入有权限的同步队列和异常日志；当前预览不读取服务器私有日志。'],
 finance:['成本、收入与经营效率','未来接入经核对的收支台账和 API 成本；无记录时不生成模拟营收。'],
 settings:['后台权限和统计配置','接入登录系统后，启用管理员 RBAC、投资人只读访问及指标口径管理。']
};
function setView(view){
 if(!Object.hasOwn(titles,view))view='overview';
 activeView=view;
 for(const node of document.querySelectorAll('.page-view'))node.hidden=true;
 byId('view-'+(view==='investor'?'investor':view==='overview'?'overview':'placeholder')).hidden=false;
 byId('breadcrumb').textContent=titles[view];
 document.title=titles[view]+' · HHBA 管理中心';
 document.body.classList.toggle('investor-mode',view==='investor');
 for(const node of document.querySelectorAll('.nav-link')){
  const selected=node.dataset.view===view;
  node.classList.toggle('is-active',selected);
  if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
 }
 if(details[view]){
  byId('placeholder-heading').textContent=titles[view];
  byId('placeholder-subtitle').textContent=details[view][0];
  byId('placeholder-description').textContent=details[view][1];
 }
 closeMenu();
 window.scrollTo(0,0);
}
function closeMenu(){
 byId('sidebar').classList.remove('mobile-open');
 byId('mobile-dim').hidden=true;
 byId('mobile-menu').setAttribute('aria-expanded','false');
}
function choosePeriod(value){
 if(!['today','7d','30d','custom'].includes(value))return;
 selectedPeriod=value;
 for(const node of document.querySelectorAll('[data-period]')){
  const chosen=node.dataset.period===value;
  node.classList.toggle('selected',chosen);
  node.setAttribute('aria-pressed',String(chosen));
 }
 byId('custom-range').hidden=value!=='custom';
 const text={today:'今日', '7d':'近 7 天','30d':'近 30 天',custom:customRange?'自定义时间':'自定义时间'};
 byId('trend-range-label').textContent=value==='custom'&&customRange
  ?customRange.from+' 至 '+customRange.to:text[value];
 byId('period-notice').querySelector('span').textContent='当前岗位指标为最新索引快照，与所选'+text[value]+
  '范围无关；按日注册、活跃与趋势尚未接入。';
}
function qualityText(data){
 if(!data)return '暂不可用';
 if(data.quality==='stale')return '快照已过期';
 if(data.quality==='partial')return '同步不完整';
 if(data.quality==='unavailable')return '真实数据暂不可用';
 return '来源与审计快照已核对';
}
function updateOverview(){
 const data=snapshot,valid=data?.quality!=='stale'&&['current','partial'].includes(data?.quality)&&data?.kind==='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2',counts=data?.counts;
 byId('jobs-count').textContent=valid?fmt.format(counts.displayableJobs):'—';
 byId('indexed-count').textContent=valid?fmt.format(counts.indexedJobs):'—';
 byId('requirements-count').textContent=valid?fmt.format(counts.auditedJobRequirements):'—';
 byId('companies-count').textContent=valid?fmt.format(counts.distinctIndexedCompanies):'—';
 byId('boards-count').textContent=valid&&counts.checkedAtsSources!==null?fmt.format(counts.checkedAtsSources):'—';
 byId('jobs-sub').textContent=valid?'排除明确异常 · 不保证当前可申请':data?'快照不完整，暂不展示总数':'真实索引暂不可用';
 byId('boards-sub').textContent=valid?'本次审计的 ATS 来源，非合作企业数':'来源尚待核验';
 byId('top-source-date').textContent=data?'公开索引 · '+formatTime(data.asOf):'数据源：暂不可用';
 byId('feed-health').textContent=qualityText(data);
 byId('feed-detail').textContent=data?
   '来源时间：'+formatTime(data.asOf):'无法获取公开岗位快照，请稍后刷新。';
 byId('feed-dot').className='source-status-dot'+(valid?' good':data?' bad':'');
 byId('failed-boards').textContent=Number.isInteger(counts?.failedAtsSources)?fmt.format(counts.failedAtsSources):'—';
 byId('snapshot-time').textContent=data?.asOf?formatTime(data.asOf):'—';
 byId('audit-time').textContent=data?.auditCheckedAt?formatTime(data.auditCheckedAt):'—';
 const status=byId('jobs-status');
 status.textContent=valid?'已核验':data?'不完整 / 过期':'暂不可用';
 status.className='table-status '+(valid?'good':data?'bad':'waiting');
 byId('investor-jobs').textContent=valid?fmt.format(counts.displayableJobs):'—';
 byId('investor-boards').textContent=valid?fmt.format(counts.distinctIndexedCompanies):'—';
 byId('investor-jobs-label').textContent=valid?'经排除异常的展示记录，非实时在招认证':'尚无完整有效快照';
 byId('investor-asof').textContent=data?formatTime(data.asOf):'—';
 byId('investor-quality').textContent=qualityText(data);
 byId('export-csv').disabled=!valid;
}
async function refresh(){
 const btn=byId('refresh');
 btn.disabled=true;
 btn.setAttribute('aria-busy','true');
 btn.lastChild.textContent=' 正在核对…';
 try{
  const response=await fetch('/api/overview',{method:'GET',cache:'no-store',credentials:'omit',
   headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('index_not_available');
  const body=await response.json();
  if(body.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'||
     !['current','partial','stale','unavailable'].includes(body.quality)||
     !body.counts||!(body.counts.displayableJobs===null||Number.isSafeInteger(body.counts.displayableJobs)))
   throw Error('invalid_public_index_response');
  snapshot=body;
 }catch{
  snapshot=null;
 }finally{
  updateOverview();
  btn.disabled=false;
  btn.removeAttribute('aria-busy');
  btn.lastChild.textContent=' 刷新数据';
 }
}
function exportCSV(){
 const data=snapshot;
 if(!data||!['current','partial'].includes(data.quality)||data.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2')return;
 const rows=[
  ['HHBA 融资只读数据快照','指标值','统计口径','来源时间（ISO 8601）'],
  ['公开索引记录',String(data.counts.indexedJobs),data.definitions.indexedJobs,data.asOf],
  ['可展示记录',String(data.counts.displayableJobs),data.definitions.displayableJobs,data.asOf],
  ['已核验官网任职要求',String(data.counts.auditedJobRequirements),data.definitions.auditedJobRequirements,data.auditCheckedAt],
  ['去重收录企业',String(data.counts.distinctIndexedCompanies),data.definitions.distinctIndexedCompanies,data.asOf],
  ['已审计 ATS 来源',String(data.counts.checkedAtsSources),data.definitions.checkedAtsSources,data.auditCheckedAt],
  ['失败 ATS 来源',String(data.counts.failedAtsSources),data.definitions.failedAtsSources,data.auditCheckedAt],
  ['累计注册用户','未接入','没有可核验用户计数',''],
  ['近 30 日活跃用户','未接入','没有完整用户事件数据',''],
  ['真实收入','未接入','未接入财务台账','']
 ];
 const csv='\uFEFF'+rows.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='HHBA-verified-overview.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const node of document.querySelectorAll('.nav-link'))node.addEventListener('click',()=>{
 setView(node.dataset.view);
});
for(const node of document.querySelectorAll('[data-period]'))node.addEventListener('click',()=>{
 choosePeriod(node.dataset.period);
});
byId('apply-custom').addEventListener('click',()=>{
 const from=byId('date-from').value,to=byId('date-to').value;
 const alert=byId('date-error');
 if(!from||!to||from>to){alert.textContent='请选择有效的起止日期';return}
 if(to>new Date().toISOString().slice(0,10)){alert.textContent='结束日期不能晚于今天';return}
 alert.textContent='';
 customRange={from,to};choosePeriod('custom');
});
byId('refresh').addEventListener('click',refresh);
byId('top-investor').addEventListener('click',()=>setView('investor'));
byId('show-investor').addEventListener('click',()=>setView('investor'));
byId('leave-investor').addEventListener('click',()=>setView('overview'));
byId('back-overview').addEventListener('click',()=>setView('overview'));
byId('export-csv').addEventListener('click',exportCSV);
byId('mobile-menu').addEventListener('click',()=>{
 const open=!byId('sidebar').classList.contains('mobile-open');
 byId('sidebar').classList.toggle('mobile-open',open);
 byId('mobile-dim').hidden=!open;
 byId('mobile-menu').setAttribute('aria-expanded',String(open));
});
byId('mobile-dim').addEventListener('click',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
choosePeriod('30d');updateOverview();void refresh();
