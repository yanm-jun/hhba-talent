import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { Link, navigate } from '../router';
import { Shell } from '../components/Shell';
import { UnifiedJobMarket } from '../components/UnifiedJobMarket';
import { HomeCompanyMarquee } from '../components/HomeCompanyMarquee';
import { HomePeopleBanner } from '../components/HomePeopleBanner';
import { HomeOpenLetter } from '../components/HomeOpenLetter';
import type { User } from '../services/api';

function EntryCard({kind,title,body,footer}:{kind:'candidate'|'employer';title:string;body:string;footer:string}){
 const Icon=kind==='candidate'?BriefcaseBusiness:UsersRound;
 const target=kind==='candidate'?'/candidate/register':'/employer/start';
 return <Link to={target} className={'entry-card hhba-entry-card hhba-entry-'+kind}
   aria-label={title+'，'+footer}>
   <span className="entry-icon"><Icon size={23}/></span>
   <span className="hhba-entry-copy"><strong>{title}</strong><small>{body}</small></span>
   <span className="entry-footer">{footer}<ArrowUpRight size={15}/></span>
 </Link>;
}

export function HomePage({user}:{user:User|null}){
 return <Shell user={user}>
  <section className="home-hero hhba-public-hero">
   <p className="hhba-public-eyebrow">HHBA · HUMAN CAPABILITY NETWORK</p>
   <h1>让机会与人才，找到彼此。</h1>
   <p>你来到这里，是为了什么？</p>
   <button type="button" className="hhba-letter-revisit" onClick={()=>window.dispatchEvent(new Event("hhba:open-letter"))}> <span aria-hidden="true">✉</span> 读一封来自 HHBA 的信</button>
  </section>
  <section className="entry-grid hhba-public-entry-grid" aria-label="选择使用入口">
   <EntryCard kind="candidate" title="我要应聘"
    body="我是求职者，希望建立个人账户，找到适合自己的工作。"
    footer="进入求职者注册 / 登录"/>
   <EntryCard kind="employer" title="我要招人"
    body="我是企业招聘负责人，想了解 HHBA 的招聘、企业信誉与治理服务。"
    footer="了解企业招聘与治理"/>
  </section>
  <div className="hhba-public-browse" aria-label="无需注册的公开浏览入口">
   <div><ShieldCheck size={17}/><span>你也可以先了解 HHBA，再决定是否注册。公开岗位和企业资料无需登录。</span></div>
   <Link to="/candidate/jobs">先浏览招聘市场 <ArrowRight size={15}/></Link>
  </div>
  <div className="home-match-promo">
   <div><strong>你也可以上传简历，让 HHBA 帮你找合适岗位</strong>
    <p>全平台统一提供 DeepSeek，匹配官方招聘岗位，分析符合条件和能力差距。</p></div>
   <button type="button" onClick={()=>navigate('/candidate/match')}>使用简历智能匹配 <ArrowUpRight size={16}/></button>
  </div>
  <UnifiedJobMarket compact/>
  <section className="home-company-discover-link" style={{maxWidth:1120,margin:'0 auto 32px',padding:'20px 22px',background:'#fff',border:'1px solid var(--line)',borderRadius:12,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:14}}>
   <div><strong>企业发现 · 200 家国内企业</strong><p style={{color:'var(--muted)',fontSize:13,margin:'7px 0 0'}}>按企业名称、行业和所学专业了解企业与官方招聘渠道，资料状态逐项标注。</p></div>
   <Link to="/companies/discover" style={{display:'inline-flex',alignItems:'center',gap:7,color:'#265e45',fontSize:13,fontWeight:700,textDecoration:'none'}}>探索 200 家企业 <ArrowUpRight size={15}/></Link>
  </section>
  <HomeCompanyMarquee/>
  <HomePeopleBanner/>
  <HomeOpenLetter/>
 </Shell>;
}
