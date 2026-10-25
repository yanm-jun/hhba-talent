import {ArrowLeft,ArrowUpRight,ExternalLink,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {demoModeEnabled,useDemoAccount} from '../services/demoAccount';
import {clearPendingRecruitment,pendingRecruitment} from '../services/recruitmentOutbound';
import type {User} from '../services/api';
import '../styles/recruitment-outbound.css';

// The destination is kept in tab-local sessionStorage, NOT an unvalidated next= URL.
// Users consent to leaving HHBA with an explicit click after finishing login.
export function OfficialRecruitmentContinuePage({user}:{user:User|null}){
 const demo=useDemoAccount();
 const signed=!!user?.account_types?.includes('candidate')||(demoModeEnabled&&!!demo);
 const saved=pendingRecruitment();
 const back=saved?.origin&&saved.origin.startsWith('/')&&!saved.origin.startsWith('//')?
  saved.origin:'/candidate/jobs';
 return <Shell user={user}>
  <section className="hhba-outbound-gate">
   <div className="hhba-outbound-heading"><ShieldCheck size={27}/>
    <p>HHBA · 招聘渠道访问</p><h1>继续访问企业官方招聘页面</h1>
    <span>您浏览过的企业与岗位信息仍然保留；仅在前往企业外部招聘系统前核对账户状态。</span>
   </div>
   <div className="hhba-outbound-panel">
    {!signed?<><h2>请先注册或登录求职者账户</h2>
      <p>无需注册即可浏览企业介绍、专业方向和招聘岗位；访问第三方招聘渠道需要先完成 HHBA 账户流程。</p>
      <Link className="hhba-outbound-primary" to="/candidate/register?next=%2Fcandidate%2Fofficial-outbound">注册求职者账户 <ArrowUpRight size={16}/></Link>
      <Link className="hhba-outbound-secondary" to="/candidate/login?next=%2Fcandidate%2Fofficial-outbound">已有账户？登录</Link>
     </>:!saved?<><h2>原招聘链接已过期</h2>
      <p>为了避免访问错误地址，尚未保存或已过期的外部招聘链接不能自动继续。请返回原企业页面重新选择官方招聘渠道。</p>
     </>:<><h2>账户流程已完成</h2>
      <p>原目标：<strong>{saved.title}</strong></p>
      {demoModeEnabled&&<p className="hhba-outbound-demo"><ShieldCheck size={16}/>
       当前 GitHub Pages 为演示账户流程，并非真实手机号或企业身份认证；不会将此演示状态视为正式求职者认证。</p>}
      <a className="hhba-outbound-primary" href={saved.url} target="_blank" rel="noopener noreferrer"
       onClick={()=>clearPendingRecruitment()}>继续访问原招聘官网 <ExternalLink size={16}/></a>
      <small>即将离开 HHBA，官方岗位和投递状态请以企业网站为准。</small>
     </>}
    <Link className="hhba-outbound-back" to={back}><ArrowLeft size={15}/> 返回刚才的企业或岗位页面</Link>
   </div>
  </section>
 </Shell>;
}
