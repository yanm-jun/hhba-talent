import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,FileClock,FolderOpen,Search,ShieldCheck,ChevronLeft,ChevronRight} from 'lucide-react';
import {WORKER_ARCHIVE_DEMO_MODE,workerDemoCases,workerDemoTotals,workerDemoCurrency,type WorkerDemoCase} from './transparencyDemoData';
import {TransparencyFrame} from './TransparencyFrame';
import {Link} from '../router';
import type {User} from '../services/api';

type PublicCase={id:string;title:string;category:string;stage:string;summary:string;processSummary:string;outcomeSummary:string;publishedAt:string;revisedAt:string|null};
type LoadState='loading'|'ready'|'not_ready'|'error';
const categories=['全部类型','工资与薪酬','劳动合同与用工','工时休假','离职与补偿','社保与工伤','争议处理与证据'];
const endpoint=import.meta.env.BASE_URL+'api/transparency/cases';

function OfficialTransparencyCasesPage({user}:{user:User|null}){
 const [state,setState]=useState<LoadState>('loading');
 const [records,setRecords]=useState<PublicCase[]>([]);
 const [category,setCategory]=useState('全部类型');
 const [query,setQuery]=useState('');
 const [chosenId,setChosenId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 useEffect(()=>{
  let active=true;
  fetch(endpoint,{cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('PUBLIC_CASES_FAILED');return res.json() as Promise<{ok:boolean;state:string;cases:PublicCase[]}>;})
   .then(data=>{if(!active)return;
    if(data.ok!==true||(data.state!=='ready'&&data.state!=='not_ready')||(data.state==='ready'&&!Array.isArray(data.cases)))throw Error('INVALID_CASE_RESPONSE');
    setRecords(data.state==='ready'?data.cases:[]);setState(data.state as LoadState);
   }).catch(()=>{if(active)setState('error');});
  return()=>{active=false;};
 },[]);
 const results=useMemo(()=>records.filter(item=>(category==='全部类型'||item.category===category)&&
  [item.id,item.title,item.category,item.summary].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[records,category,query]);
 const setOpen=(id:string|null)=>{
  setChosenId(id);
  const url=new URL(window.location.href);
  if(id)url.searchParams.set('case',id);else url.searchParams.delete('case');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 };
 useEffect(()=>{
  if(state!=='ready'||!chosenId)return;
  const frame=requestAnimationFrame(()=>document.getElementById('public-case-'+chosenId)?.scrollIntoView({block:'center'}));
  return()=>cancelAnimationFrame(frame);
 },[state,chosenId]);
 return <TransparencyFrame user={user} section="帮扶案例公开档案" title="帮扶案例档案" description="仅展示经过本人授权、事实核验、隐私脱敏与审核批准的真实案例摘要；未公布的不作事实推测。">
  <section className="hhba-v5-content-section" aria-labelledby="v5-cases-main-title">
   <div className="hhba-v5-section-label"><span>PUBLIC CASE REGISTER</span><h2 id="v5-cases-main-title">真实案例档案</h2><p>可按权益问题分类、关键词及公开编号查找；所有处理进展仅限获准公开的信息。</p></div>
   {state==='loading'?<div className="hhba-v5-empty" role="status"><FileClock size={22}/><strong>正在读取公开案例…</strong></div>:
    state==='error'?<div className="hhba-v5-empty" role="alert"><FileClock size={22}/><strong>暂时无法核验案例数据</strong><p>请稍后重试。接口故障不能解释为没有实际申请或没有发生过案件。</p></div>:
    state==='not_ready'?<div className="hhba-v5-empty"><FolderOpen size={22}/><strong>真实案例公开数据库尚未启用</strong><p>尚未完成独立迁移与发布核验，本页面不会显示任何虚构数量或处理结果。</p></div>:
    !records.length?<div className="hhba-v5-empty"><FolderOpen size={22}/><strong>暂无通过公开审核的真实案例</strong><p>暂无公开记录不代表没有收到申请。真实档案必须经过授权、事实核验和脱敏审核后才会出现在这里。</p></div>:
    <div className="hhba-v5-case-register">
     <div className="hhba-v5-case-controls"><label className="hhba-v5-search"><Search size={18}/><input aria-label="搜索已公开的真实案例" placeholder="搜索案件编号、问题或关键词" value={query} onChange={event=>setQuery(event.target.value)}/></label>
     <div className="hhba-v5-case-filters" role="group" aria-label="按权益问题分类">{categories.map(name=><button type="button" key={name} onClick={()=>setCategory(name)} className={category===name?'active':''}>{name}</button>)}</div></div>
     <div className="hhba-v5-result-count">当前展示 {results.length} 份审核通过的公开摘要；不代表所有受理案件数量。</div>
     {results.map(record=><article id={'public-case-'+record.id} className="hhba-v5-case-row" key={record.id}>
      <button type="button" className="hhba-v5-case-trigger" aria-expanded={chosenId===record.id} onClick={()=>setOpen(chosenId===record.id?null:record.id)}>
       <span className="hhba-v5-case-id">{record.id}</span><span className="hhba-v5-case-head"><strong>{record.title}</strong><small>{record.category} · {record.stage} · 公开于 {record.publishedAt.slice(0,10)}</small></span><ArrowRight size={17}/>
      </button>
      {chosenId===record.id&&<div className="hhba-v5-case-detail">
       <h3>事实摘要</h3><p>{record.summary}</p>
       <h3>审核后可披露的处理过程</h3><p>{record.processSummary}</p>
       <h3>阶段结果与后续事项</h3><p>{record.outcomeSummary}</p>
       <div className="hhba-v5-case-operations"><small>{record.revisedAt?'最近修订：'+record.revisedAt.slice(0,10):'原始公开版本'}</small><Link to={'/transparency/funds?case='+encodeURIComponent(record.id)}>查看该案件关联的公开支出 <ArrowRight size={15}/></Link></div>
      </div>}
     </article>)}
     {!results.length&&<div className="hhba-v5-empty"><Search size={18}/><strong>当前筛选条件没有匹配的公开档案</strong></div>}
     {chosenId&&!records.some(x=>x.id===chosenId)&&<p className="hhba-v5-slim-note">分享链接所指的档案不存在、尚未公开或已撤回。</p>}
    </div>}
  </section>
  <section className="hhba-v5-demo-cta" aria-label="虚构档案功能演示"><div><span>PRODUCT DEMO / 虚构情景</span><h2>体验 28 份模拟案例档案</h2><p>所有人物、雇主、争议、金额和结果均为虚构，只展示分类检索、九章节阅读和模拟流水关联功能，不代表真实帮扶成果。</p></div><Link to="/transparency/archive-preview?view=cases">查看模拟档案 <ArrowRight size={16}/></Link></section>
  <p className="hhba-v5-slim-note"><ShieldCheck size={15}/> 本页不公开个人身份、原始合同、银行交易凭据或保密法律文书。</p>
 </TransparencyFrame>;
}
export function TransparencyCasesPage({user}:{user:User|null}){
 return WORKER_ARCHIVE_DEMO_MODE?<DemoTransparencyCasesPage user={user}/>:<OfficialTransparencyCasesPage user={user}/>;
}
const demoCategories=['全部类型',...Array.from(new Set(workerDemoCases.map(x=>x.category)))];
function DemoCaseDocument({record}:{record:WorkerDemoCase}){
 return <div className="hhba-v6-case-detail">
  <h3>01 / 档案基本信息</h3>
  <p>案件编号：{record.id}　类别：{record.category}　状态：{record.status}　登记日期：{record.date}</p>
  <p>行业：{record.industry}　岗位：{record.position}　工作年限：{record.tenure}</p>
  <h3>02 / 事件背景与主要争议</h3><p>{record.background}</p><p>主要诉求：{record.claim}</p>
  <ul>{record.issues.map((item,i)=><li key={i}>{item}</li>)}</ul>
  <h3>03 / 申请诉求与证据材料</h3><p>{record.request}</p>
  <ul>{record.documents.map((item,i)=><li key={i}>{item}</li>)}</ul>
  <h3>04 / 初步审核与争议焦点</h3><p>{record.review}</p>
  <h3>05 / 处理进度</h3>
  <ol>{record.timeline.map((item,i)=><li key={i}>{item}</li>)}</ol>
  <h3>06 / 支持内容</h3><p>{record.service}</p>
  <h3>07 / 处理结果与后续事项</h3><p>{record.outcome}</p><p>{record.followup}</p>
  <h3>08 / 关联资金项目</h3>
  <p>权益支持金额：{workerDemoCurrency(record.expense)}。{record.expense>0?'项目分类：'+record.feeLabels.join('、'):'该阶段尚未发生资金支出。'}</p>
  {record.expense>0&&<Link to={'/transparency/funds?case='+encodeURIComponent(record.id)}>查看关联资金明细 <ArrowRight size={15}/></Link>}
  <h3>09 / 档案信息保护与修订</h3><p>正式公开的案件需经授权、事实确认及个人信息脱敏，必要时保留修订记录。本档案采用示例字段展示处理流程。</p>
 </div>;
}
function DemoTransparencyCasesPage({user}:{user:User|null}){
 const [category,setCategory]=useState('全部类型');
 const [status,setStatus]=useState<'全部'|'已完成'|'处理中'>('全部');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(1);
 const [chosenId,setChosenId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 const results=useMemo(()=>workerDemoCases.filter(r=>(category==='全部类型'||r.category===category)&&(status==='全部'||r.status===status)&&
  (!query.trim()||[r.id,r.title,r.category,r.industry,r.position,r.claim,r.background,...r.issues].some(v=>v.toLowerCase().includes(query.trim().toLowerCase())))),[category,status,query]);
 const maxPage=Math.max(1,Math.ceil(results.length/6));
 const chosen=workerDemoCases.find(r=>r.id===chosenId);
 const pageRecords=chosen&&results.some(r=>r.id===chosenId)?[chosen,...results.filter(r=>r.id!==chosenId).slice((Math.min(page,maxPage)-1)*6,(Math.min(page,maxPage)-1)*6+5)]:results.slice((Math.min(page,maxPage)-1)*6,Math.min(page,maxPage)*6);
 const open=(id:string|null)=>{setChosenId(id);const url=new URL(window.location.href);if(id)url.searchParams.set('case',id);else url.searchParams.delete('case');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);};
 useEffect(()=>{if(!chosenId)return;const t=requestAnimationFrame(()=>document.getElementById('public-case-'+chosenId)?.scrollIntoView({block:'center'}));return()=>cancelAnimationFrame(t);},[chosenId,page,category,status]);
 return <TransparencyFrame user={user} section="帮扶案例公开档案" title="帮扶案例公开档案" description="集中查阅劳动权益问题分类、受理情况、处理进度、阶段结果与资金关联。">
  <div className="hhba-v6-kpi-row">
   <div><small>累计受理</small><strong>{workerDemoTotals.cases} 件</strong></div>
   <div><small>已完成</small><strong>{workerDemoTotals.completed} 件</strong></div>
   <div><small>处理中</small><strong>{workerDemoTotals.inProgress} 件</strong></div>
  </div>
  <section className="hhba-v5-content-section" aria-labelledby="v6-cases-title">
   <div className="hhba-v5-section-label"><span>CASE REGISTER / 档案查阅</span><h2 id="v6-cases-title">案例查询</h2><p>支持关键词、权益问题分类和处理状态筛选；点击案件查看九项完整档案内容。</p></div>
   <div className="hhba-v5-case-controls">
    <label className="hhba-v5-search"><Search size={18}/><input aria-label="搜索案例" placeholder="搜索案件编号、争议类型、岗位或关键词" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
    <div className="hhba-v5-case-filters" role="group" aria-label="按权益问题分类">{demoCategories.map(c=><button type="button" key={c} className={category===c?'active':''} onClick={()=>{setCategory(c);setPage(1);open(null);}}>{c}</button>)}</div>
    <div className="hhba-v5-case-filters" role="group" aria-label="按案件状态">{(['全部','已完成','处理中'] as const).map(c=><button type="button" key={c} className={status===c?'active':''} onClick={()=>{setStatus(c);setPage(1);open(null);}}>{c}</button>)}</div>
   </div>
   <div className="hhba-v5-result-count">符合条件的档案：{results.length} 件</div>
   {pageRecords.map(r=><article id={'public-case-'+r.id} className="hhba-v5-case-row" key={r.id}>
    <button type="button" className="hhba-v5-case-trigger" aria-expanded={chosenId===r.id} onClick={()=>open(chosenId===r.id?null:r.id)}>
     <span className="hhba-v5-case-id">{r.id}</span><span className="hhba-v5-case-head"><strong>{r.title}</strong><small>{r.category} · {r.status} · {r.date}</small></span><ArrowRight size={17}/>
    </button>
    {chosenId===r.id&&<DemoCaseDocument record={r}/>}
   </article>)}
   {!results.length&&<div className="hhba-v5-empty"><Search size={19}/><strong>未找到符合条件的档案</strong><p>请尝试更换筛选条件。</p></div>}
   {chosenId&&!chosen&&<p className="hhba-v5-slim-note">没有找到对应的公开档案编号。</p>}
   <div className="hhba-v6-case-tools"><small>第 {Math.min(page,maxPage)} / {maxPage} 页</small>
    <div><button type="button" disabled={page<=1} onClick={()=>{setPage(n=>Math.max(1,n-1));open(null);}}><ChevronLeft size={13}/>上一页</button>{' '}<button type="button" disabled={page>=maxPage} onClick={()=>{setPage(n=>Math.min(maxPage,n+1));open(null);}}>下一页<ChevronRight size={13}/></button></div>
   </div>
  </section>
  <p className="hhba-v5-slim-note"><ShieldCheck size={15}/> 档案披露遵循必要的个人信息保护规则，不展示真实个人身份证明或保密资料。</p>
 </TransparencyFrame>;
}
