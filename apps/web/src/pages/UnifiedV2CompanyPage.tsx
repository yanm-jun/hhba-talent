import {useMemo,useState} from 'react';
import {majorNamesRelated} from '../services/majorEligibility.mjs';
import {employerProfileById} from '../services/employerProfiles';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import '../styles/unified-v2-company.css';

type Business={title:string;description:string;tags:string;details:string[]};
type Role={
 id:string;title:string;city:string;summary:string;requirements:string;
 majorNames:string[];editorialRelatedMajors:string[];majorUnrestricted:boolean;
 educationLabel:string;currentOpenVerified:false;observedOn:string;evidenceUrl:string;
};
type Photo={path:string;caption:string;note:string;alt:string};
type Company={
 id:string;name:string;displayName?:string;englishName:string;industry:string;subtitle:string;
 overview:string;lastReviewed:string;media:{logo:string;photos:Photo[]};
 recruitment:{url:string;label:string;status:string;subject:string;note:string};
 photoNote:string;majorIntro:string;preferredMajors:string[];
 business:Business[];jobs:Role[];
};
const asset=(path:string)=>import.meta.env.BASE_URL+path;
function normalized(s:string){return s.normalize('NFKC').trim().toLocaleLowerCase()}
function roleMatches(role:Role,major:string){
 if(!major||role.majorUnrestricted)return true;
 return [...role.majorNames,...role.editorialRelatedMajors].some(x=>majorNamesRelated(x,major));
}
export function UnifiedV2CompanyPage({user,id}:{user:User|null;id:string}){
 const p=employerProfileById.get(id) as Company|undefined;
 const [major,setMajor]=useState('');
 const [expanded,setExpanded]=useState(false);
 const [focusedRole]=useState(()=>new URLSearchParams(location.search).get('role')||'');
 const back=getCompanyReturnTarget();
 const choices=useMemo(()=>p?[...new Set([
  ...p.preferredMajors,
  ...p.jobs.flatMap(j=>[...j.majorNames,...j.editorialRelatedMajors])
 ])].slice(0,22):[],[p]);
 const matches=useMemo(()=>p?.jobs.filter(job=>roleMatches(job,major))||[],[p,major]);
 if(!p)return <Shell user={user}><section className="hhba-v2-company-status" role="alert">企业档案未加入主站数据目录。<p><Link to="/candidate/jobs">返回招聘市场</Link></p></section></Shell>;
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact" data-company-template="unified-v2" data-domestic-rebuild="v2" data-employer-id={p.id}>
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={asset(p.media.logo)} alt={p.name+' Logo'} loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>{p.displayName||p.name} <span>{p.englishName}</span></h1><p>{p.subtitle}</p>
     </div>
     {p.recruitment.status!=='unconfirmed'&&<a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true"
      href={p.recruitment.url} rel="noopener noreferrer" target="_blank">{p.recruitment.label} <ExternalLink size={14}/></a>}
    </header>
    <div className="hhba-kpmg-photo-grid">{p.media.photos.map(photo=><figure key={photo.path}>
     <img src={asset(photo.path)} alt={photo.alt} loading="lazy"/>
     <figcaption><span>{photo.caption}</span><small>{photo.note}</small></figcaption>
    </figure>)}</div>
    <p className="hhba-hypergryph-photo-note">{p.photoNote}</p>
   </section>
   <section className="hhba-kpmg-section hhba-v2-company-jobs" aria-label="企业岗位与专业匹配">
    <div className="hhba-kpmg-section-heading"><div><h2>岗位与所学专业</h2>
     <p>{p.majorIntro}</p></div></div>
    <div className="hhba-v2-company-chips">
     <button type="button" className={!major?'selected':''} onClick={()=>setMajor('')}>全部岗位 ({p.jobs.length})</button>
     {choices.map(name=>{
      const count=p.jobs.filter(j=>roleMatches(j,name)).length;
      return <button type="button" key={name} className={major===name?'selected':''}
       onClick={()=>setMajor(name)}>{name} ({count})</button>;
     })}
    </div>
    <p className="hhba-v2-company-note"><GraduationCap size={15}/> 该专业筛选仅依据已公开方向辅助匹配，不代表满足全部招聘资格。职位是否仍开放请以官方招聘站为准。</p>
    <div className="hhba-v2-company-role-grid">{matches.map(job=>
     <article className="hhba-v2-company-role" key={job.id} id={'role-'+job.id} data-focus={focusedRole===job.id?'true':'false'}>
      <div className="hhba-v2-company-role-head"><h3>{job.title}</h3><small>{job.educationLabel}</small></div>
      <p>{job.summary}</p><small>{job.city}</small>
      <details open={focusedRole===job.id}><summary>查看岗位要求 <ChevronDown size={14}/></summary><p>{job.requirements}</p></details>
     </article>)}</div>
    {!matches.length&&<p className="hhba-v2-company-no-roles">该专业暂无已收录的对应岗位方向。请切换专业或选择全部岗位。</p>}
   </section>
   <section className="hhba-kpmg-section">
    <div className="hhba-kpmg-section-heading"><div><h2>主要业务与专业服务</h2>
     <p>{p.overview} 企业业务范围不代表目前全部开放招聘。</p></div></div>
    <div className="hhba-kpmg-service-grid">{p.business.slice(0,expanded?99:4).map((service,i)=>
     <article className="hhba-kpmg-service" key={service.title}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.title}</h3><p>{service.description}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary>
       <div className="hhba-kpmg-service-detail"><ul>{service.details.map(item=><li key={item}>{item}</li>)}</ul></div>
      </details>
     </article>)}</div>
    {p.business.length>4&&<button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>
     {expanded?'收起其他业务':'查看更多业务（共 '+p.business.length+' 项）'} <ChevronDown size={15}/></button>}
   </section>
  </article>
 </Shell>;
}
