import { Link, useNavigate } from '../router';
import type { User } from '../services/api';
import { Bookmark, UserRound } from 'lucide-react';

export function Shell({ user, children }: { user: User | null; children: React.ReactNode }) {
  const navigate = useNavigate();
  return <main className="app-shell"><header className="topbar"><Link className="logo" to="/">HHBA.</Link><nav><Link className="auth" to="/candidate/saved"><Bookmark size={15}/> 我的收藏</Link><Link className="auth" to="/candidate/account"><UserRound size={15}/> 个人中心</Link>{user ? <button className="text-button" onClick={() => navigate('/workspace')}>{user.display_name || '我的工作区'}</button> : <Link className="auth" to="/auth">登录 / 注册</Link>}</nav></header>{children}</main>;
}
