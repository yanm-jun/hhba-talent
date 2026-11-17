import {ArrowRight,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/retired-enterprise.css';

/**
 * Preserves a clear, non-interactive notice for bookmarked legacy B-end routes.
 * Never initiates a recruiter session, loads applications, or renders company data.
 * Historical submissions may carry retention obligations and are not purged here.
 */
export function RetiredEnterprisePage({user}:{user:User|null}){
 return <Shell user={user}>
  <section className="hhba-retired-enterprise" aria-labelledby="hhba-retired-title">
   <span className="hhba-retired-enterprise-icon"><ShieldCheck size={25} aria-hidden="true"/></span>
   <p className="hhba-retired-enterprise-kicker">HHBA · BUSINESS RETIREMENT</p>
   <h1 id="hhba-retired-title">企业招聘业务已停止提供</h1>
   <p>HHBA 已转为面向个人的职业与劳动权益服务平台，不再接受企业招聘注册、企业认证、站内职位发布、人才检索或新站内申请。</p>
   <p>旧申请与企业账户资料不会因为页面下线而被擅自清空；如需查阅、处理或申请删除相关个人数据，请通过平台公布的隐私联系渠道提出请求。</p>
   <div className="hhba-retired-enterprise-actions">
    <Link to="/candidate/jobs">浏览官方招聘岗位 <ArrowRight size={16}/></Link>
    <Link to="/candidate/account">进入个人中心 <ArrowRight size={16}/></Link>
   </div>
   <p className="hhba-retired-enterprise-note">企业官网招聘导航及公开招聘索引继续提供；本提示不表示 HHBA 与任何雇主存在合作。</p>
  </section>
 </Shell>;
}
