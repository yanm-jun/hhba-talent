import { Link } from '../router';
import { Shell } from '../components/Shell';
import type { User } from '../services/api';

export function Phase1UnavailablePage({ user }: { user: User | null }) {
  return <Shell user={user}>
    <section className="phase1-unavailable" aria-labelledby="phase1-unavailable-title">
      <p className="phase1-unavailable-kicker">HHBA 第一阶段</p>
      <h1 id="phase1-unavailable-title">此功能暂未开放</h1>
      <p>HHBA 当前提供企业信息、企业文化研究与劳动权益知识。账户注册、简历上传与解析、站内投递、企业认证、职位发布、人才检索和企业评价功能正在完成合规与安全准备。</p>
      <p>我们不会在准备完成前收集或处理这些业务数据。</p>
      <div className="phase1-unavailable-actions">
        <Link to="/companies/discover">浏览企业信息</Link>
        <Link to="/candidate/account/legal-aid">查看劳动权益知识</Link>
      </div>
    </section>
  </Shell>;
}
