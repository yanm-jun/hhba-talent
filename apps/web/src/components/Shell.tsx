import {ArrowUpRight,Building2,BriefcaseBusiness} from 'lucide-react';
import type {MouseEvent} from 'react';
import {recruitmentTarget,rememberRecruitment} from '../services/recruitmentOutbound';
import { Link, useNavigate, useRoute } from '../router';
import {employerApiReady,type User} from '../services/api';
import { CandidateAccountDropdown } from './CandidateAccountDropdown';
import {demoModeEnabled,useDemoAccount,exitDemoAccount} from '../services/demoAccount';
import '../styles/demo-nav.css';
import '../styles/experience-navigation.css';

// Navigation is contextual: a public landing page is not a candidate account
// and a recruiter is NEVER granted the internal HHBA reviewer/admin role.
type Experience='public'|'candidate'|'employer';
function experienceForRoute(route:string):Experience {
 if(route==='/')return 'public';
 if(route.startsWith('/employer')||route.startsWith('/recruiter'))return 'employer';
 if(route.startsWith('/candidate')||route.startsWith('/companies')||
    route.startsWith('/majors')||route.startsWith('/public/'))return 'candidate';
 return 'public';
}
export function Shell({ user, children }: { user: User | null; children: React.ReactNode }) {
 const navigate=useNavigate();
 const route=useRoute();
 const experience=experienceForRoute(route);
 const demo=useDemoAccount();
 const hasCandidate=!!user?.account_types?.includes('candidate');
 const hasRecruiter=!!user?.account_types?.includes('recruiter');
 const candidateSignedIn=hasCandidate||(demoModeEnabled&&!!demo);
 // Only a verified HHBA account session may unlock official recruiting outlinks.
 // A local demo account must never satisfy this requirement.
 const verifiedCandidate=employerApiReady&&hasCandidate;
 const recruiterSignedIn=hasRecruiter;
 const employerEntry=recruiterSignedIn?'/employer/hub':'/employer/onboarding-preview';
 // Central capture covers all recruiting links across existing company/job pages,
 // not merely the example highlighted by the user.
 function guardRecruitmentClick(event:MouseEvent<HTMLElement>){
  // Administrative review and employer-side evidence links are not candidate apply actions.
  if(route.startsWith('/admin')||route.startsWith('/employer')||route.startsWith('/recruiter'))return;
  if(event.defaultPrevented||!(event.target instanceof Element))return;
  const anchor=event.target.closest<HTMLAnchorElement>('a[href]');
  if(!anchor)return;
  const destination=recruitmentTarget(anchor);
  if(!destination||verifiedCandidate)return;
  event.preventDefault();
  event.stopPropagation();
  rememberRecruitment(destination,anchor.textContent||anchor.getAttribute('aria-label')||'官方招聘渠道',
   route+location.search);
  navigate('/candidate/register?next=%2Fcandidate%2Fofficial-outbound');
 }
 function guardRecruitmentContextMenu(event:MouseEvent<HTMLElement>){
  if(verifiedCandidate||route.startsWith('/admin')||route.startsWith('/employer')||route.startsWith('/recruiter'))return;
  if(!(event.target instanceof Element))return;
  const anchor=event.target.closest<HTMLAnchorElement>('a[href]');
  if(anchor&&recruitmentTarget(anchor))event.preventDefault();
 }
 return <main onClickCapture={guardRecruitmentClick} onAuxClickCapture={guardRecruitmentClick}
    onContextMenuCapture={guardRecruitmentContextMenu} className={'app-shell hhba-experience-'+experience}>
  <header className="topbar hhba-experience-header">
   <div className="hhba-experience-brand">
    <Link className="logo" to="/" aria-label="HHBA 公共首页">HHBA.</Link>
    {experience==='candidate'&&<span className="hhba-experience-label">求职者端</span>}
    {experience==='employer'&&<span className="hhba-experience-label">企业端</span>}
   </div>
   {experience==='public'?<nav aria-label="公共网站导航">
     <Link className="auth" to="/candidate/jobs">招聘市场</Link>
     <Link className="auth" to="/companies/discover">企业发现</Link>
     <Link className="join-nav-link" to="/join">加入我们</Link>
     {candidateSignedIn?<Link className="hhba-nav-account" to="/candidate/account">个人中心</Link>:
       recruiterSignedIn?<Link className="hhba-nav-account" to="/employer/hub">企业账户</Link>:
       <Link className="hhba-nav-account" to="/candidate/register">登录 / 注册</Link>}
   </nav>:experience==='candidate'?<nav aria-label="求职者服务导航">
     <Link className="auth" to="/candidate/jobs">招聘市场</Link>
     <Link className="auth" to="/companies/discover">企业发现</Link>
     <Link className="auth" to="/candidate/saved">我的收藏</Link>
     <Link className="hhba-nav-switch" to="/employer/start">我要招人 <ArrowUpRight size={13}/></Link>
     {candidateSignedIn?<><CandidateAccountDropdown/>
       {demoModeEnabled&&demo&&<button type="button" className="text-button" onClick={()=>{exitDemoAccount();navigate('/candidate/login')}}>退出演示</button>}
       {hasCandidate&&<Link className="hhba-nav-account" to="/candidate/account">{user?.display_name||'个人中心'}</Link>}
      </>:<Link className="hhba-nav-account" to="/candidate/register">登录 / 注册</Link>}
   </nav>:<nav aria-label="企业招聘与治理导航">
     <Link className="auth" to="/employer/start">企业服务</Link>
     <Link className="auth" to="/employer/hub">企业工作台</Link>
     <Link className="auth" to="/employer/workspace">职位与人才</Link>
     <Link className="auth" to="/employer/growth">企业治理</Link>
     <Link className="auth" to="/employer/aid">发展帮扶</Link>
     <Link className="hhba-nav-switch" to="/candidate/jobs">返回求职端 <BriefcaseBusiness size={13}/></Link>
     {recruiterSignedIn?<Link className="hhba-nav-account" to="/employer/hub"><Building2 size={14}/> 企业账户</Link>:
       <Link className="hhba-nav-account" to={employerEntry}>企业入驻</Link>}
   </nav>}
  </header>
  {children}
 </main>;
}
