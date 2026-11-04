// HHBA ORIGINAL admin-preview console — existing GitHub Pages dashboard, Cloudflare data adapter.
// All remote content is restricted to the server's validated aggregate metrics.
const byId=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('zh-CN');
const formatTime=value=>{
 try{return new Date(value).toLocaleString('zh-CN',{
   timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',hour12:false
 })+'（北京时间）'}catch{return '—'}
};
const cloudflareMode=location.hostname==='hhba-talent.pages.dev'||location.hostname.endsWith('.hhba-talent.pages.dev')||location.hostname==='hhba.work';
let snapshot=null,growth=null,growthError=null,selectedPeriod='30d',customRange=null,activeView='overview';
function normalizeCloudflarePublic(raw){
 if(raw?.kind!=='HHBA_CLOUDFLARE_PUBLIC_METRICS_V1'||!raw.counts)throw Error('INVALID_CLOUDFLARE_JOB_DATA');
 return {kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2',quality:raw.quality,asOf:raw.sourceTime,
  auditCheckedAt:raw.auditCheckedAt,counts:raw.counts,
  definitions:{
   indexedJobs:'公开 ATS 索引总记录数，不等于有效在招',
   displayableJobs:raw.definitions?.displayableJobs||'已剔除撤下和失效后的展示记录',
   auditedJobRequirements:raw.definitions?.auditedJobRequirements||'官网完整岗位要求经核验',
   distinctIndexedCompanies:'去重后的索引企业数，非签约企业',
   checkedAtsSources:'官方来源审计数，非签约企业',
   failedAtsSources:'本次审计不成功的官方招聘来源数量'
  }};
}
function integer(x){return Number.isSafeInteger(x)&&x>=0?x:null}
function setMetric(id,n){const e=byId(id);if(e)e.textContent=integer(n)===null?'—':fmt.format(n)}
function renderTraffic(target,items){
 const root=byId(target);if(!root)return;
 if(!Array.isArray(items)){root.textContent='私有统计未授权或尚未采集';return}
 root.replaceChildren();
 const chart=document.createElement('div');chart.className='hhba-real-bars';const max=Math.max(1,...items.map(x=>x.pv||0));
 for(const item of items){
  const bar=document.createElement('span');
  bar.style.height=(item.pv?Math.max(5,Math.round(item.pv/max*100)):2)+'%';
  bar.title=item.day+'：'+item.pv+' 次';
  bar.setAttribute('aria-label',bar.title);chart.append(bar);
 }
 root.append(chart);
}
function percent(value){return typeof value==='number'&&Number.isFinite(value)?value.toFixed(1)+'%':'—'}
function accountValue(n){return integer(n)===null?'—':fmt.format(n)}
function showRealDataStatus(){
 const liveHost=location.hostname==='hhba.work'||location.hostname==='hhba-talent.pages.dev';
 const source=liveHost?'正式网站数据':'独立预览数据库';
 byId('workspace-mode').textContent=liveHost?'正式管理后台':'开发预览';
 byId('sidebar-environment').textContent=source;
 const state=growth?.account?.quality==='collected'?'管理员已验证 · 真实账号已接通':growth?'管理员已验证 · 部分指标待接入':growthError==='AUTH_REQUIRED'?'管理员尚未授权':growthError==='SERVICE_ERROR'?'私有统计服务不可用':'等待私有数据连接';
 byId('sidebar-account-state').textContent=state;
 byId('sidebar-data-state').textContent=state+'；仅展示汇总数据，不读取个人浏览记录';
 byId('top-access-state').textContent=state;
}
// Source-backed daily rows. A day before installation is unknown, not zero.
function buildDailyOperationsRows(report){
 const series=report?.traffic?.quality==='collected'&&Array.isArray(report.traffic.series)?report.traffic.series:null;
 const account=report?.account?.quality==='collected'?report.account:null;
 const signup=Array.isArray(account?.signupSeries)?account.signupSeries:null;
 if(!series||!report?.period)return null;
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
 const installed=report.collectorStartedAt;
 const earliest=typeof installed==='string'&&Number.isFinite(Date.parse(installed))?installed.slice(0,10):null;
 const signupMap=signup?new Map(signup.filter(x=>validDay(x.day)).map(x=>[x.day,integer(x.count)])):null;
 return series.filter(x=>validDay(x.day)).map(x=>{
  const collected=earliest!==null&&x.day>=earliest;
  const count=k=>collected?integer(x[k]):null;
  return {day:x.day,signup:signupMap?.has(x.day)?signupMap.get(x.day):null,
   pv:count('pv'),jobViews:count('jobViews'),searches:count('searches'),
   outboundClicks:count('outboundClicks'),collected};
 });
}
function renderDailyOperations(report){
 const root=byId('users-daily-rows'),status=byId('users-daily-status');
 if(!root||!status)return;
 const rows=buildDailyOperationsRows(report);
 root.replaceChildren();
 if(!rows){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;
  td.textContent='私有汇总数据不可用或未授权，不能显示真实明细';
  tr.append(td);root.append(tr);status.textContent='数据不可用';return;
 }
 const display=n=>integer(n)===null?'—':fmt.format(n);
 for(const item of [...rows].reverse()){
  const tr=document.createElement('tr');
  for(const value of [item.day,display(item.signup),item.collected?display(item.pv):'未采集',
   item.collected?display(item.jobViews):'未采集',item.collected?display(item.searches):'未采集',
   item.collected?display(item.outboundClicks):'未采集']){
   const td=document.createElement('td');td.textContent=value;tr.append(td);
  }
  root.append(tr);
 }
 status.textContent=rows.length+' 天 · '+(report.collectorStartedAt?'运营事件起始于 '+report.collectorStartedAt.slice(0,10):'运营事件采集时间尚未核实');
}
function updateGrowth(){
 showRealDataStatus();
 const t=growth?.traffic,b=growth?.devices,a=growth?.account,q=growth?.activity;
 setMetric('ov-pv',t?.quality==='collected'?t.pv:null);
 setMetric('growth-pv',t?.quality==='collected'?t.pv:null);
 setMetric('ov-saves',b?.quality==='collected'?b.savedJobs:null);
 setMetric('growth-uv',t?.quality==='collected'?t.dailyUvSum:null);
 setMetric('growth-saves',b?.quality==='collected'?b.savedJobs:null);
 setMetric('growth-devices',b?.quality==='collected'?b.devicesWithSavedJobs:null);
 setMetric('growth-views',t?.quality==='collected'?t.jobViews:null);
 setMetric('growth-search',t?.quality==='collected'?t.searches:null);
 setMetric('growth-click',t?.quality==='collected'?t.outboundClicks:null);
 const changes=byId('growth-changes');
 if(changes)changes.textContent=b?.quality==='collected'&&integer(b.added)!==null&&integer(b.removed)!==null?fmt.format(b.added)+' / '+fmt.format(b.removed):'—';
 setMetric('registered-users',a?.quality==='collected'?a.registeredUsers:null);
 byId('active-users').textContent=a?.quality==='collected'&&integer(a.dau)!==null&&integer(a.mau)!==null?fmt.format(a.dau)+' / '+fmt.format(a.mau):'— / —';
 byId('users-interval').textContent=growth?.period?growth.period.start+' 至 '+growth.period.end+' · UTC':'私有数据需要 Cloudflare Access 管理员授权';
 byId('users-data-quality').textContent=a?.quality==='collected'?'注册用户来自 PNVS 身份库；匿名访客和历史设备收藏单独统计，不混同账号人数。':growth?'Cloudflare D1 已接入匿名访问；真实注册库未连接。':growthError==='AUTH_REQUIRED'?'管理员验证未通过；请在受保护的 HHBA 管理域名完成 Cloudflare Access 登录。':growthError==='SERVICE_ERROR'?'统计服务暂不可用，请检查受保护 API、D1 绑定和管理员权限。':'私有数据等待连接；未接入不等于零。';
  setMetric('users-new-registrations',a?.quality==='collected'?a.newRegistered:null);
  byId('users-dau-wau').textContent=q?.quality==='collected'?accountValue(q.dau)+' / '+accountValue(q.wau):'— / —';
  setMetric('users-mau',q?.quality==='collected'?q.mau:null);
  const r=q?.quality==='collected'?q.firstSeenRetention:null;
  byId('users-d1').textContent=percent(r?.d1?.rate)+(r?.d1?.eligible?'（'+r.d1.returned+'/'+r.d1.eligible+'）':'');
  byId('users-d7').textContent=percent(r?.d7?.rate);
  for(const name of ['jobs','companies','policies','tools','job_save']){
   setMetric('users-area-'+name.replace('_','-'),q?.quality==='collected'?(q.areaUsers?.[name]||0):null);
  }
  setMetric('users-account-saves',a?.quality==='collected'?a.savedJobs:null);
 setMetric('users-total-accounts',a?.quality==='collected'?a.registeredUsers:null);
 setMetric('users-total-saves',a?.quality==='collected'?a.savedJobs:null);
 setMetric('users-accounts-with-saves',a?.quality==='collected'?a.accountsWithSavedJobs:null);
 const sourceStatus=byId('accounts-source-status');if(sourceStatus){sourceStatus.textContent=a?.quality==='collected'?'已核验':'未接通';sourceStatus.className='table-status '+(a?.quality==='collected'?'good':'waiting')}
 renderDailyOperations(growth);
  byId('users-account-start').textContent=q?.collectedFrom?formatTime(q.collectedFrom):'账号活动统计已停用或尚未配置';
  byId('users-account-quality').textContent=q?.quality==='collected'
   ?'账号 DAU/WAU/MAU 与首次活跃回访仅覆盖已同意统计的登录账号，不等于所有注册用户；留存以首次记录活跃日为起点。'
   :q?.quality==='not_collected'?'账号级活动采集已停用；不计算 DAU/WAU/MAU 或回访率，匿名访问量不能代替账号活跃。':'账号级活跃尚无可信记录，不显示模拟数据。';
  if(a?.quality==='collected'&&Array.isArray(a.signupSeries))renderTraffic('users-account-chart',a.signupSeries.map(x=>({day:x.day,pv:integer(x.count)||0})));
  else byId('users-account-chart').textContent='注册时间序列尚未连接，不显示虚假趋势';
  setMetric('investor-users',a?.quality==='collected'?a.registeredUsers:null);
 renderTraffic('users-chart',t?.quality==='collected'?t.series:null);
 if(t?.quality==='collected'){
  const trend=byId('trend-chart');if(trend){trend.className='chart-empty hhba-live-trend';renderTraffic('trend-chart',t.series)}
 }
}
async function refreshGrowth(){
 if(!cloudflareMode){growth=null;growthError='UNAVAILABLE';updateGrowth();return}
 const params=new URLSearchParams();
 if(selectedPeriod==='custom'){
  if(!customRange)return;
  params.set('from',customRange.from);params.set('to',customRange.to);
 }else params.set('days',selectedPeriod==='today'?'1':selectedPeriod.slice(0,-1));
 try{
  const r=await fetch('/admin-preview/api/metrics?'+params,{cache:'no-store',credentials:'same-origin'});
  if(!r.ok||!(r.headers.get('content-type')||'').includes('application/json')){
   growthError=[401,403].includes(r.status)?'AUTH_REQUIRED':'SERVICE_ERROR';
   throw Error('PRIVATE_METRICS_REQUIRE_AUTH');
  }
  const v=await r.json();
  if(v.kind!=='HHBA_CLOUDFLARE_PRIVATE_METRICS_V1'||!v.traffic||!v.devices||!v.account){growthError='SERVICE_ERROR';throw Error('INVALID_PRIVATE_METRICS')}
  growth=v;growthError=null;
 }catch{growth=null;if(!growthError)growthError='SERVICE_ERROR'}
 updateGrowth();
}

const titles={overview:'数据总览',users:'用户分析',market:'岗位与企业',operations:'运营监控',
 finance:'财务成本',investor:'融资展示',settings:'系统设置'};
const details={
 users:['真实用户注册与业务操作','账号级行为追踪已停止；注册和收藏来自真实数据库，页面事件仅计次数。'],
 market:['企业和岗位质量分析','未来接入岗位状态、ATS 来源及招聘质量报表；当前公开索引汇总在数据总览。'],
 operations:['系统运行与数据同步','未来接入有权限的同步队列和异常日志；当前预览不读取服务器私有日志。'],
 finance:['成本、收入与经营效率','未来接入经核对的收支台账和 API 成本；无记录时不生成模拟营收。'],
 settings:['后台权限和统计配置','接入登录系统后，启用管理员 RBAC、投资人只读访问及指标口径管理。']
};
function setView(view){
 if(!Object.hasOwn(titles,view))view='overview';
 activeView=view;
 for(const node of document.querySelectorAll('.page-view'))node.hidden=true;
 byId('view-'+(['investor','overview','users'].includes(view)?view:'placeholder')).hidden=false;
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
  '范围无关；匿名访问、账号功能分类和新注册按所选区间查询，DAU/WAU/MAU 始终按今日滚动窗口。';
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
 byId('export-csv').disabled=!valid;
}
async function refresh(){
 const btn=byId('refresh');
 btn.disabled=true;
 btn.setAttribute('aria-busy','true');
 btn.lastChild.textContent=' 正在核对…';
 try{
  const response=cloudflareMode
   ?await fetch('/api/metrics/public',{method:'GET',cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}})
   :await fetch('/api/overview',{method:'GET',cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('index_not_available');
  const raw=await response.json();const body=cloudflareMode?normalizeCloudflarePublic(raw):raw;
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
// Investor exports must reconcile with the protected aggregation API, not stale placeholders.
// Every row is aggregate-only; absent authorization or missing fields remain unavailable.
function buildVerifiedInvestorRows(data,report){
 const whole=n=>Number.isSafeInteger(n)&&n>=0;
 const value=n=>whole(n)?String(n):'未采集或未授权';
 const sourceTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t))?t:'';
 const account=report?.account?.quality==='collected'?report.account:null;
 const activity=report?.activity?.quality==='collected'?report.activity:null;
 const traffic=report?.traffic?.quality==='collected'?report.traffic:null;
 const devices=report?.devices?.quality==='collected'?report.devices:null;
 const privateTime=sourceTime(report?.asOf);
 const range=report?.period&&/^\d{4}-\d{2}-\d{2}$/.test(report.period.start||'')&&
   /^\d{4}-\d{2}-\d{2}$/.test(report.period.end||'')
   ?report.period.start+' 至 '+report.period.end+'（UTC）':'所选时间范围';
 const retention=entry=>{
  if(!activity||!entry||!whole(entry.eligible)||!whole(entry.returned))return '未采集或未授权';
  if(entry.eligible===0)return '样本不足';
  if(typeof entry.rate!=='number'||!Number.isFinite(entry.rate)||entry.returned>entry.eligible)return '未采集或未授权';
  return entry.rate.toFixed(2)+'%（'+entry.returned+'/'+entry.eligible+'）';
 };
 return [
  ['HHBA 融资只读数据快照','指标值','统计口径','来源时间（ISO 8601）'],
  ['公开索引记录',value(data.counts.indexedJobs),data.definitions.indexedJobs,sourceTime(data.asOf)],
  ['可展示记录',value(data.counts.displayableJobs),data.definitions.displayableJobs,sourceTime(data.asOf)],
  ['已核验官网任职要求',value(data.counts.auditedJobRequirements),data.definitions.auditedJobRequirements,sourceTime(data.auditCheckedAt)],
  ['去重收录企业',value(data.counts.distinctIndexedCompanies),data.definitions.distinctIndexedCompanies,sourceTime(data.asOf)],
  ['已审计 ATS 来源',value(data.counts.checkedAtsSources),data.definitions.checkedAtsSources,sourceTime(data.auditCheckedAt)],
  ['失败 ATS 来源',value(data.counts.failedAtsSources),data.definitions.failedAtsSources,sourceTime(data.auditCheckedAt)],
  ['累计真实求职者账号',value(account?.registeredUsers),'Cloudflare PNVS 真实 candidate 账户总数；不等于活跃人数',account?privateTime:''],
  ['区间新增求职者',value(account?.newRegistered),'PNVS 真实注册时间，'+range,account?privateTime:''],
  ['账号当前收藏岗位数',value(account?.savedJobs),'Cloudflare PNVS 真实账号收藏关系总数；当前快照，与日期筛选无关',account?privateTime:''],
  ['有账号收藏的求职者',value(account?.accountsWithSavedJobs),'具有至少一条真实账号收藏关系的去重求职者数',account?privateTime:''],
  ['账号 DAU',value(activity?.dau),'UTC 今日去重活跃；旧版经同意的账号活动；已停采新记录',activity?privateTime:''],
  ['账号 WAU',value(activity?.wau),'截至 UTC 今日，最近 7 天去重活跃；旧版经同意的账号活动；已停采新记录',activity?privateTime:''],
  ['账号 MAU',value(activity?.mau),'截至 UTC 今日，最近 30 天去重活跃；仅已同意统计账号',activity?privateTime:''],
  ['区间授权活跃账号',value(activity?.periodActive),'旧版经同意的账号功能使用去重（已停采），'+range,activity?privateTime:''],
  ['首次活跃次日回访率',retention(activity?.firstSeenRetention?.d1),'以首次记录的同意活跃日为基准，不是注册次日留存；括号为回访/成熟样本',activity?privateTime:''],
  ['首次活跃第七日回访率',retention(activity?.firstSeenRetention?.d7),'以首次记录的同意活跃日为基准，不是注册七日留存；括号为回访/成熟样本',activity?privateTime:''],
  ['页面访问事件 PV',value(traffic?.pv),'Cloudflare D1 不关联账号或访客标识的事件次数，不等于 UV，'+range,traffic?privateTime:''],
  ['设备有效收藏',value(devices?.savedJobs),'Cloudflare D1 设备级收藏；不是登录账号收藏，不应相加',devices?privateTime:''],
  ['真实收入','未接入','未接入可核验财务台账，不以岗位、访问或收藏估算收入','']
 ];
}
function exportCSV(){
 const data=snapshot;
 if(!data||!['current','partial'].includes(data.quality)||data.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2')return;
 const rows=buildVerifiedInvestorRows(data,growth);
 // Prevent spreadsheet formula injection from a compromised upstream description.
 const csv='\uFEFF'+rows.map(row=>row.map(cell=>{
  const raw=String(cell??'');
  const safe=/^\s*[=+\-@]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replaceAll('"','""')+'"';
 }).join(',')).join('\r\n');
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
 const diff=(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000;
 if(!Number.isInteger(diff)||diff>89){alert.textContent='自定义范围最多 90 天';return}
 alert.textContent='';
 customRange={from,to};choosePeriod('custom');
});
byId('refresh').addEventListener('click',()=>{void refresh();void refreshGrowth()});
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
choosePeriod('30d');updateOverview();updateGrowth();void refresh();
