import {ArrowRight,BriefcaseBusiness,Building2} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import '../styles/role-auth.css';
import {BrandMark} from '../components/BrandMark';

/** Public identity choice never grants authorization. */
export function AuthChoicePage(){
 const requested=new URLSearchParams(location.search).get('next');
 const candidateSuffix=requested==='/candidate/official-outbound'?'?next=%2Fcandidate%2Fofficial-outbound':'';
 return <Shell user={null}>
  <section className="hhba-role-auth" aria-labelledby="role-auth-title">
   <div className="hhba-role-frame">
    <div className="hhba-auth-page-logo"><BrandMark variant="icon" size="hero"/></div>
    <div className="hhba-role-intro">
     <h1 id="role-auth-title">欢迎来到 HHBA</h1>
     <p>选择你的使用身份，我们将带你进入相应的账户。</p>
    </div>
    <div className="hhba-role-options">
     <Link className="hhba-role-option" to={'/candidate/login'+candidateSuffix}>
      <span className="hhba-role-option-icon"><BriefcaseBusiness size={20} aria-hidden="true"/></span>
      <span className="hhba-role-option-copy"><strong>我是求职者</strong><small>发现机会 · 收藏职位 · 管理简历</small></span>
      <ArrowRight size={18} aria-hidden="true" className="hhba-role-option-arrow"/>
     </Link>
     <Link className="hhba-role-option" to="/recruiter/login">
      <span className="hhba-role-option-icon"><Building2 size={20} aria-hidden="true"/></span>
      <span className="hhba-role-option-copy"><strong>我是招聘方</strong><small>企业认证 · 招聘管理 · 发展帮扶</small></span>
      <ArrowRight size={18} aria-hidden="true" className="hhba-role-option-arrow"/>
     </Link>
    </div>
    <p className="hhba-role-helper">尚未注册？选择身份后可以直接创建账户。</p>
    <div className="hhba-role-divider"><span>或</span></div>
    <Link className="hhba-role-browse" to="/candidate/jobs">暂不登录，浏览招聘市场 <ArrowRight size={15}/></Link>
   </div>
   <p className="hhba-role-footer">HHBA · 让劳动更有尊严，让商业更有温度</p>
  </section>
 </Shell>;
}
