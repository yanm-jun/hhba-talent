// HHBA operating cockpit. Read-only, manual loads, REAL source data only.
const q=id=>document.getElementById(id);
const num=new Intl.NumberFormat('zh-CN');
const amount=new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2});
const isCount=n=>Number.isSafeInteger(n)&&n>=0;
const formatCount=n=>isCount(n)?num.format(n):'—';
const formatMoney=n=>Number.isSafeInteger(n)?amount.format(n/100):'—';
const ns='http://www.w3.org/2000/svg';
let selectedDays=30,busy=false,sequence=0;

function element(tag,attributes={},value){
 const e=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));
 if(value!==undefined)e.textContent=String(value);
 return e;
}
function setValue(id,value){q(id).textContent=value}
function setText(id,value){q(id).textContent=String(value||'')}
function empty(id,text){
 const root=q(id);
 root.replaceChildren();
 const p=document.createElement('p');p.className='hhba-cc-graph-empty';p.textContent=text;
 root.append(p);
}
function drawLine(id,values,{suffix='',digits=0,secondary=null}={}){
 const root=q(id);root.replaceChildren();
 if(!Array.isArray(values)||values.length===0||!values.some(x=>Number.isFinite(x?.value))){
  empty(id,'无可核验的历史数据；不会补造趋势');return;
 }
 const W=680,H=210,pad={left:55,right:18,top:20,bottom:33};
 const usableW=W-pad.left-pad.right,usableH=H-pad.top-pad.bottom;
 const measured=values.map(x=>Number.isFinite(x?.value)?x.value:null);
 const companion=Array.isArray(secondary)&&secondary.length===values.length?
  secondary.map(x=>Number.isFinite(x?.value)?x.value:null):null;
 const eligible=[...measured,...(companion||[])].filter(x=>x!==null);
 const min=Math.min(0,...eligible);
 const max=Math.max(1,...eligible);
 const range=max-min||1;
 const x=i=>pad.left+(values.length===1?usableW/2:usableW*i/(values.length-1));
 const y=v=>pad.top+(max-v)*usableH/range;
 const svg=element('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'真实业务数据趋势，不展示缺失日期的数据',preserveAspectRatio:'xMidYMid meet'});
 const g=element('g');
 for(let i=0;i<=3;i++){
  const v=min+range*i/3,yy=y(v);
  g.append(element('line',{x1:pad.left,y1:yy,x2:W-pad.right,y2:yy,stroke:'#e4ece8','stroke-dasharray':'3 4'}));
  g.append(element('text',{x:pad.left-8,y:yy+4,'text-anchor':'end',fill:'#7b8e87','font-size':11},digits?String(v.toFixed(digits)):num.format(Math.round(v))));
 }
 svg.append(g);
 const line=element('path',{fill:'none',stroke:'#237655','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'});
 const makePath=series=>{
  let path='',open=false;
  for(let i=0;i<series.length;i++){
   const v=series[i];
   if(v===null){open=false;continue}
   path+=(open?' L':' M')+x(i).toFixed(2)+' '+y(v).toFixed(2);
   open=true;
  }
  return path.trim();
 };
 line.setAttribute('d',makePath(measured));svg.append(line);
 if(companion){
  const secondLine=element('path',{d:makePath(companion),fill:'none',stroke:'#d18f45','stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round'});
  svg.append(secondLine);
 }
 for(let i=0;i<measured.length;i++){
  if(measured[i]===null)continue;
  if(values.length<=32||i===values.length-1){
   const c=element('circle',{cx:x(i),cy:y(measured[i]),r:values.length>32?2.3:3,fill:'#237655'});
   c.append(element('title',{},values[i].label+'：'+(digits?measured[i].toFixed(digits):num.format(measured[i]))+suffix));
   svg.append(c);
  }
 }
 const indices=[0,Math.floor((values.length-1)/2),values.length-1];
 for(const i of [...new Set(indices)]){
  svg.append(element('text',{x:x(i),y:H-8,'text-anchor':i===0?'start':i===values.length-1?'end':'middle',fill:'#819089','font-size':11},values[i].label.slice(5)));
 }
 root.append(svg);
 if(companion){
  const legend=document.createElement('p');legend.className='hhba-cc-finance-legend';
  legend.textContent='● 营业收入（绿色）     ● 经营结果（橙色）';root.append(legend);
 }
 const foot=document.createElement('p');
 foot.className='hhba-cc-chart-foot';
 const valid=measured.filter(v=>v!==null).length;
 foot.textContent='已核验 '+valid+' / '+values.length+' 个时间点'+(valid<values.length?' · 缺失日期不补零':'');
 root.append(foot);
}
function parseMetrics(result){
 if(result?.kind!=='HHBA_CLOUDFLARE_PRIVATE_METRICS_V1')throw Error('统计接口返回格式不符合要求');
 const acc=result.account,tr=result.traffic;
 if(acc?.quality==='collected'){
  setValue('cc-registered',formatCount(acc.registeredUsers));
  setValue('cc-signups',formatCount(acc.newRegistered));
 }
 if(tr?.quality==='collected'){
  setValue('cc-searches',formatCount(tr.searches));
  setValue('cc-clicks',formatCount(tr.outboundClicks));
  setValue('cc-pv',formatCount(tr.pv));
  setValue('cc-job-views',formatCount(tr.jobViews));
 }
 if(acc?.quality==='collected'&&Array.isArray(acc.signupSeries)){
  drawLine('cc-chart-signups',acc.signupSeries.map(r=>({
   label:r.day,value:isCount(r.count)?r.count:null
  })));
 }else empty('cc-chart-signups','注册记录未连接或历史汇总不可用');
 const series=tr?.quality==='collected'&&Array.isArray(tr.series)?tr.series:null;
 const collector=typeof result.collectorStartedAt==='string'?result.collectorStartedAt.slice(0,10):null;
 if(series&&collector){
  const map=(field)=>series.map(r=>({label:r.day,
   value:r.day>=collector&&isCount(r[field])?r[field]:null}));
  drawLine('cc-chart-search',map('searches'));
  drawLine('cc-chart-pv',map('pv'));
 }else{
  empty('cc-chart-search','尚无可确认采集起点的搜索事件');
  empty('cc-chart-pv','尚无可确认采集起点的访问事件');
 }
 return result;
}
const monthStart=s=>new Date(s+'-01T00:00:00Z');
function monthlySeries(months,key){
 if(!Array.isArray(months)||!months.length)return [];
 const valid=months.filter(m=>/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(m.period)).sort((a,b)=>a.period.localeCompare(b.period));
 if(!valid.length)return [];
 const latest=monthStart(valid.at(-1).period),earliest=monthStart(valid[0].period);
 const start=new Date(Math.max(earliest.getTime(),Date.UTC(latest.getUTCFullYear(),latest.getUTCMonth()-23,1)));
 const map=new Map(valid.map(m=>[m.period,m]));
 const out=[];
 for(let t=start.getTime();t<=latest.getTime();){
  const d=new Date(t),period=d.toISOString().slice(0,7),r=map.get(period),v=r?.[key];
  out.push({label:period,value:Number.isSafeInteger(v)?v/100:null});
  t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
 }
 return out;
}
function parseOperations(result){
 if(result?.kind!=='HHBA_PRIVATE_OPERATIONS_COCKPIT_V1'||!result?.ok)throw Error('经营接口数据校验失败');
 const r=result.finance?.latest,quality=result.finance?.quality;
 if(quality==='published_only'&&r){
  setValue('cc-revenue',formatMoney(r.revenueFen));
  setValue('cc-profit',formatMoney(r.netResultFen));
  setValue('cc-ai-cost',formatMoney(r.aiCostFen));
  setText('cc-revenue-source',r.period+' 已公开的月报收入（非今日实收）');
  setText('cc-profit-source',r.period+' 已公开经营结果（非可分配利润）');
  drawLine('cc-chart-finance',monthlySeries(result.finance.months,'revenueFen'),{suffix:' 元',digits:2,
   secondary:monthlySeries(result.finance.months,'netResultFen')});
 }else{
  empty('cc-chart-finance',quality==='no_published_report'?
   '目前没有已正式发布的月报；不能把草稿或无记录显示为零收入':
   '财务报表尚未连接或读取失败');
  setText('cc-revenue-source',quality==='no_published_report'?'尚无已公开月报':'财务数据暂不可用');
 }
 const pilot=result.externalDiscovery;
 if(pilot?.quality==='partial_scope'){
  setValue('cc-discoveries',formatCount(pilot.total));
  setText('cc-ai-quality','已读取仅限外部岗位发现功能的配额日志。AI 推荐总次数、成功率、平均响应耗时与实际模型费用均尚未完整采集；本期外部探索请求 '+formatCount(pilot.total)+' 次，不能拿它计算 AI 成功率。');
 }else setText('cc-ai-quality','外部搜索配额记录暂不可用；全部 AI 匹配成功率、延迟与实际成本也尚无完整可核验的统计来源。');
 const payment=result.payment;
 if(payment?.quality==='verified_paid_apply_orders_only')
  setText('cc-payment-quality','已核验代投次数包支付订单 '+formatCount(payment.orderCount)+' 笔，支付总额 '+formatMoney(payment.paidFen)+'。仅覆盖该产品，不代表全部 HHBA 营业收入；退款和其他支付渠道另行对账。');
 else setText('cc-payment-quality',payment?.quality==='not_connected'?
  '正式收款账本尚未接入或原订单表未部署；不能依据产品定价、访问量或购买意向推算平台收益。':
  '支付账本读取失败或尚未完成对账，实收数据不展示；已公开月报金额与订单收款不是同一个口径。');
}
async function load(){
 if(busy)return;
 busy=true;const requestId=++sequence;
 q('cc-load').disabled=true;setText('cc-state','正在读取受保护的真实统计……');
 for(const id of ['cc-registered','cc-signups','cc-searches','cc-clicks','cc-pv','cc-job-views','cc-revenue','cc-profit','cc-ai-cost','cc-discoveries'])setValue(id,'—');
 const ac=new AbortController();const timeout=setTimeout(()=>ac.abort(),20000);
 try{
  const [metric,financial]=await Promise.allSettled([
   fetch('/admin-preview/api/metrics?days='+selectedDays,{cache:'no-store',credentials:'same-origin',signal:ac.signal})
    .then(async r=>{if(!r.ok)throw Error('用户统计 HTTP '+r.status);return parseMetrics(await r.json())}),
   fetch('/admin-preview/api/command-center?days='+selectedDays,{cache:'no-store',credentials:'same-origin',signal:ac.signal})
    .then(async r=>{if(!r.ok)throw Error('经营统计 HTTP '+r.status);return parseOperations(await r.json())})
  ]);
  if(requestId!==sequence)return;
  const ok=(metric.status==='fulfilled'?1:0)+(financial.status==='fulfilled'?1:0);
  if(metric.status==='rejected'){
   for(const id of ['cc-chart-signups','cc-chart-search','cc-chart-pv'])empty(id,'统计接口不可用，请检查登录与 D1 绑定');
  }
  if(financial.status==='rejected')empty('cc-chart-finance','财务与外部探索接口不可用；金额不展示');
  setText('cc-state',ok===2?
   '真实数据已读取 · 时间口径 UTC · 数据源：账号、匿名事件、已公开月报及外部探索配额；各指标口径见下方说明。':
   ok===1?'部分数据源可用；未能读取的指标保持「—」，请检查后台权限或数据绑定。':
   '全部私有统计接口暂不可用。请检查管理员登录、D1 读取额度和 API 服务。');
 }finally{
  clearTimeout(timeout);busy=false;q('cc-load').disabled=false;
 }
}
document.querySelectorAll('[data-cc-days]').forEach(btn=>btn.addEventListener('click',()=>{
 const days=Number(btn.dataset.ccDays);
 if(![7,30,90].includes(days)||busy)return;
 selectedDays=days;
 document.querySelectorAll('[data-cc-days]').forEach(x=>{
  const active=x===btn;x.classList.toggle('is-selected',active);x.setAttribute('aria-pressed',String(active));
 });
 void load();
}));
q('cc-load')?.addEventListener('click',()=>void load());
q('cc-open-finance')?.addEventListener('click',()=>{
 document.querySelector('[data-view="finance"]')?.click();
});

// The authenticated admin homepage must not open with eight placeholder values.
// Exactly one bounded 30-day aggregate read runs at initial load; switching date
// ranges or pressing Refresh is an explicit user action. No polling or background timer.
if(q('hhba-command-center'))void load();
