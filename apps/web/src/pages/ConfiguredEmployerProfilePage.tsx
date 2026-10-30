import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import {employerProfileById} from '../services/employerProfiles';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
function asset(path:string){return import.meta.env.BASE_URL+path}
export function ConfiguredEmployerProfilePage({user,id}:{user:User|null;id:string}){
 const p=employerProfileById.get(id);
 const back=getCompanyReturnTarget();
 const [expanded,setExpanded]=useState(false);
 if(!p)return null;
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact" data-company-template="factory-v1" data-domestic-rebuild="v2" data-employer-id={p.id}>
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={asset(p.media.logo)} alt={p.name+'品牌标识'} loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>{p.name} <span>{p.englishName}</span></h1><p>{p.subtitle}</p>
     </div>
     {p.recruitment.status!=='unconfirmed'&&<a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true"
      href={p.recruitment.url} rel="noopener noreferrer" target="_blank">{p.recruitment.label} <ExternalLink size={14}/></a>}
    </header>
    <div className="hhba-kpmg-photo-grid">{p.media.photos.map(photo=><figure key={photo.path}>
     <img src={asset(photo.path)} alt={photo.alt} loading="eager"/>
     <figcaption><span>{photo.caption}</span><small>{photo.note}</small></figcaption>
    </figure>)}</div>
    <p className="hhba-hypergryph-photo-note">{p.photoNote}</p>
   </section>
   <CompanyMajorJobs companyRoute={'/companies/autumn/'+p.id} majorIntro={p.majorIntro} quickMajorNames={p.preferredMajors}/>
   <section className="hhba-kpmg-section">
    <div className="hhba-kpmg-section-heading"><div><h2>主要业务与专业服务</h2>
     <p>{p.overview} 业务分类并不代表实时开放的招聘岗位。</p></div></div>
    <div className="hhba-kpmg-service-grid">{p.business.slice(0,expanded?99:4).map((service,i)=>
     <article className="hhba-kpmg-service" key={service.title}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.title}</h3><p>{service.description}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary>
       <div className="hhba-kpmg-service-detail"><ul>{service.details.map(t=><li key={t}>{t}</li>)}</ul></div>
      </details>
     </article>)}</div>
    {p.business.length>4&&<button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>
     {expanded?'收起其他业务':'查看更多业务（共 '+p.business.length+' 项）'} <ChevronDown size={15}/></button>}
   </section>
  </article>
 </Shell>;
}
