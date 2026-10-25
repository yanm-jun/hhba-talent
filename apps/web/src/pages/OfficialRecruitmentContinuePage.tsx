import {ArrowLeft,ArrowUpRight,ExternalLink,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {employerApiReady,type User} from '../services/api';
import {clearPendingRecruitment,pendingRecruitment} from '../services/recruitmentOutbound';
import '../styles/recruitment-outbound.css';

// The destination is kept in tab-local sessionStorage, NOT an unvalidated next= URL.
// Users consent to leaving HHBA with an explicit click after finishing login.
export function OfficialRecruitmentContinuePage({user}:{user:User|null}){
 const signed=employerApiReady&&!!user?.account_types?.includes('candidate');
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
    {!employerApiReady?<><h2>正式账户服务尚未开通</h2>
      <p>当前 HHBA 静态网站只提供前端账户体验，并没有连接真实注册与登录服务器。
       模拟注册和模拟登录不属于正式 HHBA 注册用户，因此暂时不能解锁跳转到外部招聘官网。</p>
      <p>你可以继续免费浏览全部企业介绍、专业信息和岗位详情。等正式账户服务接入后，完成求职者注册或登录才能继续前往官方招聘页面。</p>
      <Link className="hhba-outbound-secondary" to="/candidate/register">查看账户体验页面（非正式注册）</Link>
     </>:!signed?<><h2>请先注册或登录求职者账户</h2>
      <p>公开企业资料可以自由浏览；前往第三方招聘网站前，需要真实的 HHBA 求职者账户。</p>
      <Link className="hhba-outbound-primary" to="/candidate/register?next=%2Fcandidate%2Fofficial-outbound">注册求职者账户 <ArrowUpRight size={16}/></Link>
      <Link className="hhba-outbound-secondary" to="/candidate/login?next=%2Fcandidate%2Fofficial-outbound">已有账户？登录</Link>
     </>:!saved?<><h2>原招聘链接已过期</h2>
      <p>为了避免访问错误地址，尚未保存或已过期的外部招聘链接不能自动继续。请返回原企业页面重新选择官方招聘渠道。</p>
     </>:<><h2>账户流程已完成</h2>
      <p>原目标：<strong>{saved.title}</strong></p>
      <a className="hhba-outbound-primary" href={saved.url} target="_blank" rel="noopener noreferrer"
       onClick={()=>clearPendingRecruitment()}>继续访问原招聘官网 <ExternalLink size={16}/></a>
      <small>即将离开 HHBA，官方岗位和投递状态请以企业网站为准。</small>
     </>}
    <Link className="hhba-outbound-back" to={back}><ArrowLeft size={15}/> 返回刚才的企业或岗位页面</Link>
   </div>
  </section>
 </Shell>;
}
