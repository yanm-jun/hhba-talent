// HHBA operating cockpit. Read-only, manual loads, REAL source data only.
const q=id=>document.getElementById(id);
const num=new Intl.NumberFormat('zh-CN');
const amount=new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2});
const isCount=n=>Number.isSafeInteger(n)&&n>=0;
const formatCount=n=>isCount(n)?num.format(n):'—';
const formatMoney=n=>Number.isSafeInteger(n)?amount.format(n/100):'—';
const ns='http://www.w3.org/2000/svg';
let selectedDays=30,busy=false,sequence=0;
let lastPVSeries=null,pvDetail=false;

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
// Keep the vertical scale honest: count charts must never display 0,0,1,1.
// For published money, allow decimals and negative operating results.
function niceTicks(low,high,digits=0){
 if(low===0&&high===0)return {ticks:[0],low:-1,high:1,zeroOnly:true};
 const raw=Math.max(0.00000001,(high-low)/4);
 const pow=Math.pow(10,Math.floor(Math.log10(raw)));
 let step=([1,2,2.5,5,10].find(v=>v*pow>=raw)||10)*pow;
 if(digits===0)step=Math.max(1,step);
 if(digits>0)step=Math.max(0.01,step);
 let first=Math.floor(low/step)*step,last=Math.ceil(high/step)*step;
 // Bound SVG gridlines, including when money has negative values.
 while(Math.round((last-first)/step)>7){
  step*=2;first=Math.floor(low/step)*step;last=Math.ceil(high/step)*step;
 }
 const n=Math.max(1,Math.min(8,Math.round((last-first)/step)));
 const ticks=Array.from({length:n+1},(_,i)=>Number((first+i*step).toFixed(8)));
 return {ticks,low:first,high:last,zeroOnly:false};
}
function numberLabel(n,digits=0){
 return new Intl.NumberFormat('zh-CN',{
  minimumFractionDigits:0,maximumFractionDigits:digits?2:0
 }).format(n);
}
function fullDate(label){
 if(/^\d{4}-\d{2}-\d{2}$/.test(label))
  return label.slice(0,4)+'年'+label.slice(5,7)+'月'+label.slice(8,10)+'日 · UTC';
 if(/^\d{4}-\d{2}$/.test(label))
  return label.slice(0,4)+'年'+label.slice(5,7)+'月';
 return String(label);
}
function showNumber(value,digits,unit){
 if(!Number.isFinite(value))return '未采集';
 return digits>0?'¥'+numberLabel(value,2):numberLabel(value)+' '+unit;
}
function drawLine(id,values,{suffix='',digits=0,secondary=null,unit='次',scale='linear'}={}){
 const root=q(id);
 root.replaceChildren();
 if(!Array.isArray(values)||!values.length||!values.some(v=>Number.isFinite(v?.value))){
  empty(id,'尚无已核验的历史记录。缺失不等于零。');return;
 }
 const W=680,H=220,pad={left:58,right:17,top:19,bottom:34};
 const usableW=W-pad.left-pad.right,usableH=H-pad.top-pad.bottom;
 const measured=values.map(v=>Number.isFinite(v?.value)?v.value:null);
 const companion=Array.isArray(secondary)&&secondary.length===values.length?
  secondary.map(v=>Number.isFinite(v?.value)?v.value:null):null;
 const eligible=[...measured,...(companion||[])].filter(v=>v!==null);
 const lo=Math.min(0,...eligible),hi=Math.max(0,...eligible);
 const bounds=niceTicks(lo,hi,digits);
 const transform=v=>scale==='sqrt'&&digits===0?Math.sign(v)*Math.sqrt(Math.abs(v)):v;
 const tLo=transform(bounds.low),tHi=transform(bounds.high);
 const tRange=tHi-tLo||1;
 const x=i=>pad.left+(values.length===1?usableW/2:usableW*i/(values.length-1));
 const y=value=>pad.top+(tHi-transform(value))*usableH/tRange;
 const svg=element('svg',{
  viewBox:'0 0 '+W+' '+H,role:'img',tabindex:'0',
  'aria-label':'真实历史数据交互曲线。鼠标移动或键盘左右方向键查看准确日期和数值；未采集日期不补零',
  preserveAspectRatio:'xMidYMid meet'
 });
 const title=element('title',{},'历史趋势图 · '+values.length+'个日期，可用鼠标、触摸或方向键检查');
 svg.append(title);
 const grid=element('g');
 for(const tick of bounds.ticks){
  const yy=y(tick);
  grid.append(element('line',{x1:pad.left,y1:yy,x2:W-pad.right,y2:yy,
   stroke:tick===0?'#B9D1EF':'#E7F0FC','stroke-width':tick===0?1.2:1,
   'stroke-dasharray':tick===0?'0':'3 4'}));
  grid.append(element('text',{x:pad.left-9,y:yy+4,'text-anchor':'end',
   fill:'#6B86A5','font-size':11},numberLabel(tick,digits)));
 }
 svg.append(grid);
 const makePath=series=>{
  let d='',open=false;
  for(let i=0;i<series.length;i++){
   const v=series[i];
   if(v===null){open=false;continue}
   d+=(open?' L':' M')+x(i).toFixed(2)+' '+y(v).toFixed(2);
   open=true;
  }
  return d.trim();
 };
 // A light gradient adds depth without covering or fabricating data points.
 const primary=element('path',{d:makePath(measured),fill:'none',
  stroke:'#125EBC','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'});
 svg.append(primary);
 if(companion){
  svg.append(element('path',{d:makePath(companion),fill:'none',
   stroke:'#d18f45','stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round'}));
 }
 for(let i=0;i<measured.length;i++){
  if(measured[i]===null||(values.length>32&&i!==values.length-1))continue;
  const dot=element('circle',{cx:x(i),cy:y(measured[i]),r:values.length>32?2.5:3.2,
   fill:'#fff',stroke:'#125EBC','stroke-width':2});
  dot.append(element('title',{},fullDate(values[i].label)+' · '+showNumber(measured[i],digits,unit)));
  svg.append(dot);
 }
 for(const i of [...new Set([0,Math.floor((values.length-1)/2),values.length-1])]){
  svg.append(element('text',{x:x(i),y:H-8,
   'text-anchor':i===0?'start':i===values.length-1?'end':'middle',
   fill:'#6B86A5','font-size':11},String(values[i].label).slice(5)));
 }
 const cursor=element('line',{x1:0,y1:pad.top,x2:0,y2:H-pad.bottom,
  stroke:'#6B86A5','stroke-width':1.4,'stroke-dasharray':'4 4',visibility:'hidden'});
 const horizontal=element('line',{x1:pad.left,y1:0,x2:W-pad.right,y2:0,
  stroke:'#6B86A5','stroke-width':1,'stroke-dasharray':'2 4',visibility:'hidden'});
 const primaryDot=element('circle',{r:5,fill:'#fff',stroke:'#125EBC','stroke-width':2.8,visibility:'hidden'});
 const secondaryDot=element('circle',{r:5,fill:'#fff',stroke:'#d18f45','stroke-width':2.8,visibility:'hidden'});
 svg.append(cursor,horizontal,primaryDot,secondaryDot);
 const stage=document.createElement('div');stage.className='hhba-cc-plot';
 const tooltip=document.createElement('div');tooltip.className='hhba-cc-tooltip';
 tooltip.id=id+'-tooltip';tooltip.setAttribute('role','status');tooltip.hidden=true;
 svg.setAttribute('aria-describedby',tooltip.id);
 stage.append(svg,tooltip);root.append(stage);
 const show=i=>{
  const index=Math.max(0,Math.min(values.length-1,i));
  const v=measured[index],other=companion?.[index]??null;
  cursor.setAttribute('x1',x(index));cursor.setAttribute('x2',x(index));
  cursor.setAttribute('visibility','visible');
  const mark=(dot,value)=>{
   dot.setAttribute('visibility',value===null?'hidden':'visible');
   if(value!==null){dot.setAttribute('cx',x(index));dot.setAttribute('cy',y(value));}
  };
  mark(primaryDot,v);
  mark(secondaryDot,other);
  const lineY=v!==null?y(v):other!==null?y(other):null;
  horizontal.setAttribute('visibility',lineY===null?'hidden':'visible');
  if(lineY!==null){horizontal.setAttribute('y1',lineY);horizontal.setAttribute('y2',lineY);}
  tooltip.replaceChildren();
  const date=document.createElement('strong');date.className='hhba-cc-tooltip-date';
  date.textContent=fullDate(values[index].label);tooltip.append(date);
  const addRow=(name,value,color)=>{
   const row=document.createElement('div');row.className='hhba-cc-tooltip-row';
   const label=document.createElement('span');label.className='hhba-cc-tooltip-label';
   const dot=document.createElement('i');dot.className='hhba-cc-tooltip-dot';dot.style.backgroundColor=color;
   label.append(dot,document.createTextNode(name));
   const number=document.createElement('b');number.textContent=showNumber(value,digits,unit);
   row.append(label,number);tooltip.append(row);
  };
  addRow(companion?'营业收入':'当日数据',v,'#125EBC');
  if(companion)addRow('经营结果',other,'#d18f45');
  const rect=stage.getBoundingClientRect();
  const boxW=Math.max(1,rect.width),boxH=Math.max(1,rect.height);
  tooltip.style.left=Math.min(boxW-75,Math.max(75,(x(index)/W)*boxW))+'px';
  tooltip.style.top=Math.max(102,Math.min(boxH-8,(lineY===null?pad.top+80:lineY)/H*boxH))+'px';
  tooltip.hidden=false;
 };
 const hide=()=>{
  tooltip.hidden=true;
  cursor.setAttribute('visibility','hidden');
  horizontal.setAttribute('visibility','hidden');
  primaryDot.setAttribute('visibility','hidden');
  secondaryDot.setAttribute('visibility','hidden');
 };
 const indexForPointer=event=>{
  const rect=svg.getBoundingClientRect();
  const px=(event.clientX-rect.left)/Math.max(1,rect.width)*W;
  return values.length===1?0:Math.round((px-pad.left)/usableW*(values.length-1));
 };
 svg.addEventListener('pointermove',event=>show(indexForPointer(event)));
 svg.addEventListener('pointerdown',event=>show(indexForPointer(event)));
 svg.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')hide();});
 let keyboardIndex=Math.max(0,measured.findLastIndex(v=>v!==null));
 svg.addEventListener('focus',()=>show(keyboardIndex));
 svg.addEventListener('blur',hide);
 svg.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;
  event.preventDefault();
  if(event.key==='Escape'){hide();return;}
  if(event.key==='Home')keyboardIndex=0;
  else if(event.key==='End')keyboardIndex=values.length-1;
  else keyboardIndex=Math.max(0,Math.min(values.length-1,
   keyboardIndex+(event.key==='ArrowRight'?1:-1)));
  show(keyboardIndex);
 });
 if(companion){
  const legend=document.createElement('p');legend.className='hhba-cc-finance-legend';
  legend.textContent='● 营业收入（绿色）     ● 经营结果（橙色）';
  root.append(legend);
 }
 const valid=measured.filter(v=>v!==null);
 const lastIndex=measured.findLastIndex(v=>v!==null);
 const maxValue=Math.max(...valid);
 const maxIndex=measured.findIndex(v=>v===maxValue);
 const stats=document.createElement('div');stats.className='hhba-cc-chart-stats';
 const metric=(label,value)=>{
  const item=document.createElement('span');
  const k=document.createElement('b');k.textContent=label+' ';
  item.append(k,document.createTextNode(value));stats.append(item);
 };
 if(companion){
  metric('已公布',valid.length+' 期');
  metric('最新月报',fullDate(values[lastIndex].label));
  if(Number.isFinite(measured[lastIndex]))metric('本期收入',showNumber(measured[lastIndex],digits,unit));
 }else{
  const sum=valid.reduce((a,v)=>a+v,0);
  metric('区间合计',showNumber(sum,digits,unit));
  metric('峰值',showNumber(maxValue,digits,unit)+' · '+fullDate(values[maxIndex].label).split(' · ')[0]);
  metric('日均',numberLabel(sum/valid.length,2)+' '+unit);
 }
 root.append(stats);
 const foot=document.createElement('p');foot.className='hhba-cc-chart-foot';
 const count=valid.length;
 foot.textContent='已核验 '+count+' / '+values.length+' 个时间点'+(count<values.length?' · 缺失日期不补零':'')
  +(bounds.zeroOnly?' · 本区间均为已确认的 0':'')
  +(scale==='sqrt'?' · 平方根刻度仅压缩高峰视觉高度，提示框始终为原始真实数值':'')
  +' · 鼠标悬停、触摸或键盘方向键查看明细';
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
  lastPVSeries=map('pv');
  const pvButton=q('cc-pv-detail');
  if(pvButton)pvButton.disabled=false;
  drawLine('cc-chart-pv',lastPVSeries,{scale:pvDetail?'sqrt':'linear'});
 }else{
  lastPVSeries=null;
  const pvButton=q('cc-pv-detail');if(pvButton)pvButton.disabled=true;
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
q('cc-pv-detail')?.addEventListener('click',()=>{
 if(!lastPVSeries)return;
 pvDetail=!pvDetail;
 const button=q('cc-pv-detail');
 button.setAttribute('aria-pressed',String(pvDetail));
 button.textContent=pvDetail?'恢复线性刻度':'观察低值细节';
 drawLine('cc-chart-pv',lastPVSeries,{scale:pvDetail?'sqrt':'linear'});
});
q('cc-open-finance')?.addEventListener('click',()=>{
 document.querySelector('[data-view="finance"]')?.click();
});

// The authenticated admin homepage must not open with eight placeholder values.
// Exactly one bounded 30-day aggregate read runs at initial load; switching date
// ranges or pressing Refresh is an explicit user action. No polling or background timer.
if(q('hhba-command-center'))void load();
