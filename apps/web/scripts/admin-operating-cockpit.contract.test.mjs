import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {privateFinanceSnapshot,externalDiscoverySnapshot,onRequestGet} from '../functions/admin-preview/api/command-center.js';

const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('income curve uses only published, immutable monthly financial snapshots',()=>{
 const published=(month,overrides={})=>({
  period:month,status:'published',revision:1,published_at:month+'-25T12:00:00Z',
  published_json:JSON.stringify({revenueFen:17000,refundFen:1000,
   netResultFen:-4000,distributableProfitFen:0,poolAccrualFen:0,
   aiCostFen:600,operationsFen:1000,...overrides})
 });
 const privateDraft={period:'2026-11',status:'draft',revision:0,
  published_json:JSON.stringify({revenueFen:9900000,netResultFen:8800000})};
 const publishedRows=[published('2026-10'),privateDraft,published('2026-09',{revenueFen:0,netResultFen:0})];
 const snapshot=privateFinanceSnapshot(publishedRows);
 assert.equal(snapshot.quality,'published_only');
 assert.deepEqual(snapshot.months.map(x=>x.period),['2026-09','2026-10']);
 assert.equal(snapshot.latest.revenueFen,17000);
 assert.equal(snapshot.latest.netResultFen,-4000);
 assert.equal(snapshot.months[0].revenueFen,0,'A genuinely published zero is valid');
 assert.equal(snapshot.months.some(x=>x.revenueFen===9900000),false);
 assert.equal(snapshot.months[0].distributableProfitFen,0);
 assert.equal(snapshot.months[1].aiCostFen,600);
 assert.deepEqual(privateFinanceSnapshot([]),{
  quality:'no_published_report',latest:null,months:[],
  scope:'仅人工审核并公开的历史月报；当前未结束月份及草稿不参与核算'
 });
});

test('external exploration quota records do not claim all AI success rates or cost',()=>{
 const result=externalDiscoverySnapshot([
  {day_utc:'2026-11-15',n:3},{day_utc:'2026-11-16',n:0},
  {day_utc:'2026-11-17',n:'2'},{day_utc:'bad',n:4},{day_utc:'2026-11-16',n:-5}
 ]);
 assert.equal(result.quality,'partial_scope');
 assert.equal(result.total,5);
 assert.equal(result.byDay.length,3);
 assert.equal(result.successRate,null);
 assert.equal(result.avgLatencyMs,null);
 assert.equal(result.costFen,null);
 assert.match(result.scope,/不包含全部简历匹配/);
});

test('cockpit route denies anonymous requests before any database reads',async()=>{
 const db={prepare(){throw new Error('unsafe access attempted')}};
 const res=await onRequestGet({
  request:new Request('https://admin.hhba.work/admin-preview/api/command-center?days=30'),
  env:{HHBA_FINANCE_ADMIN_EMAIL:'finance-admin@example.invalid',
   HHBA_TRANSPARENCY_DB:db,HHBA_PNVS_AUTH_DB:db}
 });
 assert.notEqual(res.status,200);
});

test('cockpit UI reuses the ONLY private admin and never invents revenue, successful placements or account UV',()=>{
 const html=source('../../admin-preview/index.html');
 const js=source('../../admin-preview/command-center.js');
 const css=source('../../admin-preview/command-center.css');
 const builder=source('./build-standalone-admin.py');
 const api=source('../functions/admin-preview/api/command-center.js');
 assert.match(html,/id="hhba-command-center"/);
 assert.match(html,/id="cc-chart-signups"/);
 assert.match(html,/id="cc-chart-search"/);
 assert.match(html,/id="cc-chart-pv"/);
 assert.match(html,/id="cc-chart-finance"/);
 assert.match(html,/data-cc-days="90"/);
 assert.match(html,/id="cc-ai-cost"/);
 assert.match(html,/id="cc-revenue"/);
 assert.match(html,/class="hhba-cc-legacy"/);
 assert.match(builder,/"command-center.js","command-center.css"/);
 assert.match(builder,/src="\/command-center.js"/);
 assert.match(js,/fetch\('\/admin-preview\/api\/metrics\?days='/);
 assert.match(js,/fetch\('\/admin-preview\/api\/command-center\?days='/);
 assert.match(js,/r.day>=collector/);
 assert.match(js,/valid<values.length\?' · 缺失日期不补零'/);
 assert.match(js,/secondary:monthlySeries\(result.finance.months,'netResultFen'\)/);
 assert.match(js,/仍未接入|尚未完整采集|尚无完整可核验/);
 assert.doesNotMatch(js,/Math.random|demoDataset|fakeRevenue|simulatePurchase/);
 assert.match(api,/HHBA_FINANCE_ADMIN_EMAIL/);
 assert.match(api,/verifyAdmin\(request,env\)/);
 assert.match(api,/status='published'/);
 assert.match(api,/HHBA_PNVS_AUTH_DB/);
 assert.match(api,/quality:'not_connected'/);
 assert.match(css,/@media\(max-width:440px\)/);
});


test('authenticated admin landing page automatically reads source-backed KPIs exactly once and keeps user-triggered refresh',()=>{
 const html=source('../../admin-preview/index.html');
 const js=source('../../admin-preview/command-center.js');
 assert.match(html,/id="cc-pv"/);
 assert.match(html,/id="cc-job-views"/);
 assert.match(html,/正在自动加载真实运营数据/);
 assert.doesNotMatch(html,/尚未查询真实统计。为节省 Cloudflare D1/);
 assert.match(js,/setValue\('cc-pv',formatCount\(tr.pv\)\)/);
 assert.match(js,/setValue\('cc-job-views',formatCount\(tr.jobViews\)\)/);
 assert.match(js,/if\(q\('hhba-command-center'\)\)void load\(\)/);
 assert.match(js,/q\('cc-load'\)\?\.addEventListener\('click',\(\)=>void load\(\)\)/);
 assert.match(js,/selectedDays=30/);
 assert.match(js,/const \[metric,financial\]=await Promise\.allSettled/);
 assert.match(js,/cache:'no-store',credentials:'same-origin'/);
 assert.match(js,/const timeout=setTimeout\(\(\)=>ac\.abort\(\),20000\)/);
 assert.doesNotMatch(js,/setInterval\(/,'No expensive repeated polling of D1');
 const firstLoadIdx=js.indexOf("if(q('hhba-command-center'))void load()");
 const fetchFunctionIdx=js.indexOf('async function load()');
 assert.ok(firstLoadIdx>fetchFunctionIdx,'At initial module load the function must already exist');
});


test('precision axis uses distinct integer count ticks and preserves negative money ticks',()=>{
 const context=createContext({
  document:{getElementById:()=>null,querySelectorAll:()=>[]},
  Intl,Date,Math,Number,String,Array,Map,Set,console
 });
 runInContext(source('../../admin-preview/command-center.js'),context);
 const single=runInContext('niceTicks(0,1,0)',context);
 assert.deepEqual(Array.from(single.ticks),[0,1],'1 registration must not produce 0,0,1,1 ticks');
 const zero=runInContext('niceTicks(0,0,0)',context);
 assert.deepEqual(Array.from(zero.ticks),[0],'Fully confirmed zero is one actual tick');
 const pv=runInContext('niceTicks(0,839,0)',context);
 assert.ok(pv.ticks.length<=8);
 assert.equal(new Set(pv.ticks).size,pv.ticks.length,'No duplicate y-axis labels');
 assert.ok(pv.high>=839);
 const financial=runInContext('niceTicks(-410,1080,2)',context);
 assert.ok(financial.low<=-410);
 assert.ok(financial.high>=1080);
 assert.ok(financial.ticks.includes(0),'Profits and losses should show the zero line');
 assert.match(runInContext('showNumber(839,0,"次")',context),/839 次/);
 assert.match(runInContext('showNumber(-42.35,2,"元")',context),/¥-42\.35/);
});

test('hovered SVG point exposes full date, original data, crosshair and keyboard/touch interactions',()=>{
 class StubElement{
  constructor(tag='div'){
   this.tag=tag;this.children=[];this.attrs={};this.style={};this.events={};
   this._text='';this.hidden=false;this.clientWidth=680;
  }
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]}
  append(...items){this.children.push(...items)}
  appendChild(item){this.append(item);return item}
  replaceChildren(...items){this.children=[...items]}
  addEventListener(k,fn){this.events[k]=fn}
  getBoundingClientRect(){return {left:0,width:680,height:220,top:0}}
  set textContent(v){this._text=String(v);this.children=[]}
  get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('')}
 }
 const root=new StubElement('chart');
 const document={
  getElementById:id=>id==='test-chart'?root:null,
  querySelectorAll:()=>[],
  createElement:tag=>new StubElement(tag),
  createElementNS:(_,tag)=>new StubElement(tag),
  createTextNode:v=>({textContent:String(v)})
 };
 const context=createContext({document,Intl,Date,Math,Number,String,Array,Map,Set,console});
 runInContext(source('../../admin-preview/command-center.js'),context);
 runInContext('drawLine("test-chart",[{label:"2026-11-06",value:839},{label:"2026-11-07",value:6}],{unit:"次"})',context);
 const stage=root.children.find(x=>x.tag==='div'&&x.className==='hhba-cc-plot');
 assert.ok(stage,'Chart must have a relative positioning stage');
 const svg=stage.children.find(x=>x.tag==='svg');
 const tip=stage.children.find(x=>x.className==='hhba-cc-tooltip');
 assert.equal(svg.attrs.tabindex,'0');
 assert.equal(svg.attrs.role,'img');
 assert.equal(tip.hidden,true);
 svg.events.pointermove({clientX:58,pointerType:'mouse'});
 assert.equal(tip.hidden,false);
 assert.match(tip.textContent,/2026年11月06日 · UTC/);
 assert.match(tip.textContent,/839 次/);
 const crosshair=svg.children.find(x=>x.tag==='line'&&x.attrs.stroke==='#789b88');
 assert.equal(crosshair.attrs.visibility,'visible');
 svg.events.pointerleave({pointerType:'mouse'});
 assert.equal(tip.hidden,true);
 svg.events.focus();
 let stopped=false;
 svg.events.keydown({key:'ArrowLeft',preventDefault(){stopped=true}});
 assert.equal(stopped,true);
 assert.match(tip.textContent,/839 次/);
 svg.events.pointerdown({clientX:663,pointerType:'touch'});
 assert.match(tip.textContent,/6 次/);
 assert.equal(tip.hidden,false);
});

test('PV low-value detail switch is explicit, reversible, does not fetch D1 and displays true values',()=>{
 const js=source('../../admin-preview/command-center.js');
 const html=source('../../admin-preview/index.html');
 const css=source('../../admin-preview/command-center.css');
 assert.match(html,/id="cc-pv-detail"/);
 assert.match(html,/title="使用平方根刻度凸显低值日期；实际数值保持不变"/);
 assert.match(js,/pvDetail=!pvDetail/);
 assert.match(js,/drawLine\('cc-chart-pv',lastPVSeries,\{scale:pvDetail\?'sqrt':'linear'\}\)/);
 assert.match(js,/平方根刻度仅压缩高峰视觉高度，提示框始终为原始真实数值/);
 assert.match(js,/svg\.addEventListener\('pointermove'/);
 assert.match(js,/svg\.addEventListener\('pointerdown'/);
 assert.match(js,/svg\.addEventListener\('keydown'/);
 assert.match(js,/role:'img',tabindex:'0'/);
 assert.match(css,/\.hhba-cc-tooltip/);
 assert.match(css,/\.hhba-cc-chart-stats/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(js,/setInterval\(/);
});
