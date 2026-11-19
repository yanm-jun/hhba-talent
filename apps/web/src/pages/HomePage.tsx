import { ArrowUpRight, BriefcaseBusiness, Building2, Scale, Sparkles } from 'lucide-react';
import { Link, navigate } from '../router';
import { Shell } from '../components/Shell';
import { UnifiedJobMarket } from '../components/UnifiedJobMarket';
import { HomeCompanyMarquee } from '../components/HomeCompanyMarquee';
import { WinterInternshipPopup } from '../components/WinterInternshipPopup';
import { HomeOpenLetter } from '../components/HomeOpenLetter';
import { HomeWorkplacePromise } from '../components/HomeWorkplacePromise';
import { BrandMark } from '../components/BrandMark';
import type { User } from '../services/api';
import '../styles/home-match-promo.css';
import '../styles/home-hero-refined.css';

function EntryCard({kind,title,body,footer}:{kind:'candidate'|'directory'|'rights';title:string;body:string;footer:string}){
 const Icon=kind==='candidate'?BriefcaseBusiness:kind==='rights'?Scale:Building2;
 const target=kind==='candidate'?'/candidate/jobs'
  :kind==='rights'?'/rights':'/companies/library';
 return <Link to={target} className={'entry-card hhba-entry-card hhba-entry-'+kind}
   aria-label={title+'，'+footer}>
   <span className="entry-icon"><Icon size={23}/></span>
   <span className="hhba-entry-copy"><strong>{title}</strong><small>{body}</small></span>
   <span className="entry-footer">{footer}<ArrowUpRight size={15}/></span>
 </Link>;
}

export function HomePage({user}:{user:User|null}){
 return <Shell user={user}>
  <section className="home-hero hhba-public-hero hhba-public-hero-refined" aria-labelledby="hhba-home-hero-title">
   <div className="hhba-public-hero-logo"><BrandMark variant="icon" size="hero"/></div>
   <p className="hhba-public-eyebrow"><span className="hhba-public-brand-cn">汇方职场</span><span>HHBA · HUMAN CAPABILITY NETWORK</span></p>
   <h1 id="hhba-home-hero-title"><span>让机会与人才，</span><span>找到彼此。</span></h1>
   <p className="hhba-home-description">找到机会，做好准备，做出选择。</p>
   <div className="hhba-refined-hero-actions">
    <Link className="hhba-refined-hero-primary" to={user?.account_types?.includes('candidate')?'/candidate/account/resume':'/auth'}>
     开始求职 <ArrowUpRight size={17} aria-hidden="true"/>
    </Link>
    <button type="button" className="hhba-refined-hero-secondary" onClick={()=>window.dispatchEvent(new Event('hhba:open-letter'))}>
     读一封来自 HHBA 的信 <ArrowUpRight size={15} aria-hidden="true"/>
    </button>
   </div>
  </section>
  <section className="entry-grid hhba-public-entry-grid hhba-home-entry-grid" aria-label="选择使用入口">
   <EntryCard kind="candidate" title="我要应聘"
    body="浏览真实企业招聘岗位和官方投递渠道，也可以使用 AI 简历匹配服务。"
    footer="查看招聘市场与岗位"/>
   <EntryCard kind="rights" title="劳动权益支持"
    body="了解劳动权益知识与 HHBA 服务规划；会员服务和案件申请尚未开放。"
    footer="查看权益支持说明"/>
   <EntryCard kind="directory" title="企业招聘导航"
    body="按行业、企业或专业查找招聘渠道，浏览17个行业馆的官方招聘入口。"
    footer="查看企业与招聘入口"/>
  </section>
  <section className="home-match-promo" aria-labelledby="home-match-promo-title">
   <div className="home-match-promo-copy">
    <span className="home-match-promo-icon" aria-hidden="true"><Sparkles size={20}/></span>
    <div><span className="home-match-promo-kicker">HHBA AI MATCH</span><strong id="home-match-promo-title">让 AI 先理解你，再帮你寻找合适岗位</strong>
     <p>从简历提取职业能力，分析岗位要求与能力差距，优先寻找企业官方招聘信息。</p></div>
   </div>
   <button type="button" onClick={()=>navigate('/candidate/match')}>
    <span>开始智能匹配</span><ArrowUpRight size={17}/>
   </button>
  </section>
  <UnifiedJobMarket compact/>
  <HomeWorkplacePromise/>
  <section className="home-talent-service-link" style={{maxWidth:1120,margin:'0 auto 32px',padding:'22px',background:'linear-gradient(110deg,#EDF4FF,#fff)',border:'1px solid #D8E6F9',borderRadius:14,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:14}}>
   <div><strong>人才服务 · 从工作机会到城市生活</strong><p style={{color:'#60758F',fontSize:13,margin:'7px 0 0'}}>看看人才公寓、城市人才政策、住房与生活补贴，以及申请指南（静态预览）。</p></div>
   <Link to="/talent-service" style={{display:'inline-flex',alignItems:'center',gap:7,color:'#125EBC',fontSize:13,fontWeight:700,textDecoration:'none'}}>了解人才服务 <ArrowUpRight size={15}/></Link>
  </section>
  <HomeCompanyMarquee/>
  <HomeOpenLetter autoOpen={false}/>
  <WinterInternshipPopup/>
 </Shell>;
}
