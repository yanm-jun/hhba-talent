import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap,MapPin} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import huayu from '../data/domesticHuayuRebuild20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import '../styles/schneider-compact-profile.css';

/** Existing company identity and media from the prior HHBA profile are reused.
 * Campus jobs are individual, independently identifiable positions described on
 * an official shared campus-job listing. No invented per-job URL or open status.
 */
export function HuayuCompactProfilePage({user}:{user:User|null}){
 const [major,setMajor]=useState('不限专业');
 const [showAllJobs,setShowAllJobs]=useState(false);
 const [showAllServices,setShowAllServices]=useState(false);
 const [logoFailed,setLogoFailed]=useState(false);
 const [photoFailed,setPhotoFailed]=useState<Record<number,boolean>>({});
 const back=getCompanyReturnTarget();
 const chosen=huayu.majors.find(m=>m.name===major)||huayu.majors[0];
 const matched=chosen.name==='不限专业'||chosen.name==='其他专业'?huayu.jobs:
   huayu.jobs.filter(job=>chosen.groups.includes(job.category));
 const jobs=matched.slice(0,showAllJobs?matched.length:5);
 const services=huayu.services.slice(0,showAllServices?huayu.services.length:4);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-schneider-compact"
   data-company-template="openai" data-employer-id="rel-huayu-004" data-company-profile-version="recruitment-first">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/companies/discover">浏览其他企业 <ArrowRight size={15}/></Link>
   </nav>

   <section className="hhba-kpmg-hero" aria-label="华域视觉企业 Logo 和现有场景素材">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo">
      {!logoFailed?<img src={import.meta.env.BASE_URL+huayu.media.logo} alt="华域视觉旧资料库的企业 Logo（归属待复核）"
        onError={()=>setLogoFailed(true)}/>:<BriefcaseBusiness size={24}/>}
     </div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>华域视觉 <span>HASCO VISION</span></h1>
      <p>汽车照明 · 光学与电子控制 · 智能制造</p>
     </div>
     <a className="hhba-kpmg-quick-link" href={huayu.officialRecruitment} data-hhba-recruitment-outbound="true"
       target="_blank" rel="noopener noreferrer">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     {huayu.media.photos.map((photo,i)=><figure key={photo.path}>
      {photoFailed[i]?
       <div role="img" aria-label="图片无法显示" style={{minHeight:180,display:'grid',placeItems:'center',color:'#6e8573'}}>照片暂时无法读取</div>:
       <img src={import.meta.env.BASE_URL+photo.path} loading="eager"
        alt={photo.label} onError={()=>setPhotoFailed(v=>({...v,[i]:true}))}/>}
      <figcaption><span>{photo.label}</span>
       <small>{photo.status==='official_company_photo'?'企业官网实景':'旧素材 · 归属待核实'}</small>
      </figcaption>
     </figure>)}
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="huayu-majors">
    <div className="hhba-kpmg-section-heading"><div>
      <h2 id="huayu-majors">适合哪些专业背景？</h2>
      <p>选择专业后，筛选与相关技术领域对应的官方职位；具体任职条件以职位说明为准。</p>
    </div></div>
    <div className="hhba-kpmg-major-list" role="group" aria-label="专业选择">
     {huayu.majors.map(item=><button key={item.name} type="button"
      className={'hhba-kpmg-major'+(major===item.name?' is-selected':'')}
      aria-pressed={major===item.name} onClick={()=>{setMajor(item.name);setShowAllJobs(false)}}>
      {item.name}{major===item.name&&<CheckCircle2 size={13}/>}
     </button>)}
    </div>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="huayu-jobs">
    <div className="hhba-kpmg-section-heading">
     <div><h2 id="huayu-jobs">招聘岗位</h2>
      <p>已整理 <strong>{huayu.jobs.length}</strong> 条具体职位资料 · 当前专业匹配 <strong>{matched.length}</strong> 条</p>
     </div>
     <a className="hhba-kpmg-section-link" href={huayu.officialRecruitment}
      data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">官网职位列表 <ExternalLink size={13}/></a>
    </div>
    <div className="hhba-kpmg-role-list" aria-live="polite">
     {jobs.map(job=><article className="hhba-kpmg-role" key={job.id}>
      <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
      <div className="hhba-kpmg-role-main">
       <div className="hhba-kpmg-role-top"><h3>{job.title}</h3><span>校招 · 投递状态待核实</span></div>
       <p><MapPin size={12} className="hhba-schneider-map-icon"/>{job.city} · {job.summary}</p>
       <small>{job.requirements}</small>
      </div>
      <Link to={'/candidate/jobs/cn-v2-huayu-'+job.id}>站内详情 <ArrowRight size={14}/></Link>
     </article>)}
     {matched.length===0&&<p>该专业暂无经过确认的对应岗位，可换一个专业查看。</p>}
    </div>
    {matched.length>jobs.length&&<button className="hhba-kpmg-service-more" type="button"
      onClick={()=>setShowAllJobs(true)}>查看其余 {matched.length-jobs.length} 个职位 <ChevronDown size={16}/></button>}
    {showAllJobs&&matched.length>5&&<button className="hhba-schneider-collapse" type="button" onClick={()=>setShowAllJobs(false)}>收起职位</button>}
    <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/> 职位名称、地点、职责和任职要求来源于企业官方校园招聘列表；目前未核实每个岗位能否继续提交申请，官网入口是职位列表，不冒充单岗直投链接。</p>
   </section>

   <section className="hhba-kpmg-section" aria-labelledby="huayu-services">
    <div className="hhba-kpmg-section-heading"><div>
     <h2 id="huayu-services">主要业务与专业服务</h2><p>以紧凑卡片展示四项核心业务；点击可展开。</p>
    </div></div>
    <div className="hhba-kpmg-service-grid">
     {services.map((service,i)=><article className="hhba-kpmg-service" key={service.title}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务方向</span>
      <h3>{service.title}</h3><p>{service.description}</p>
      <span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>查看业务详情 <ChevronDown size={14}/></summary>
       <div className="hhba-kpmg-service-detail"><strong>产品与技术</strong>
        <ul>{service.deliverables.map(t=><li key={t}>{t}</li>)}</ul>
        <strong>相关职业</strong><p>{service.career}</p>
       </div>
      </details>
     </article>)}
    </div>
   </section>
  </article>
 </Shell>;
}
