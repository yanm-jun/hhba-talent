import { Link, useNavigate } from '../router';
import type { User } from '../services/api';

export function Shell({ user, children }: { user: User | null; children: React.ReactNode }) {
  const navigate = useNavigate();
  return <main className="app-shell"><header className="topbar"><Link className="logo" to="/">HHBA.</Link><nav><Link className="join-nav-link" to="/join">加入我们</Link>{user ? <button className="text-button" onClick={() => navigate('/workspace')}>{user.display_name || '我的工作区'}</button> : <Link className="auth" to="/auth">登录 / 注册</Link>}</nav></header>{children}</main>;
}
