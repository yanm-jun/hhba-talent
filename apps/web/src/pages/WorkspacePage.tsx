import { Shell } from '../components/Shell';
import { Link } from '../router';
import type { User } from '../services/api';
export function WorkspacePage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) { return <Shell user={user}><section className="content-page"><div className="eyebrow">我的工作区</div><h1>你好，{user.display_name}。</h1><p>这里统一管理你的职业档案、求职工具和权益资料。</p><div className="workspace-grid"><Link to="/candidate" className="workspace-card"><b>个人能力档案</b><span>上传、解析、核对与发布可撤回名片</span></Link><Link to="/candidate/account/rights" className="workspace-card"><b>职场权益中心</b><span>职业成长、公开企业信息和服务规则</span></Link></div><button className="text-button logout" onClick={() => void onLogout()}>退出登录</button></section></Shell>; }
