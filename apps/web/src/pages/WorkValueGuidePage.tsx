import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,Check,CheckCircle2,ChevronRight,Clock3,Search,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import {GUIDE_STAGES,GUIDE_TIPS,GUIDE_UPDATED_ON,type GuideStage} from '../data/hhbaWorkValueGuide';
import '../styles/hhba-work-value-guide.css';

const STORAGE_KEY='hhba:guide:completed:v1';
const ALLOWED_IDS=new Set(GUIDE_TIPS.map(t=>t.id));
const values=['全部','钱','时间','岗位','权益','健康','安全'];
const timeLimit=(v:string)=>parseInt(v,10)||999;
const guideHref=(id:string)=>'/rights/guide?tip='+encodeURIComponent(id);
const getTipFromUrl=()=>new URLSearchParams(window.location.search).get('tip')||'';
const featured=GUIDE_TIPS[0];
const secondary=[GUIDE_TIPS[1],GUIDE_TIPS[2]];

function readCompleted():string[]{
 try{
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') as unknown;
  return Array.isArray(stored)?stored.filter((id):id is string=>typeof id==='string'&&ALLOWED_IDS.has(id)):[];
 }catch{return [];}
}
function matchesTip(tip:(typeof GUIDE_TIPS)[number],needle:string){
 const q=needle.trim().normalize('NFKC').toLocaleLowerCase();
 if(!q)return true;
 const all=[tip.title,tip.summary,...tip.steps,...tip.keywords,tip.stage,tip.value].join(' ').normalize('NFKC').toLocaleLowerCase();
 const words=q.split(/[\s,，、;；]+/).filter(Boolean);
 return words.every(word=>all.includes(word)||tip.keywords.some(k=>word.includes(k.toLocaleLowerCase())||k.toLocaleLowerCase().includes(word)));
}
export function WorkValueGuidePage({user}:{user:User|null}){
 const [selectedTipId,setSelectedTipId]=useState(getTipFromUrl);
 const [query,setQuery]=useState('');
 const [showDirectory,setShowDirectory]=useState(false);
 const [stage,setStage]=useState<'all'|GuideStage>('all');
 const [value,setValue]=useState('全部');
 const [maxTime,setMaxTime]=useState('全部');
 const [onlyPending,setOnlyPending]=useState(false);
 const [visibleCount,setVisibleCount]=useState(8);
 const [completed,setCompleted]=useState<string[]>(readCompleted);
 const readerHeading=useRef<HTMLHeadingElement|null>(null);
 const selectedTip=GUIDE_TIPS.find(t=>t.id===selectedTipId);
 const selectedStage=GUIDE_STAGES.find(s=>s.id===selectedTip?.stage);
 const selectedIndex=GUIDE_TIPS.findIndex(t=>t.id===selectedTipId);
 const chapterTips=selectedTip?GUIDE_TIPS.filter(t=>t.stage===selectedTip.stage):[];
 const chapterPosition=selectedTip?chapterTips.findIndex(t=>t.id===selectedTip.id)+1:0;
 const filtered=useMemo(()=>GUIDE_TIPS.filter(tip=>
  (stage==='all'||tip.stage===stage)
  &&(value==='全部'||tip.value===value)
  &&(maxTime==='全部'||timeLimit(tip.minutes)<=Number(maxTime))
  &&(!onlyPending||!completed.includes(tip.id))
  &&matchesTip(tip,query)
 ),[stage,value,maxTime,onlyPending,completed,query]);
 useEffect(()=>{setVisibleCount(8)},[stage,value,maxTime,onlyPending,query]);
 useEffect(()=>{
  const syncTip=()=>setSelectedTipId(getTipFromUrl());
  window.addEventListener('popstate',syncTip);
  return()=>window.removeEventListener('popstate',syncTip);
 },[]);
 useEffect(()=>{
  if(!selectedTip)return;
  const frame=requestAnimationFrame(()=>{
   window.scrollTo(0,0);
   readerHeading.current?.focus({preventScroll:true});
  });
  return()=>cancelAnimationFrame(frame);
 },[selectedTip?.id]);
 const mark=(id:string)=>{
  const next=completed.includes(id)?completed.filter(x=>x!==id):[...completed,id];
  setCompleted(next);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* Retain changes in memory when browser storage is unavailable. */}
 };
 const clear=()=>{
  setQuery('');setStage('all');setValue('全部');setMaxTime('全部');
  setOnlyPending(false);setShowDirectory(false);
 };
 const browsing=query.trim().length>0||showDirectory||stage!=='all'||value!=='全部'||maxTime!=='全部'||onlyPending;

 if(selectedTip){
  const previous=GUIDE_TIPS[selectedIndex-1];
  const next=GUIDE_TIPS[selectedIndex+1];
  const isComplete=completed.includes(selectedTip.id);
  return <Shell user={user}>
   <main className="hhba-value-guide hhba-edition-page hhba-edition-reading" id="main-content">
    <nav className="hhba-edition-reader-nav" aria-label="阅读导航">
     <Link to="/rights/guide"><ArrowLeft size={16}/>返回职场指南</Link>
     <span>HHBA / CHAPTER {String(GUIDE_STAGES.findIndex(s=>s.id===selectedTip.stage)+1).padStart(2,'0')}</span>
    </nav>
    <article className="hhba-edition-article">
     <header className="hhba-edition-article-header">
      <div className="hhba-edition-article-eyebrow">{selectedStage?.label} <span aria-hidden="true">/</span> 第 {chapterPosition} 篇，共 {chapterTips.length} 篇</div>
      <h1 ref={readerHeading} tabIndex={-1}>{selectedTip.title}</h1>
      <p className="hhba-edition-article-summary">{selectedTip.summary}</p>
      <div className="hhba-edition-article-meta"><span>HHBA 原创建议</span><span>{selectedTip.minutes} 阅读与实践参考</span><span>资料整理 {GUIDE_UPDATED_ON}</span></div>
     </header>
     <div className="hhba-edition-article-layout">
      <div className="hhba-edition-article-main">
       <section className="hhba-edition-article-section" aria-labelledby="hhba-edition-steps-heading">
        <div className="hhba-edition-section-index">THE PRACTICAL NOTES / 实践笔记</div>
        <h2 id="hhba-edition-steps-heading">可以怎么做？</h2>
        <ol className="hhba-edition-practical-steps">
         {selectedTip.steps.map((step,i)=><li key={step}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span><p>{step}</p></li>)}
        </ol>
       </section>
       <div className="hhba-edition-reading-action">
        <div><strong>读完这一篇了吗？</strong><p>你可以标记已完成，方便下次继续阅读。记录仅保存在当前浏览器。</p></div>
        <button type="button" aria-pressed={isComplete} className={isComplete?'is-complete':''} onClick={()=>mark(selectedTip.id)}>
         {isComplete?<CheckCircle2 size={17}/>:<Check size={17}/>}
         {isComplete?'已标记完成':'标记已完成'}
        </button>
       </div>
       <div className="hhba-edition-reading-source">
        <ShieldCheck size={17} aria-hidden="true"/>
        <div>
         <strong>相关资料与适用说明</strong>
         <p>这是一般职场实践建议，不等于对个人具体争议的法律判断。是否适用，应结合实际情况和现行官方规定核对。</p>
         {selectedTip.topic?<Link to={'/rights/knowledge/'+selectedTip.topic}><BookOpen size={15}/>查看相关劳动权益与法律依据 <ArrowUpRight size={14}/></Link>:<span>本条为通用实践建议，没有单独关联的法律专题。</span>}
        </div>
       </div>
      </div>
      <aside className="hhba-edition-article-rail" aria-label="章节信息">
       <span>YOU ARE READING</span>
       <strong>{selectedStage?.label}</strong>
       <p>{selectedStage?.description}</p>
       <div className="hhba-edition-article-rail-count">{String(chapterPosition).padStart(2,'0')}<small> / {chapterTips.length}</small></div>
       <Link to="/rights/guide">查看完整目录 <ArrowRight size={14}/></Link>
      </aside>
     </div>
     <nav className="hhba-edition-next-reads" aria-label="上一篇与下一篇">
      {previous?<Link to={guideHref(previous.id)}><span><ArrowLeft size={14}/>上一篇</span><strong>{previous.title}</strong></Link>:<span className="hhba-edition-next-empty"/>}
      {next?<Link to={guideHref(next.id)}><span>下一篇<ArrowRight size={14}/></span><strong>{next.title}</strong></Link>:<Link to="/rights/guide"><span>已读至本册末尾<ArrowRight size={14}/></span><strong>返回目录</strong></Link>}
     </nav>
    </article>
   </main>
  </Shell>;
 }

 return <Shell user={user}>
  <main className="hhba-value-guide hhba-edition-page" id="main-content">
   <section className="hhba-edition-cover" aria-labelledby="hhba-edition-title">
    <div className="hhba-edition-topline"><Link to="/rights/knowledge"><ArrowLeft size={14}/>劳动权益知识库</Link><span>HHBA / THE CAREER EDITION</span><span>VOL. 01 — 08</span></div>
    <div className="hhba-edition-cover-body">
     <div className="hhba-edition-kicker">HHBA ORIGINAL PUBLICATION / 职场指南</div>
     <h1 id="hhba-edition-title">职场这条路，<br/>值得走得更明白。</h1>
     <p>关于选择、工作与成长，以及那些值得认真对待的决定。</p>
    </div>
    <div className="hhba-edition-cover-footer"><span>{GUIDE_STAGES.length} 个主题章节 <i aria-hidden="true"/> {GUIDE_TIPS.length} 条原创建议</span><span>免费阅读 · 持续整理</span></div>
   </section>

   <section className="hhba-edition-discovery" aria-labelledby="hhba-edition-search-heading">
    <div className="hhba-edition-search-heading"><div><span>FIND YOUR ANSWER</span><h2 id="hhba-edition-search-heading">关于工作，你想知道什么？</h2></div><span className="hhba-edition-private">本地检索 · 无需登录</span></div>
    <label className="hhba-edition-search"><Search size={20} aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：入职前需要注意什么？" aria-label="搜索职场行动建议"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="清除搜索">清除</button>}</label>
    <div className="hhba-edition-search-hint">搜索标题、问题或建议关键词。搜索只在当前浏览器处理，不上传输入内容。</div>
    <div className="hhba-edition-discovery-bottom">
     <button type="button" onClick={()=>setShowDirectory(v=>!v)} aria-expanded={showDirectory} aria-controls="hhba-edition-directory">{showDirectory?'收起章节目录':'浏览全部章节'} <ArrowRight size={16}/></button>
     <span>已标记 {completed.length} / {GUIDE_TIPS.length} 篇</span>
    </div>
   </section>

   {!browsing&&<section className="hhba-edition-picks" aria-labelledby="hhba-edition-picks-heading">
    <div className="hhba-edition-section-heading"><span>EDITOR'S PICK / 本期精选</span><span>CHAPTER 01</span></div>
    <Link to={guideHref(featured.id)} className="hhba-edition-feature">
     <div><span className="hhba-edition-feature-no">01 / 求职之前</span><h2 id="hhba-edition-picks-heading">一份好的工作，<br/>从了解它开始。</h2><p>{featured.summary}</p><span className="hhba-edition-feature-action">阅读精选 <ArrowUpRight size={18}/></span></div>
     <span className="hhba-edition-feature-mark" aria-hidden="true">01</span>
    </Link>
    <div className="hhba-edition-pick-more">
     <span>MORE TO EXPLORE / 同章精选</span>
     {secondary.map((tip,i)=><Link to={guideHref(tip.id)} key={tip.id}><span>{String(i+2).padStart(2,'0')}</span><strong>{tip.title}</strong><ArrowUpRight size={17}/></Link>)}
    </div>
   </section>}

   {showDirectory&&<section id="hhba-edition-directory" className="hhba-edition-directory" aria-labelledby="hhba-edition-directory-heading">
    <div className="hhba-edition-section-heading"><span>THE TABLE OF CONTENTS</span><span>01 — 08</span></div>
    <h2 id="hhba-edition-directory-heading">完整章节目录</h2>
    <div className="hhba-edition-chapters">
     {GUIDE_STAGES.map((s,i)=><button type="button" key={s.id} aria-pressed={stage===s.id} aria-controls="hhba-edition-results" className={stage===s.id?'is-selected':''} onClick={()=>{setStage(s.id);setQuery('')}}>
      <span className="hhba-edition-chapter-no">{String(i+1).padStart(2,'0')}</span>
      <span className="hhba-edition-chapter-text"><strong>{s.label}</strong><small>{s.description}</small></span>
      <span className="hhba-edition-chapter-count">25 篇</span><ChevronRight size={16}/>
     </button>)}
    </div>
   </section>}

   {browsing&&<section id="hhba-edition-results" className="hhba-edition-results" aria-labelledby="hhba-edition-results-heading">
    <div className="hhba-edition-results-top"><div><span>THE READING INDEX</span><h2 id="hhba-edition-results-heading">{query?'与你的问题相关':stage==='all'?'全部文章':GUIDE_STAGES.find(s=>s.id===stage)?.label}</h2></div><span>找到 {filtered.length} 篇</span></div>
    <details className="hhba-edition-filters">
     <summary><SlidersHorizontal size={16}/>进一步筛选</summary>
     <div className="hhba-edition-filter-fields">
      <label>章节<select value={stage} onChange={e=>setStage(e.target.value as 'all'|GuideStage)}><option value="all">全部章节</option>{GUIDE_STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label>主要帮助<select value={value} onChange={e=>setValue(e.target.value)}>{values.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>投入时间<select value={maxTime} onChange={e=>setMaxTime(e.target.value)}><option>全部</option><option value="10">10 分钟内</option><option value="15">15 分钟内</option><option value="20">20 分钟内</option><option value="30">30 分钟内</option></select></label>
      <label className="hhba-edition-filter-check"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)}/>只看未完成</label>
      <button type="button" className="hhba-edition-reset" onClick={()=>{setStage('all');setValue('全部');setMaxTime('全部');setOnlyPending(false)}}>清除筛选</button>
     </div>
    </details>
    {filtered.length>0?<div className="hhba-edition-result-list">
     {filtered.slice(0,visibleCount).map((tip,i)=><Link to={guideHref(tip.id)} key={tip.id} className="hhba-edition-result-row">
      <span className="hhba-edition-result-no">{String(i+1).padStart(2,'0')}</span>
      <span className="hhba-edition-result-title"><strong>{tip.title}</strong><small>{GUIDE_STAGES.find(s=>s.id===tip.stage)?.label} <span aria-hidden="true">·</span> {tip.minutes}{completed.includes(tip.id)?' · 已完成':''}</small></span>
      <ChevronRight size={17}/>
     </Link>)}
    </div>:<div className="hhba-edition-empty"><strong>没有找到匹配的文章</strong><p>试试调整关键词或筛选条件。</p><button type="button" onClick={clear}>返回指南首页</button></div>}
    {filtered.length>visibleCount&&<button type="button" className="hhba-edition-loadmore" onClick={()=>setVisibleCount(n=>Math.min(n+8,filtered.length))}>继续查看（剩余 {filtered.length-visibleCount} 篇）<ArrowRight size={16}/></button>}
   </section>}

   <footer className="hhba-edition-footer">
    <ShieldCheck size={19} aria-hidden="true"/>
    <p>本指南由 HHBA 独立撰写，仅供一般职场实践参考，不是具体法律意见。相关法律资料可在 <Link to="/rights/knowledge">劳动权益知识库</Link> 核对。阅读完成状态仅保存在本浏览器，不上传账户或服务器。资料整理日期：{GUIDE_UPDATED_ON}。</p>
   </footer>
  </main>
 </Shell>;
}
