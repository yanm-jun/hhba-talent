import {ArrowRight,Search} from 'lucide-react';
import {useState,type MouseEvent} from 'react';
import {recruitmentTarget,rememberRecruitment} from '../services/recruitmentOutbound';
import { Link, navigate, useNavigate, useRoute } from '../router';
import {employerApiReady,type User} from '../services/api';
import {realAuthReady} from '../services/realAuth';
import { CandidateAccountDropdown } from './CandidateAccountDropdown';
import { BrandMark } from './BrandMark';
import '../styles/demo-nav.css';
import '../styles/experience-navigation.css';
import '../styles/site-search.css';

// Navigation is contextual: a public landing page is not a candidate account
// and a recruiter is NEVER granted the internal HHBA reviewer/admin role.
type Experience='public'|'candidate';
function experienceForRoute(route:string,signedIn:boolean):Experience {
 // Public job listings and company directories do not become private workspaces on login.
 if(route==='/candidate')return signedIn?'candidate':'public';
 if(/^\/candidate\/(?:account(?:\/|$)|match(?:\/|$)|saved(?:\/|$)|resume(?:\/|$)|review(?:\/|$)|profile(?:\/|$))/.test(route))return 'candidate';
 return 'public';
}
// The talent-service entry must be identical in all three navigation contexts.
function StudyAbroadNavLink({active}:{active:boolean}){
 return <Link className="auth hhba-study-nav-link" to="/study-abroad" aria-current={active?'page':undefined}>海外发展</Link>;
}
function TalentPolicyNavLink({active}:{active:boolean}){
 return <Link className="auth hhba-talent-policy-nav" to="/talent-service" aria-current={active?'page':undefined}>人才政策</Link>;
}
function HeaderSiteSearch(){
 const [value,setValue]=useState('');
 return <form className="hhba-header-site-search" role="search" aria-label="汇方职场 HHBA 全站搜索"
   onSubmit={event=>{event.preventDefault();navigate('/search'+(value.trim()?'?q='+encodeURIComponent(value.trim().slice(0,100)):''));}}>
   <Search aria-hidden="true" size={16}/>
   <input type="search" name="q" value={value} maxLength={100} onChange={event=>setValue(event.target.value)}
     aria-label="搜索汇方职场 HHBA 站内所有公开内容" placeholder="搜索汇方职场全站…" />
   <button type="submit" aria-label="提交全站搜索"><ArrowRight size={15}/></button>
 </form>;
}
export function SiteFooter(){
 const columns=[
  {title:'求职服务',links:[
   ['我要应聘','/candidate/jobs'],
   ['智能岗位匹配','/candidate/match'],
   ['我的简历','/candidate/account/resume'],
   ['我的收藏','/candidate/saved'],
   ['匹配历史','/candidate/account/applications'],
   ['一键网申','/candidate/account/apply-assistant'],
   ['职业成长档案','/candidate/account/career'],
  ]},
  {title:'职业机会',links:[
   ['招聘市场','/candidate/jobs'],
   ['企业招聘导航','/companies/library'],
   ['海外发展','/study-abroad'],
   ['人才政策','/talent-service'],
  ]},
  {title:'劳动者权益',links:[
   ['会员与权益服务','/rights'],
   ['劳动权益知识','/rights/knowledge'],
   ['高性价比职场指南','/rights/guide'],
   ['责任与透明','/transparency'],
  ]},
  {title:'关于汇方',links:[
   ['品牌介绍','/vision'],
   ['加入我们','/join'],
   ['运营数据说明','/data-use'],
  ]},
  {title:'服务与帮助',links:[
   ['全站搜索','/search'],
   ['会员服务规则','/membership/rules'],
   ['责任与透明','/transparency'],
  ]},
 ] as const;
 return <footer className="hhba-site-footer">
  <div className="hhba-site-footer-grid">
   <div className="hhba-site-footer-brand">
    <Link to="/" aria-label="返回汇方职场首页"><BrandMark variant="lockup" size="small"/></Link>
    <p>让机会与人才，找到彼此。</p>
    <small>HHBA · Human Capability Network</small>
   </div>
   {columns.map(column=><section className="hhba-site-footer-column" key={column.title}>
    <h2>{column.title}</h2>
    <nav aria-label={column.title}>
     {column.links.map(([label,to])=><Link key={to+label} to={to}>{label}</Link>)}
    </nav>
   </section>)}
  </div>
  <div className="hhba-site-footer-bottom">
   <span>© {new Date().getFullYear()} 汇方职场 · HHBA</span>
   <span>让机会与人才，找到彼此。</span>
   <div>
    <Link to="/data-use">运营数据说明</Link>
    <Link to="/transparency">责任与透明</Link>
    <Link to="/membership/rules">会员服务规则</Link>
   </div>
  </div>
 </footer>;
}

export function Shell({ user, children, embedded=false }: { user: User | null; children: React.ReactNode; embedded?: boolean }) {
 const navigate=useNavigate();
 const route=useRoute();
 const experience=experienceForRoute(route,!!user?.account_types?.includes('candidate'));
 const hasCandidate=!!user?.account_types?.includes('candidate');
 const candidateSignedIn=hasCandidate;
 // Only a verified HHBA account session may unlock official recruiting outlinks.
 // A local demo account must never satisfy this requirement.
 const verifiedCandidate=hasCandidate&&(employerApiReady||realAuthReady);
 // Central capture covers all recruiting links across existing company/job pages,
 // not merely the example highlighted by the user.
 function guardRecruitmentClick(event:MouseEvent<HTMLElement>){
  if(route.startsWith('/admin')||route.startsWith('/employer')||route.startsWith('/recruiter'))return;
  if(event.defaultPrevented||!(event.target instanceof Element))return;
  const anchor=event.target.closest<HTMLAnchorElement>('a[href]');
  if(!anchor)return;
  const destination=recruitmentTarget(anchor);
  if(!destination&&anchor.dataset.hhbaRecruitmentOutbound==='true'){
   event.preventDefault();event.stopPropagation();return;
  }
  if(!destination||verifiedCandidate)return;
  event.preventDefault();
  event.stopPropagation();
  rememberRecruitment(destination,anchor.textContent||anchor.getAttribute('aria-label')||'官方招聘渠道',
   route+location.search);
  if(/^\/winter-internship(?:\/[a-z0-9-]{3,100})?$/.test(route)){
   const next=route+'?resumeRecruitment=1';
   navigate('/candidate/login?next='+encodeURIComponent(next));
  }else{
   navigate('/candidate/register?next=%2Fcandidate%2Fofficial-outbound');
  }
 }
 function guardRecruitmentContextMenu(event:MouseEvent<HTMLElement>){
  if(verifiedCandidate||route.startsWith('/admin')||route.startsWith('/employer')||route.startsWith('/recruiter'))return;
  if(!(event.target instanceof Element))return;
  const anchor=event.target.closest<HTMLAnchorElement>('a[href]');
  if(anchor&&(recruitmentTarget(anchor)||anchor.dataset.hhbaRecruitmentOutbound==='true'))event.preventDefault();
 }
 if(embedded)return <>{children}</>;
 return <main onClickCapture={guardRecruitmentClick} onAuxClickCapture={guardRecruitmentClick}
    onContextMenuCapture={guardRecruitmentContextMenu} className={'app-shell hhba-experience-'+experience}>
  <header className="topbar hhba-experience-header">
   <div className="hhba-experience-brand">
    <Link className="logo hhba-main-brand-link" to="/" aria-label="汇方职场 HHBA 公共首页"><BrandMark/></Link>
    {experience==='candidate'&&<span className="hhba-experience-label">个人用户端</span>}
   </div>
   <nav aria-label={experience==='public'?'公共网站导航':'个人职业服务导航'}>
    <HeaderSiteSearch/>
    <StudyAbroadNavLink active={route.startsWith('/study-abroad')}/>
    <TalentPolicyNavLink active={route.startsWith('/talent-service')}/>
    <Link className="auth" to="/candidate/jobs">招聘市场</Link>
    <Link className="join-nav-link" to="/join">加入我们</Link>
    {candidateSignedIn?<CandidateAccountDropdown displayName={user?.display_name}/>:<Link className="hhba-nav-account" to="/auth">登录 / 注册</Link>}
   </nav>
  </header>
  {children}
  <SiteFooter/>
 </main>;
}