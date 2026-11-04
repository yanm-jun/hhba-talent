import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,ExternalLink,MapPin,Search,ShieldCheck,Sparkles,BriefcaseBusiness} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import {WINTER_2027_PROGRAMS,winterProgramById,type WinterProgram} from '../data/winter2027Programs';
import type {User} from '../services/api';
import '../styles/winter-internship.css';

function safeOfficialHref(p:WinterProgram){
 try{
  const url=new URL(p.applicationUrl),source=new URL(p.sourceUrl);
  if(url.protocol!=='https:'||source.protocol!=='https:'||url.username||url.password)return '';
  return p.applicationUrl;
 }catch{return ''}
}
function SourceButton({program}:{program:WinterProgram}){
 const href=safeOfficialHref(program);
 return href?<a className="hhba-winter-official" href={href} target="_blank" rel="noopener noreferrer">前往企业官方招聘页面 <ExternalLink size={15}/></a>:null;
}
function WinterCard({program}:{program:WinterProgram}){
 return <article className="hhba-winter-card" data-winter-program={program.id}>
  <div className="hhba-winter-card-label"><span>{program.kind}</span><span>{program.region}</span></div>
  <h3>{program.title}</h3><p className="hhba-winter-card-company">{program.company} <small>{program.english}</small></p>
  <p className="hhba-winter-card-description">{program.intro}</p>
  <div className="hhba-winter-card-meta"><span><MapPin size={14}/> {program.location}</span><span><CalendarDays size={14}/> {program.period}</span></div>
  <p className="hhba-winter-card-status"><ShieldCheck size={14}/>{program.statusNote}</p>
  <Link className="hhba-winter-card-detail" to={'/winter-internship/'+program.id}>查看项目详情与申请方法 <ArrowRight size={16}/></Link>
 </article>;
}
function WinterDetail({user,id}:{user:User|null;id:string}){
 const p=winterProgramById(id);
 if(!p)return <Shell user={user}><div className="hhba-winter-missing"><h1>未找到这个实习项目</h1><Link to="/winter-internship">返回寒假实习专区</Link></div></Shell>;
 return <Shell user={user}>
  <main className="hhba-winter-page hhba-winter-detail" data-winter-page="detail">
   <Link className="hhba-winter-back" to="/winter-internship"><ArrowLeft size={16}/> 返回寒假实习专区</Link>
   <p className="hhba-winter-eyebrow">HHBA · 2027 WINTER INTERNSHIP</p>
   <div className="hhba-winter-detail-panel"><div>
    <span className="hhba-winter-source-tag"><ShieldCheck size={14}/> 企业官方资料</span>
    <h1>{p.title}</h1><p className="hhba-winter-detail-company">{p.company} · {p.english}</p>
    <p>{p.intro}</p>
   </div>
   <div className="hhba-winter-detail-facts">
    <div><small>项目类型</small><strong>{p.kind} · {p.category}</strong></div>
    <div><small>工作地点</small><strong>{p.location}</strong></div>
    <div><small>实习周期</small><strong>{p.period}</strong></div>
    <div><small>申请时间</small><strong>{p.deadline}</strong></div>
   </div></div>
   <section className="hhba-winter-detail-info"><h2>谁适合申请？</h2>
    <ul>{p.requirements.map((x,i)=><li key={i}>{x}</li>)}</ul>
    <h2>官方来源与报名</h2><p>HHBA 仅整理公开招聘信息，不收取报名费、不承诺录取。请在企业官网核对最新职位、地点、年龄/年级要求和截止时间。</p>
    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="hhba-winter-source-link">查看企业官方项目说明 <ExternalLink size={15}/></a>
    <SourceButton program={p}/>
    <p className="hhba-winter-verified">资料核对日期：{p.checkedOn}。{p.statusNote}。</p>
   </section>
  </main>
 </Shell>;
}
export function WinterInternshipPage({user,slug}:{user:User|null;slug?:string}){
 const [keyword,setKeyword]=useState('');
 const [draft,setDraft]=useState('');
 const [category,setCategory]=useState('全部');
 const [region,setRegion]=useState('全部地区');
 const categories=['全部',...new Set(WINTER_2027_PROGRAMS.map(p=>p.category))];
 const regions=['全部地区',...new Set(WINTER_2027_PROGRAMS.map(p=>p.region))];
 const filtered=useMemo(()=>{
  const q=keyword.normalize('NFKC').trim().toLocaleLowerCase();
  return WINTER_2027_PROGRAMS.filter(p=>(category==='全部'||p.category===category)
   &&(region==='全部地区'||p.region===region)
   &&(!q||[p.title,p.company,p.english,p.location,p.intro,...p.tags].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q)));
 },[keyword,category,region]);
 if(slug)return <WinterDetail user={user} id={slug}/>;
 return <Shell user={user}>
  <main className="hhba-winter-page" data-winter-page="directory">
   <section className="hhba-winter-landing-hero">
    <div className="hhba-winter-landing-copy">
     <p className="hhba-winter-eyebrow"><Sparkles size={16}/> HHBA · 2027 WINTER INTERNSHIP</p>
     <h1>寒假实习季<br/><em>这个寒假，提前遇见未来。</em></h1>
     <p>从真实的官方项目出发，找到下一段成长经历。按行业和地点探索企业，再查看岗位要求与申请渠道。</p>
     <a href="#winter-opportunities" className="hhba-winter-landing-cta">探索官方实习机会 <ArrowRight size={17}/></a>
    </div><img src={import.meta.env.BASE_URL+'images/hhba-join-team.webp'} alt="青年团队协作的宣传示意照片"/>
   </section>
   <div className="hhba-winter-page-trust"><span><CheckCircle2 size={17}/> 企业官方来源</span><span><CheckCircle2 size={17}/> 不虚构招聘名额</span><span><CheckCircle2 size={17}/> 免费查看申请入口</span></div>
   <section className="hhba-winter-directory" id="winter-opportunities" aria-labelledby="winter-opportunities-title">
    <div className="hhba-winter-section-title"><div><p>2026—2027 冬季项目资料库</p><h2 id="winter-opportunities-title">探索寒假实习机会</h2><span>首批收录 {WINTER_2027_PROGRAMS.length} 条官方项目或岗位记录，后续将继续逐批扩充。</span></div></div>
    <form className="hhba-winter-filters" role="search" onSubmit={e=>{e.preventDefault();setKeyword(draft.trim());}}>
     <label className="hhba-winter-query"><Search size={18}/><input type="search" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={80}
      aria-label="搜索寒假实习企业、职位或专业" placeholder="搜索企业、岗位、专业方向或城市…"/></label>
     <label className="hhba-winter-select">行业 <select value={category} aria-label="筛选实习行业" onChange={e=>setCategory(e.target.value)}>
      {categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <label className="hhba-winter-select">地区 <select value={region} aria-label="筛选实习地区" onChange={e=>setRegion(e.target.value)}>
      {regions.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <button type="submit">搜索机会 <ArrowRight size={16}/></button>
    </form>
    <p className="hhba-winter-result-count" aria-live="polite">符合条件的官方项目资料：{filtered.length} 条</p>
    {filtered.length?<div className="hhba-winter-card-grid">{filtered.map(p=><WinterCard key={p.id} program={p}/>)}</div>:
     <div className="hhba-winter-none"><Search size={26}/><h3>暂未收录对应的官方寒假项目</h3><p>可以换个行业、城市或关键词；我们不会为了填充结果而编造岗位。</p>
      <button type="button" onClick={()=>{setDraft('');setKeyword('');setCategory('全部');setRegion('全部地区');}}>清除筛选</button></div>}
   </section>
   <section className="hhba-winter-help"><BriefcaseBusiness size={26}/><div><h2>不止寒假，还有更多职业方向。</h2><p>企业的寒假专项岗位与常规实习并不完全相同，想拓展选择，可以继续查看 HHBA 招聘市场。</p></div>
    <Link to="/candidate/jobs">浏览全部招聘岗位 <ArrowUpRight size={16}/></Link></section>
   <p className="hhba-winter-page-note"><ShieldCheck size={16}/> 提醒：本专题整理的是企业公开发布的项目或岗位资料，不等于全部仍可投递。专业、薪酬、城市及截止日均以企业招聘官网实时显示为准。</p>
  </main>
 </Shell>;
}
