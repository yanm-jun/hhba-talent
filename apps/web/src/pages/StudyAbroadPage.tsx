import {useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,CheckCircle2,ExternalLink,Globe2,GraduationCap,Search,ShieldCheck,Wallet,Repeat2,Award,Compass,MapPin} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import {BrandMark} from '../components/BrandMark';
import type {User} from '../services/api';
import {matchesStudyDirection,studyCountries,studyCountry,studyDirections,studyGoalLabels,type StudyCountryCode,type StudyGoal,type StudyDirection} from '../data/studyAbroad';
import '../styles/study-abroad.css';

const goals=[
 {id:'budget' as const,title:'低成本留学',copy:'预算有限，也值得探索世界。先算清学费与生活成本。',icon:Wallet},
 {id:'cross' as const,title:'跨专业升学',copy:'寻找明确接受不同学科背景的课程，而非凭感觉判断。',icon:Repeat2},
 {id:'scholar' as const,title:'奖学金机会',copy:'查官方资助、大学奖学金与申请资格。',icon:Award},
 {id:'work' as const,title:'留学后就业',copy:'结合课程与工作政策，考虑更长远的发展。',icon:BriefcaseBusiness}
];
function StudyFooter(){
 return <footer className="hhba-study-footer"><BrandMark variant="signature" size="small"/><p>让机会与人才，找到彼此。 · 留学机会 / 人才政策 / 招聘市场</p></footer>;
}
function StudyDetail({user,direction}:{user:User|null;direction:StudyDirection}){
 const country=studyCountry(direction.country);
 return <Shell user={user}>
  <article className="hhba-study hhba-study-detail" data-hhba-study="detail">
   <div className="hhba-study-wrap">
    <Link to="/study-abroad" className="hhba-study-back"><ArrowLeft size={16}/> 返回留学机会</Link>
    <section className="hhba-study-detail-head">
     <p className="hhba-study-eyebrow">{country.flag} {country.name} · 升学方向资料</p>
     <h1>{direction.title}</h1>
     <p>{direction.summary}</p>
     <div className="hhba-study-tags">{direction.highlights.map(t=><span key={t}>{t}</span>)}</div>
     <div className="hhba-study-disclosure"><ShieldCheck size={17}/> 本页是留学研究方向，不代表某所学校已开放招生或承诺录取。项目学费、资格、截止日尚未逐校核实。</div>
    </section>
    <div className="hhba-study-detail-layout">
     <div className="hhba-study-detail-main">
      {[
       ['如何选择项目',direction.focus],
       ['申请条件需核实',direction.admissions],
       ['预算与费用核实',direction.budget],
       ['奖学金和资助',direction.aid],
       ['毕业后的职业发展',direction.career]
      ].map(([title,body],i)=><section className="hhba-study-detail-panel" key={title}>
       <div className="hhba-study-step">{String(i+1).padStart(2,'0')}</div><div><h2>{title}</h2><p>{body}</p></div>
      </section>)}
     </div>
     <aside className="hhba-study-source-box">
      <p className="hhba-study-eyebrow">官方信息入口</p><h2>{country.sourceName}</h2>
      <p>从该国官方留学指导或教育项目数据库继续查询。具体院校申请须以学校官网最终公告为准。</p>
      <a href={country.resource} target="_blank" rel="noopener noreferrer" className="hhba-study-btn">访问官方留学信息 <ExternalLink size={16}/></a>
      <Link to="/study-abroad" className="hhba-study-source-back">继续比较其他方向 <ArrowRight size={15}/></Link>
      <small>官方资料入口已核验（2026-10-30），不等于每所学校已核验。</small>
     </aside>
    </div>
    <section className="hhba-study-career"><div><h2>留学之后，也要看见职业机会。</h2><p>了解企业、岗位与人才政策，把海外学习和长期发展衔接起来。</p></div><Link to="/candidate/jobs" className="hhba-study-btn">探索招聘市场 <ArrowUpRight size={16}/></Link></section>
    <StudyFooter/>
   </div>
  </article>
 </Shell>;
}
export function StudyAbroadPage({user,slug}:{user:User|null;slug?:string}){
 const [country,setCountry]=useState<StudyCountryCode|''>('');
 const [goal,setGoal]=useState<StudyGoal>('all');
 const [draft,setDraft]=useState('');
 const [query,setQuery]=useState('');
 const resultsRef=useRef<HTMLElement>(null);
 const direction=slug?studyDirections.find(d=>d.id===slug):undefined;
 const matches=useMemo(()=>studyDirections.filter(d=>matchesStudyDirection(d,goal,country,query)),[goal,country,query]);
 const goResults=()=>{resultsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});};
 const chooseGoal=(next:StudyGoal)=>{setGoal(next);goResults();};
 const chooseCountry=(next:StudyCountryCode)=>{setCountry(prev=>prev===next?'':next);goResults();};
 const reset=()=>{setCountry('');setGoal('all');setDraft('');setQuery('');};
 if(slug){
  return direction?<StudyDetail user={user} direction={direction}/>:
   <Shell user={user}><div className="hhba-study hhba-study-missing"><h1>暂未找到该留学方向</h1><p>该项目尚未收录，或链接已经调整。</p><Link to="/study-abroad" className="hhba-study-btn">返回留学机会 <ArrowRight size={16}/></Link></div></Shell>;
 }
 return <Shell user={user}>
  <div className="hhba-study" data-hhba-study="home">
   <section className="hhba-study-hero">
    <p className="hhba-study-eyebrow"><Globe2 size={14}/> HHBA · GLOBAL STUDY OPPORTUNITIES</p>
    <h1>让留学机会，不再遥不可及。</h1>
    <p className="hhba-study-hero-lead">不只是寻找一所大学，更是找到一条适合自己的未来之路。<br/>按预算、专业与发展目标，发现属于你的海外升学方向。</p>
    <form className="hhba-study-search" role="search" onSubmit={e=>{e.preventDefault();setQuery(draft.trim());goResults();}}>
     <Search size={19} aria-hidden="true"/>
     <label className="hhba-study-sr" htmlFor="hhba-study-q">搜索国家或留学方向</label>
     <input id="hhba-study-q" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="搜索国家、大学方向、专业背景或留学关键词…" />
     <button type="submit" className="hhba-study-btn">搜索留学机会 <ArrowUpRight size={15}/></button>
    </form>
    <div className="hhba-study-quick" aria-label="热门方向">
     {goals.map(g=><button type="button" key={g.id} onClick={()=>chooseGoal(g.id)}>{g.title}</button>)}
    </div>
   </section>
   <div className="hhba-study-trust"><span><CheckCircle2 size={15}/> 官方信息优先</span><span><CheckCircle2 size={15}/> 申请费用透明化</span><span><CheckCircle2 size={15}/> 不承诺保录</span><span><CheckCircle2 size={15}/> 留学就业衔接</span></div>
   <div className="hhba-study-wrap">
    <section className="hhba-study-section" aria-labelledby="hhba-study-goals">
     <div className="hhba-study-section-head"><div><h2 id="hhba-study-goals">你希望通过留学，实现什么？</h2><p>从你的目标出发，而不是从学校排名出发。</p></div></div>
     <div className="hhba-study-goal-grid">{goals.map(g=><button type="button" className={'hhba-study-goal '+(goal===g.id?'is-active':'')} key={g.id} aria-pressed={goal===g.id} onClick={()=>chooseGoal(g.id)}><span className="hhba-study-goal-icon"><g.icon size={23}/></span><strong>{g.title}</strong><span>{g.copy}</span><ArrowUpRight className="hhba-study-goal-arrow" size={16}/></button>)}</div>
    </section>
    <section className="hhba-study-section" aria-labelledby="hhba-study-countries">
     <div className="hhba-study-section-head"><div><h2 id="hhba-study-countries">按国家探索留学机会</h2><p>先看六个目的地，后续再按真实资料扩展。</p></div><button type="button" className="hhba-study-link" onClick={()=>{setCountry('');goResults();}}>查看全部国家 <ArrowRight size={15}/></button></div>
     <div className="hhba-study-country-grid">
      {studyCountries.map(c=><button type="button" key={c.code} className={'hhba-study-country '+(country===c.code?'is-active':'')} aria-pressed={country===c.code} onClick={()=>chooseCountry(c.code)}><span className="hhba-study-flag" aria-hidden="true">{c.flag}</span><strong>{c.name}</strong><small>{c.english}</small></button>)}
     </div>
    </section>
    <section className="hhba-study-section" id="study-directions" ref={resultsRef} aria-labelledby="hhba-study-list">
     <div className="hhba-study-section-head"><div><h2 id="hhba-study-list">发现适合你的升学方向</h2><p aria-live="polite">{country?studyCountry(country).name+' · ':''}{studyGoalLabels[goal]} · {matches.length} 条研究方向</p></div><button type="button" className="hhba-study-link" onClick={reset}>重置筛选 ↺</button></div>
     <div className="hhba-study-filters" aria-label="升学方向筛选">
      {(Object.keys(studyGoalLabels) as StudyGoal[]).map(g=><button key={g} type="button" className={goal===g?'is-active':''} aria-pressed={goal===g} onClick={()=>setGoal(g)}>{studyGoalLabels[g]}</button>)}
     </div>
     {matches.length?<div className="hhba-study-card-grid">{matches.map(d=>{
      const c=studyCountry(d.country);
      return <article className="hhba-study-card" key={d.id}>
       <div className={'hhba-study-card-cover hhba-study-cover-'+d.country}><span>{d.badge}</span><GraduationCap size={43} strokeWidth={1.3}/></div>
       <div className="hhba-study-card-copy"><small>{c.flag} {c.name} · 方向研究</small><h3>{d.title}</h3><p>{d.summary}</p><div className="hhba-study-tags">{d.highlights.map(h=><span key={h}>{h}</span>)}</div><div className="hhba-study-card-footer"><small>费用及申请条件待逐校核实</small><Link to={'/study-abroad/'+d.id} aria-label={'查看'+d.title+'详情'}>查看方向 <ArrowRight size={15}/></Link></div></div>
      </article>;
     })}</div>:<div className="hhba-study-empty"><Search size={24}/><h3>没有符合条件的研究方向</h3><p>可以清除关键词、切换国家或查看全部方向。</p><button type="button" className="hhba-study-btn" onClick={reset}>清除全部筛选</button></div>}
     <p className="hhba-study-note"><ShieldCheck size={16}/> 首版展示的是六国升学研究方向，不是六所已核实的大学。具体学校、学费、录取标准、奖学金名额及申请截止日，需要逐项核验后才能作为院校数据发布。</p>
    </section>
    <section className="hhba-study-career">
     <div><p className="hhba-study-eyebrow"><Compass size={14}/> HHBA · 长期职业发展</p><h2>留学不是终点，未来同样重要。</h2><p>连接招聘市场与企业发现，从入学之前就开始思考职业发展路径。</p></div><Link to="/candidate/jobs" className="hhba-study-btn">探索招聘市场 <ArrowUpRight size={16}/></Link>
    </section>
    <div className="hhba-study-guides"><span><BookOpen size={16}/> 申请时请以学校公布的最新招生简章为准</span><span><MapPin size={16}/> 留学签证及工作资格以主管机构信息为准</span></div>
    <StudyFooter/>
   </div>
  </div>
 </Shell>;
}
