import { Shell } from '../components/Shell';
import { Link } from '../router';
import type { User } from '../services/api';
export function WorkspacePage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) { return <Shell user={user}><section className="content-page"><div className="eyebrow">我的工作区</div><h1>你好，{user.display_name}。</h1><p>从个人能力档案或企业需求开始，所有核心数据均保存于本地 API 与数据库。</p><div className="workspace-grid"><Link to="/candidate" className="workspace-card"><b>个人能力档案</b><span>上传、解析、核对与发布可撤回名片</span></Link><Link to="/employer" className="workspace-card"><b>企业需求草稿</b><span>创建组织并私密保存用人需求</span></Link></div><button className="text-button logout" onClick={() => void onLogout()}>退出登录</button></section></Shell>; }
