import {mountUnifiedWorkbench,workspaceViews,refreshUnifiedWorkbench} from './unified-workbench.js';
// HHBA Admin Console — private Railway Phase 3.1; all queries require an admin session.
const byId=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('zh-CN');
const formatTime=value=>{
 if(!value)return '—';
 try{return new Date(value).toLocaleString('zh-CN',{
   timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',hour12:false
 })+'（北京时间）'}catch{return '—'}
};
let snapshot=null,growth=null,selectedPeriod='30d',customRange=null,activeView='overview';
const titles={overview:'数据总览',users:'访问与收藏',market:'岗位与企业',operations:'运营监控',
 finance:'财务成本',investor:'融资展示',settings:'系统设置',...workspaceViews};
const details={
 market:['企业和岗位质量分析','未来接入岗位状态、ATS 来源及招聘质量报表；当前公开索引汇总在数据总览。'],
 operations:['系统运行与数据同步','未来接入有权限的同步队列和异常日志；当前预览不读取服务器私有日志。'],
 finance:['成本、收入与经营效率','未来接入经核对的收支台账和 API 成本；无记录时不生成模拟营收。'],
 settings:['后台权限和统计配置','接入登录系统后，启用管理员 RBAC、投资人只读访问及指标口径管理。']
};
function setView(view){
 if(!Object.hasOwn(titles,view))view='overview';
 activeView=view;
 for(const node of document.querySelectorAll('.page-view'))node.hidden=true;
 (byId('view-'+view)||byId('view-placeholder')).hidden=false;
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
 if(!['today','7d','30d','90d','custom'].includes(value))return;
 selectedPeriod=value;
 for(const node of document.querySelectorAll('[data-period]')){
  const chosen=node.dataset.period===value;
  node.classList.toggle('selected',chosen);
  node.setAttribute('aria-pressed',String(chosen));
 }
 byId('custom-range').hidden=value!=='custom';
 const text={today:'今日', '7d':'近 7 天','30d':'近 30 天','90d':'近 90 天',custom:customRange?'自定义时间':'自定义时间'};
 byId('trend-range-label').textContent=value==='custom'&&customRange
  ?customRange.from+' 至 '+customRange.to:text[value];
 byId('period-notice').querySelector('span').textContent='访问和收藏操作按'+text[value]+'范围统计；岗位索引及当前有效收藏总量属于快照指标，不随日期筛选变化。';
 if(value!=='custom'||customRange)void refreshGrowth();
}
function qualityText(data){
 if(!data)return '暂不可用';
 if(data.quality==='stale')return '快照已过期';
 if(data.quality==='partial')return '同步不完整';
 if(data.quality==='unavailable')return '真实数据暂不可用';
 return '来源与审计快照已核对';
}
function updateOverview(){
 const data=snapshot,valid=['current','partial'].includes(data?.quality)&&data?.kind==='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'&&Number.isSafeInteger(data?.counts?.displayableJobs),counts=data?.counts;
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
 byId('feed-dot').className='source-status-dot'+(valid&&data.quality==='current'?' good':data?' bad':'');
 byId('failed-boards').textContent=Number.isInteger(counts?.failedAtsSources)?fmt.format(counts.failedAtsSources):'—';
 byId('snapshot-time').textContent=data?.asOf?formatTime(data.asOf):'—';
 byId('audit-time').textContent=data?.auditCheckedAt?formatTime(data.auditCheckedAt):'—';
 const status=byId('jobs-status');
 status.textContent=valid?(data.quality==='partial'?'部分核验':'已核验'):data?'不完整 / 过期':'暂不可用';
 status.className='table-status '+(valid&&data.quality==='current'?'good':data?'bad':'waiting');
 byId('investor-jobs').textContent=valid?fmt.format(counts.displayableJobs):'—';
 byId('investor-boards').textContent=valid?fmt.format(counts.distinctIndexedCompanies):'—';
 byId('investor-jobs-label').textContent=valid?'经排除异常的展示记录，非实时在招认证':'尚无完整有效快照';
 byId('investor-asof').textContent=data?formatTime(data.asOf):'—';
 byId('investor-quality').textContent=qualityText(data);
 byId('export-csv').disabled=!valid&&growth?.traffic?.quality!=='collected'&&growth?.bookmarks?.quality!=='collected';
}
async function refresh(){
 const btn=byId('refresh');
 btn.disabled=true;
 btn.setAttribute('aria-busy','true');
 btn.lastChild.textContent=' 正在核对…';
 try{
  const response=await fetch('./data/jobs.json',{method:'GET',cache:'no-store',credentials:'same-origin',
   headers:{Accept:'application/json'}});
  if(response.status===401){void 0;return;}
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
 const jobsReady=data?.kind==='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'&&['current','partial'].includes(data.quality);
 const trafficReady=growth?.traffic?.quality==='collected';
 const savedReady=growth?.bookmarks?.quality==='collected';
 if(!jobsReady&&!trafficReady&&!savedReady)return;
 const rows=[['HHBA 静态管理后台可核验指标','指标值','统计口径','来源时间（ISO 8601）']];
 if(jobsReady)rows.push(
  ['公开索引岗位',String(data.counts.indexedJobs),data.definitions.indexedJobs,data.asOf],
  ['可展示岗位',String(data.counts.displayableJobs),data.definitions.displayableJobs,data.asOf],
  ['官网要求已核验',String(data.counts.auditedJobRequirements),data.definitions.auditedJobRequirements,data.auditCheckedAt],
  ['去重收录企业',String(data.counts.distinctIndexedCompanies),data.definitions.distinctIndexedCompanies,data.asOf]);
 if(trafficReady)rows.push(
  ['PV（同意采集）',String(growth.traffic.pv),growth.definitions.pv,growth.asOf],
  ['日 UV 合计',String(growth.traffic.dailyUvSum),growth.definitions.dailyUvSum,growth.asOf],
  ['岗位详情浏览',String(growth.traffic.jobViews),'非跨期去重访客',growth.asOf],
  ['搜索次数',String(growth.traffic.searches),'仅记录事件，不存关键词',growth.asOf],
  ['申请外链点击',String(growth.traffic.applyClicks),'点击不等于投递成功',growth.asOf]);
 if(savedReady)rows.push(
  ['有效设备收藏总量',String(growth.bookmarks.totalActive),growth.definitions.bookmarks,growth.asOf],
  ['有收藏的设备数',String(growth.bookmarks.devicesWithBookmarks),'不是注册账户数',growth.asOf],
  ['本期新增收藏',String(growth.bookmarks.added),'期间内收藏操作次数',growth.asOf],
  ['本期取消收藏',String(growth.bookmarks.removed),'期间内取消操作次数',growth.asOf]);
 rows.push(['真实注册账户','未接入','模拟账户不计入真实注册数',''],
  ['真正 DAU/MAU','未接入','没有正式账号活跃度口径',''],
  ['营收','未接入','没有经核实财务台账','']);
 const csv='\uFEFF'+rows.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='HHBA-phase31-private-verified-metrics.csv';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function displayMetric(id,value,available){const el=byId(id);if(el)el.textContent=available&&Number.isSafeInteger(value)?fmt.format(value):'—';}
function renderDailyPV(id,data,available){
 const root=byId(id);root.replaceChildren();
 if(!available){root.textContent='暂未取得有效的匿名访问数据。';root.classList.add('admin-empty-chart');return;}
 root.classList.remove('admin-empty-chart');
 const entries=data||[],max=Math.max(1,...entries.map(item=>Number(item.pv)||0));
 const chart=document.createElement('div');chart.className='admin-chart-bars';
 for(const item of entries){
  const col=document.createElement('div');col.className='admin-chart-column';
  const bar=document.createElement('span');bar.className='admin-chart-bar';
  const n=Number(item.pv)||0;
  bar.style.height=n===0?'2px':Math.max(4,Math.round(n/max*100))+'%';
  bar.title=item.date+'：'+n+' 次页面浏览';
  bar.setAttribute('aria-label',bar.title);
  col.append(bar);chart.append(col);
 }
 const dates=document.createElement('div');dates.className='admin-chart-dates';
 const first=document.createElement('span');first.textContent=entries[0]?.date||'—';
 const last=document.createElement('span');last.textContent=entries[entries.length-1]?.date||'—';
 dates.append(first,last);
 root.append(chart,dates);
}
function updateGrowth(){
 const t=growth?.traffic,b=growth?.bookmarks;
 const readyT=t?.quality==='collected',readyB=b?.quality==='collected';
 for(const [id,value] of [['ov-pv',t?.pv],['growth-pv',t?.pv],['ov-uv',t?.dailyUvSum],['growth-uv',t?.dailyUvSum],
  ['ov-click',t?.applyClicks],['growth-click',t?.applyClicks],['growth-views',t?.jobViews],['growth-search',t?.searches]])
  displayMetric(id,value,readyT);
 for(const [id,value] of [['ov-saves',b?.totalActive],['growth-saved',b?.totalActive],['growth-saved-devices',b?.devicesWithBookmarks],['investor-saved',b?.totalActive]])
  displayMetric(id,value,readyB);
 displayMetric('investor-pv',t?.pv,readyT);
 byId('growth-changes').textContent=readyB&&Number.isSafeInteger(b.added)&&Number.isSafeInteger(b.removed)
  ?fmt.format(b.added)+' / '+fmt.format(b.removed):'—';
 byId('export-csv').disabled=!(readyT||readyB||(['current','partial'].includes(snapshot?.quality)&&snapshot?.kind==='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'));
 const quality=readyT&&readyB?'访问与收藏数据已连接':readyT?'访问数据正常，收藏数据暂不可用':
  readyB?'收藏数据正常，访问数据暂不可用':'聚合数据暂不可用';
 byId('growth-quality').textContent=quality+' · '+(growth?.asOf?formatTime(growth.asOf):'数据未获取');
 byId('users-data-quality').textContent='数据质量：'+quality;
 byId('users-interval').textContent=growth?.period?growth.period.from+' 至 '+growth.period.today+' · UTC':'暂未取得统计区间';
 renderDailyPV('trend-chart',t?.series,readyT);
 renderDailyPV('users-chart',t?.series,readyT);
}
async function refreshGrowth(){
 const params=new URLSearchParams();
 if(selectedPeriod==='custom'){
  if(!customRange)return;
  params.set('from',customRange.from);params.set('to',customRange.to);
 }else params.set('days',selectedPeriod==='today'?'1':selectedPeriod.replace('d',''));
 try{
  const res=await fetch('./data/growth.json?'+params,{credentials:'same-origin',cache:'no-store'});
  if(res.status===401){void 0;return;}
  if(!res.ok)throw Error('PRIVATE_GROWTH_UNAVAILABLE');
  const data=await res.json();
  if(data.kind!=='HHBA_PRIVATE_GROWTH_V1'||!data.traffic||!data.bookmarks)throw Error('INVALID_GROWTH_PAYLOAD');
  growth=data;
 }catch{growth=null;}
 updateGrowth();
}

mountUnifiedWorkbench(setView);
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
 const fromDate=Date.parse(from+'T00:00:00Z'),toDate=Date.parse(to+'T00:00:00Z');
 if(!Number.isFinite(fromDate)||!Number.isFinite(toDate)||(toDate-fromDate)/86400000>89){alert.textContent='自定义日期最多支持 90 天';return}
 alert.textContent='';
 customRange={from,to};choosePeriod('custom');
});
byId('refresh').addEventListener('click',()=>{void refresh();void refreshGrowth();void refreshUnifiedWorkbench()});
byId('growth-open').addEventListener('click',()=>setView('users'));
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
