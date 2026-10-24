import { Link, useNavigate } from '../router';
import type { User } from '../services/api';
import { Bookmark, UserRound } from 'lucide-react';
import {demoModeEnabled,useDemoAccount,exitDemoAccount} from '../services/demoAccount';
import '../styles/demo-nav.css';

export function Shell({ user, children }: { user: User | null; children: React.ReactNode }) {
  const navigate = useNavigate();
  const demo = useDemoAccount();
  return <main className="app-shell"><header className="topbar"><Link className="logo" to="/">HHBA.</Link><nav><Link className="auth" to="/candidate/jobs">招聘市场</Link><Link className="auth" to="/companies/discover">企业发现 · 200家</Link><Link className="auth" to="/candidate/saved"><Bookmark size={15}/> 我的收藏</Link><Link className="auth" to="/candidate/account"><UserRound size={15}/> 个人中心</Link>{user ? <button className="text-button" onClick={() => navigate('/workspace')}>{user.display_name || '我的工作区'}</button> : demoModeEnabled&&demo ? <><Link className="auth" to="/candidate/account" title="演示账户">{demo.nickname} · 演示</Link><button className="text-button" onClick={()=>{exitDemoAccount();navigate('/candidate/login')}}>退出演示</button></> : <Link className="auth" to="/candidate/login">模拟登录 / 注册</Link>}</nav></header>{children}</main>;
}
