import {ArrowRight,ArrowUpRight,BriefcaseBusiness,Building2,Check,Compass,FileCheck2,ShieldCheck,UserRound} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import '../styles/role-auth.css';
import '../styles/career-refresh.css';
import '../styles/role-auth-redesign.css';

/** A public entry page: role selection routes to the existing real-auth pages only. */
export function AuthChoicePage(){
 const requested=new URLSearchParams(location.search).get('next');
 const candidateSuffix=requested==='/candidate/match'?'?next=%2Fcandidate%2Fmatch':requested==='/candidate/official-outbound'?'?next=%2Fcandidate%2Fofficial-outbound':'';
 return <Shell user={null}>
  <section className="hhba-role-auth hhba-role-auth-v2" aria-labelledby="role-auth-title">
   <div className="hhba-auth-v2-layout">
    <div className="hhba-auth-v2-editorial">
     <div className="hhba-auth-v2-editorial-body">
      <span className="hhba-auth-v2-kicker"><span className="hhba-auth-v2-kicker-dot"/> HHBA · 一个平台，贯穿职业旅程</span>
      <h1 id="role-auth-title">你的下一步，<br/><span>不止于找到工作。</span></h1>
      <p className="hhba-auth-v2-lead">从发现合适的机会，到真正走进企业，再到职业成长与劳动权益支持。你的职业旅程，可以从这里持续向前。</p>
      <div className="hhba-auth-v2-journey" aria-label="HHBA 个人职业服务路径">
       <div className="hhba-auth-v2-milestone">
        <span className="hhba-auth-v2-milestone-icon"><Compass size={18} aria-hidden="true"/></span>
        <div><strong>寻找机会</strong><small>AI 岗位匹配 · 官方招聘入口</small></div>
        <span className="hhba-auth-v2-milestone-number">01</span>
       </div>
       <div className="hhba-auth-v2-milestone">
        <span className="hhba-auth-v2-milestone-icon"><BriefcaseBusiness size={18} aria-hidden="true"/></span>
        <div><strong>走进职场</strong><small>个人职业档案 · 工作成果记录</small></div>
        <span className="hhba-auth-v2-milestone-number">02</span>
       </div>
       <div className="hhba-auth-v2-milestone">
        <span className="hhba-auth-v2-milestone-icon"><ShieldCheck size={18} aria-hidden="true"/></span>
        <div><strong>了解你的权益</strong><small>企业公开信息 · 职场权益服务规划</small></div>
        <span className="hhba-auth-v2-milestone-number">03</span>
       </div>
      </div>
     </div>
     <div className="hhba-auth-v2-editorial-signature">
      <span className="hhba-auth-v2-signature-mark" aria-hidden="true"><Check size={15}/></span>
      <span>让机会与人才，找到彼此。</span>
      <span className="hhba-auth-v2-signature-en">CAREER · GROWTH · RIGHTS</span>
     </div>
    </div>
    <div className="hhba-auth-v2-panel">
     <div className="hhba-auth-v2-panel-top">
      <span>ACCOUNT ACCESS</span><span className="hhba-auth-v2-panel-line"/>
     </div>
     <div className="hhba-auth-v2-panel-header">
      <span className="hhba-auth-v2-welcome">欢迎来到 HHBA 汇方职场</span>
      <h2>选择你的使用身份</h2>
      <p>已有账号可以直接登录；初次使用也可在选择身份后注册。</p>
     </div>
     <div className="hhba-auth-v2-choices">
      <Link className="hhba-auth-v2-choice hhba-auth-v2-choice-personal" to={'/candidate/login'+candidateSuffix}>
       <div className="hhba-auth-v2-choice-head">
        <span className="hhba-auth-v2-choice-icon"><UserRound size={23} aria-hidden="true"/></span>
        <span className="hhba-auth-v2-choice-index">01 / PERSONAL</span>
        <ArrowUpRight size={20} className="hhba-auth-v2-choice-arrow" aria-hidden="true"/>
       </div>
       <strong>我是个人用户</strong>
       <small>求职、入职、成长与权益，一个账户持续使用。</small>
       <span className="hhba-auth-v2-choice-tags">求职匹配 <i/> 职业档案 <i/> 职场权益</span>
      </Link>
      <Link className="hhba-auth-v2-choice hhba-auth-v2-choice-business" to="/recruiter/login">
       <div className="hhba-auth-v2-choice-head">
        <span className="hhba-auth-v2-choice-icon"><Building2 size={23} aria-hidden="true"/></span>
        <span className="hhba-auth-v2-choice-index">02 / EMPLOYER</span>
        <ArrowUpRight size={20} className="hhba-auth-v2-choice-arrow" aria-hidden="true"/>
       </div>
       <strong>我是招聘方</strong>
       <small>企业身份认证、招聘管理和人才服务。</small>
       <span className="hhba-auth-v2-choice-tags">企业认证 <i/> 人才招聘 <i/> 企业管理</span>
      </Link>
     </div>
     <div className="hhba-auth-v2-browse">
      <span>只是想先看看机会？</span>
      <Link to="/candidate/jobs">免登录浏览招聘市场 <ArrowRight size={16} aria-hidden="true"/></Link>
     </div>
     <Link className="hhba-auth-v2-rights-preview" to="/candidate/account/rights">
      <span className="hhba-auth-v2-rights-icon"><FileCheck2 size={18} aria-hidden="true"/></span>
      <span><strong>职场权益支持会员 · ¥24.90/月</strong><small>了解服务规划，当前尚未开放购买</small></span>
      <ArrowRight size={16} aria-hidden="true"/>
     </Link>
    </div>
   </div>
   <p className="hhba-role-footer hhba-auth-v2-footer">汇方职场 HHBA · 让劳动更有尊严，让商业更有温度</p>
  </section>
 </Shell>;
}
