import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,Clock3,Filter,Search,ShieldCheck,Wallet,Compass} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import {GUIDE_STAGES,GUIDE_TIPS,GUIDE_UPDATED_ON,type GuideStage} from '../data/hhbaWorkValueGuide';
import '../styles/hhba-work-value-guide.css';

const STORAGE_KEY='hhba:guide:completed:v1';
const ALLOWED_IDS=new Set(GUIDE_TIPS.map(t=>t.id));
const timeLimit=(value:string)=>parseInt(value,10)||999;
function readCompleted():string[]{
 try{
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') as unknown;
  return Array.isArray(stored)?stored.filter((value):value is string=>typeof value==='string'&&ALLOWED_IDS.has(value)):[];
 }catch{return [];}
}
function matchesTip(tip:(typeof GUIDE_TIPS)[number],needle:string){
 const q=needle.trim().toLocaleLowerCase();
 if(!q)return true;
 const all=[tip.title,tip.summary,...tip.steps,...tip.keywords,tip.stage,tip.value].join(' ').toLocaleLowerCase();
 const pieces=q.split(/[\\s,，、;；]+/).filter(Boolean);
 return pieces.every(token=>all.includes(token)||tip.keywords.some(k=>token.includes(k.toLocaleLowerCase())||k.toLocaleLowerCase().includes(token)));
}
const values=['全部','钱','时间','岗位','权益','健康','安全'];
export function WorkValueGuidePage({user}:{user:User|null}){
 const [query,setQuery]=useState(()=>{const id=new URLSearchParams(window.location.search).get('tip');return GUIDE_TIPS.find(t=>t.id===id)?.title||'';});
 const [stage,setStage]=useState<'all'|GuideStage>('all');
 const [value,setValue]=useState('全部');
 const [maxTime,setMaxTime]=useState('全部');
 const [completed,setCompleted]=useState<string[]>(readCompleted);
 const [onlyPending,setOnlyPending]=useState(false);
 const [visibleCount,setVisibleCount]=useState(24);
 const filtered=useMemo(()=>GUIDE_TIPS.filter(tip=>
  (stage==='all'||tip.stage===stage)
  &&(value==='全部'||tip.value===value)
  &&(maxTime==='全部'||timeLimit(tip.minutes)<=Number(maxTime))
  &&(!onlyPending||!completed.includes(tip.id))
  &&matchesTip(tip,query)
 ),[query,stage,value,maxTime,completed,onlyPending]);
 // Show only 24 cards at a time, even when the full corpus contains 200 actions.
 useEffect(()=>{setVisibleCount(24);},[query,stage,value,maxTime,onlyPending]);
 const visibleTips=filtered.slice(0,visibleCount);
 const finished=completed.length;
 const mark=(id:string)=>{
  const next=completed.includes(id)?completed.filter(x=>x!==id):[...completed,id];
  setCompleted(next);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{/* Browsers may disable storage: current visit still works. */}
 };
 const clear=()=>{setQuery('');setStage('all');setValue('全部');setMaxTime('全部');setOnlyPending(false);};
 return <Shell user={user}>
  <main className="hhba-value-guide" id="main-content">
   <header className="hhba-vguide-hero">
    <div className="hhba-vguide-crumb"><Link to="/rights/knowledge"><ArrowLeft size={15}/>劳动权益知识库</Link><span>HHBA / 职场行动指南</span></div>
    <div className="hhba-vguide-kicker"><Compass size={17}/> HHBA ORIGINAL EDITION</div>
    <h1>高性价比职场指南</h1>
    <p className="hhba-vguide-lead">少走一段弯路，先做一件真正有用的事。</p>
    <p className="hhba-vguide-description">从找工作到离职争议，把常见职场场景变成能够实际执行的步骤。所有建议由 HHBA 独立编写，不收取阅读费用，也不承诺特定收益。</p>
    <div className="hhba-vguide-metrics" aria-label="指南内容范围">
     <div><strong>{GUIDE_TIPS.length}</strong><span>条原创行动建议</span></div>
     <div><strong>{GUIDE_STAGES.length}</strong><span>个职场阶段</span></div>
     <div><strong>{finished}</strong><span>本浏览器标记已完成</span></div>
    </div>
   </header>
   <section className="hhba-vguide-controls" aria-label="检索筛选职场指南">
    <div className="hhba-vguide-controls-top">
     <div><h2>找到你现在最需要的建议</h2><p>根据阶段、关键词和投入时间查找，展开卡片即可查看实际操作步骤。</p></div>
     <span><Filter size={15}/> 本地免费检索</span>
    </div>
    <label className="hhba-vguide-search"><Search size={19}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="例如：试用期、拖欠工资、离职证明、调岗…" aria-label="搜索职场行动建议"/></label>
    <div className="hhba-vguide-stages" role="group" aria-label="按职场阶段筛选">
     <button type="button" className={stage==='all'?'is-active':''} aria-pressed={stage==='all'} onClick={()=>setStage('all')}>全部阶段</button>
     {GUIDE_STAGES.map(s=><button key={s.id} type="button" className={stage===s.id?'is-active':''} aria-pressed={stage===s.id} onClick={()=>setStage(s.id)}>{s.label}</button>)}
    </div>
    <div className="hhba-vguide-filters">
     <label>主要帮助
      <select value={value} onChange={e=>setValue(e.target.value)}>{values.map(v=><option value={v} key={v}>{v}</option>)}</select>
     </label>
     <label>预计投入时间
      <select value={maxTime} onChange={e=>setMaxTime(e.target.value)}><option>全部</option><option value="10">10 分钟内</option><option value="15">15 分钟内</option><option value="20">20 分钟内</option><option value="30">30 分钟内</option></select>
     </label>
     <label className="hhba-vguide-check"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)}/>只看未完成</label>
     <button type="button" className="hhba-vguide-reset" onClick={clear}>重置条件</button>
    </div>
   </section>
   <div className="hhba-vguide-result-head"><h2>建议清单 <small>找到 {filtered.length} 条</small></h2><span>资料整理日期：{GUIDE_UPDATED_ON} · 本页显示 {Math.min(visibleCount,filtered.length)} 条</span></div>
   {filtered.length?<div className="hhba-vguide-grid">{visibleTips.map(tip=>{
    const label=GUIDE_STAGES.find(s=>s.id===tip.stage)?.label||'职场建议';
    const done=completed.includes(tip.id);
    return <article className={'hhba-vguide-card'+(done?' is-completed':'')} key={tip.id} id={'tip-'+tip.id}>
     <div className="hhba-vguide-card-meta"><span className="hhba-vguide-stage-label">{label}</span><span className="hhba-vguide-source-tag">HHBA 原创建议</span></div>
     <h3>{tip.title}</h3><p className="hhba-vguide-summary">{tip.summary}</p>
     <div className="hhba-vguide-tags"><span><Wallet size={13}/>免费阅读</span><span><Clock3 size={13}/>{tip.minutes}</span><span>行动难度：{tip.effort}</span><span>主要帮助：{tip.value}</span></div>
     <details className="hhba-vguide-detail">
      <summary>打开具体行动步骤 <ChevronDown size={17}/></summary>
      <ol>{tip.steps.map(step=><li key={step}>{step}</li>)}</ol>
      <div className="hhba-vguide-detail-footer">
       {tip.topic?<Link to={'/rights/knowledge/'+tip.topic}><BookOpen size={15}/>核对相关法规、证据与官方案例 <ArrowRight size={14}/></Link>:<span>通用实践建议，不代表法律上的强制要求。</span>}
      </div>
     </details>
     <label className="hhba-vguide-done"><input type="checkbox" checked={done} onChange={()=>mark(tip.id)}/><span>{done?'已完成这项行动':'完成后标记'}</span>{done&&<CheckCircle2 size={15}/>}</label>
    </article>;
   })}</div>:<div className="hhba-vguide-empty" role="status"><Search size={23}/><strong>没有匹配的建议</strong><p>试试减少关键词、放宽时间限制，或切换到全部阶段。</p><button type="button" onClick={clear}>显示全部建议</button></div>}
   {filtered.length>visibleCount&&<div className="hhba-vguide-load-more">
    <button type="button" onClick={()=>setVisibleCount(n=>Math.min(n+24,filtered.length))}>继续查看下一批建议（剩余 {filtered.length-visibleCount} 条） <ArrowRight size={16}/></button>
   </div>}
   <footer className="hhba-vguide-footer">
    <ShieldCheck size={21}/>
    <div><strong>关于来源与使用范围</strong><p>本指南由 HHBA 独立撰写，依据日常职场决策整理，不能替代劳动法规定或个案法律意见。涉及具体法定义务的卡片已关联劳动权益知识库；法律适用仍取决于地区、事实与现行规定。部分行动可能产生医疗、专业咨询或其他实际费用，办理前请单独核实。完成状态只保存在本浏览器，不上传账户或服务器。参考项目只用于产品组织方式研究，未复用第三方正文。</p>
     <Link to="/rights/knowledge">前往劳动权益知识库，查看法律原文与公开案例 <ArrowRight size={15}/></Link>
    </div>
   </footer>
  </main>
 </Shell>;
}
