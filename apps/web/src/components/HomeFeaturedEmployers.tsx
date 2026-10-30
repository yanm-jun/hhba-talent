import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from '../router';
import { companyProfiles } from '../services/companyProfiles';
import { verifiedBrandRecords } from '../services/verifiedBrandRegistry';
import '../styles/home-featured-employers.css';

// Curated, reviewed profiles; never reuse historical domestic vacancies as a home feed.
const featuredSlugs=['openai','anthropic','spacex'] as const;
const brands=verifiedBrandRecords();
const featured=featuredSlugs.map(slug=>{
 const company=companyProfiles[slug];
 const logo=brands.find(b=>b.company===company.name);
 return {...company,logo};
});
function officialUrl(url:string){
 try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:null}
 catch{return null}
}
export function HomeFeaturedEmployers(){
 return <section className="hhba-featured-employers" aria-labelledby="hhba-featured-title">
  <div className="hhba-featured-heading"><div>
   <span className="hhba-featured-eyebrow">HHBA · FEATURED COMPANIES</span>
   <h2 id="hhba-featured-title">精选企业</h2>
   <p>了解企业的业务与发展方向，再到官方招聘网站查看正在开放的机会。</p>
  </div></div>
  <div className="hhba-featured-grid">{featured.map(company=><article className="hhba-featured-card" key={company.slug}>
   <div className="hhba-featured-company">
    <span className="hhba-featured-logo">
     {company.logo?<img src={import.meta.env.BASE_URL+'brands/'+company.logo.file}
      alt={company.logoAlt.zh} loading="eager" decoding="async"/>:
      <span aria-hidden="true">{company.name.slice(0,1)}</span>}
    </span>
    <div><h3>{company.name}</h3><span>{company.industry.zh}</span></div>
   </div>
   <p className="hhba-featured-summary">{company.tagline.zh}</p>
   <p className="hhba-featured-evidence">企业资料已整理 · 当前岗位以官方招聘页为准</p>
   <div className="hhba-featured-actions">
    <Link to={'/companies/'+company.slug}>了解企业 <ArrowRight size={15}/></Link>
    {officialUrl(company.careers)&&<a data-hhba-recruitment-outbound="true" href={officialUrl(company.careers)!}
      target="_blank" rel="noopener noreferrer">官方招聘 <ExternalLink size={15}/></a>}
   </div>
  </article>)}</div>
 </section>;
}
