import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import kpmg from '../data/domesticKpmgDetailedDossier20261029.json';
import kpmgJobs from '../data/domesticKpmgConcreteJobs20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

/** This preview changes ONLY cn-autumn-001. Other 155 employer routes are untouched.
 * The two individually produced images are AI illustrations, never actual KPMG premises.
 * All role listings are sourced recruiting tracks, NOT fabricated individual vacancies. */
type JobGroup='audit'|'tax'|'advisory'|'tech';
const majors=[
 {name:'不限专业',categories:['audit','tax','advisory','tech']},
 {name:'会计学',categories:['audit','tax','advisory']},
 {name:'审计学',categories:['audit','tax']},
 {name:'财务管理',categories:['audit','tax','advisory']},
 {name:'金融学',categories:['audit','tax','advisory']},
 {name:'税收学',categories:['tax','audit']},
 {name:'经济学',categories:['advisory','tax','audit']},
 {name:'工商管理',categories:['advisory','audit']},
 {name:'法学',categories:['tax','advisory']},
 {name:'计算机科学与技术',categories:['tech','advisory']},
 {name:'软件工程',categories:['tech','advisory']},
 {name:'数据科学与大数据技术',categories:['tech','advisory','audit']},
 {name:'统计学',categories:['audit','advisory','tech']},
 {name:'信息管理与信息系统',categories:['tech','advisory']},
 {name:'其他专业',categories:['audit','tax','advisory','tech']}
] as const;
const groupName:Record<JobGroup,string>={audit:'审计',tax:'税务',advisory:'咨询',tech:'科技'};
const serviceTags:Record<string,string>={
 '审计与鉴证':'财务报告 · 内控 · 审计',
 '企业税务与国际税务':'税务合规 · 国际税务',
 '交易咨询':'并购 · 交易分析',
 '变革与管理咨询':'战略 · 运营转型',
 '科技与数字化咨询':'数据 · 云计算 · AI',
 '风险与合规咨询':'风险管理 · 合规',
 '可持续发展与ESG':'可持续发展 · ESG',
 '全球中国业务发展中心':'跨境投资 · 国际业务'
};

export function KpmgCompactProfilePage({user}:{user:User|null}){
 const [major,setMajor]=useState('不限专业');
 const [showAll,setShowAll]=useState(false);
 const selected=majors.find(x=>x.name===major)||majors[0];
 const filtered=kpmgJobs.jobs.filter(job=>(selected.categories as readonly string[]).includes(job.group));
 const back=getCompanyReturnTarget();
 const shown=kpmg.services.slice(0,showAll?8:4);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact" data-company-template="openai" data-kpmg-profile-version="recruitment-first">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/domestic-autumn">所有企业 <ArrowRight size={15}/></Link>
   </nav>

   <section className="hhba-kpmg-hero" aria-label="企业标识及办公场景">
    <header className="hhba-kpmg-identity">
      <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="毕马威" large/></div>
      <div className="hhba-kpmg-identity-copy">
        <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
        <h1>毕马威 <span>KPMG</span></h1>
        <p>审计与鉴证 · 税务 · 咨询</p>
      </div>
      <a className="hhba-kpmg-quick-link" href="https://kpmg.com/cn/zh/careers.html" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
      <figure>
        <img src={import.meta.env.BASE_URL+'images/autumn-ai-scenes/cn-autumn-001-01.avif'} alt="独立生成的专业服务公司会议室示意场景，非毕马威实际办公场所" loading="eager"/>
        <figcaption><span>现代办公场景</span><small>AI 场景示意</small></figcaption>
      </figure>
      <figure>
        <img src={import.meta.env.BASE_URL+'images/autumn-ai-scenes/cn-autumn-001-02.avif'} alt="独立生成的专业服务办公建筑示意场景，非毕马威实际办公建筑" loading="eager"/>
        <figcaption><span>办公建筑场景</span><small>AI 场景示意</small></figcaption>
      </figure>
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="kpmg-majors-title">
    <div className="hhba-kpmg-section-heading">
     <div><h2 id="kpmg-majors-title">适合哪些专业背景？</h2><p>选择你的专业，下面的招聘方向会随之筛选。</p></div>
    </div>
    <div className="hhba-kpmg-major-list" role="group" aria-label="选择所学专业">
     {majors.map(item=><button type="button" key={item.name} className={'hhba-kpmg-major'+(major===item.name?' is-selected':'')} aria-pressed={major===item.name} onClick={()=>setMajor(item.name)}>
       {item.name}{major===item.name&&<CheckCircle2 size={13}/>}
     </button>)}
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="kpmg-roles-title">
    <div className="hhba-kpmg-section-heading">
      <div><h2 id="kpmg-roles-title">招聘岗位与职业机会</h2>
       <p>当前匹配：<strong>{major}</strong> · {filtered.length} 条具体历史职位。岗位来源均有独立链接，但当前招聘状态尚未核实。</p>
      </div>
      <a className="hhba-kpmg-section-link" href="https://kpmg.com/cn/zh/careers.html" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">全部招聘入口 <ExternalLink size={13}/></a>
    </div>
    <div className="hhba-kpmg-role-list">
      {filtered.map(job=><article className="hhba-kpmg-role" key={job.id}>
       <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
       <div className="hhba-kpmg-role-main">
        <div className="hhba-kpmg-role-top"><h3>{job.title}</h3><span>历史职位 · {job.publishedOn}</span></div>
        <p>{job.city} · {job.summary}</p>
        <small>{job.requirement}</small>
       </div>
       <Link to={'/candidate/jobs/cn-v2-kpmg-'+job.id}>查看详情 <ArrowRight size={14}/></Link>
      </article>)}
      {filtered.length===0&&<p className="hhba-kpmg-role-disclaimer">尚未收录与该专业明确相关的具体历史岗位，请使用上方官方招聘入口查看企业正在发布的职位。</p>}
    </div>
    <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/> 这里展示的是已查到独立 Moka 岗位页面的历史职位，不代表职位仍可投递；请在官方系统核对。专业标签仅用于辅助匹配。</p>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="kpmg-services-title">
    <div className="hhba-kpmg-section-heading"><div>
      <h2 id="kpmg-services-title">主要业务与专业服务</h2>
      <p>先看业务概览；需要更多内容时再展开。</p>
    </div></div>
    <div className="hhba-kpmg-service-grid">
      {shown.map((service,i)=><article className="hhba-kpmg-service" key={service.title}>
       <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 专业服务</span>
       <h3>{service.title}</h3>
       <p>{service.description}</p>
       <span className="hhba-kpmg-service-tags">{serviceTags[service.title]||service.subtitle}</span>
       <details><summary>了解业务详情 <ChevronDown size={14}/></summary>
        <div className="hhba-kpmg-service-detail">
         <strong>典型服务</strong>
         <ul>{service.deliverables.map(x=><li key={x}>{x}</li>)}</ul>
         <strong>职业方向</strong><p>{service.career}</p>
        </div>
       </details>
      </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setShowAll(v=>!v)}>
      {showAll?'收起其余业务':'查看更多专业服务（共 8 项）'} <ChevronDown className={showAll?'is-up':''} size={16}/>
    </button>
   </section>
  </article>
 </Shell>;
}
