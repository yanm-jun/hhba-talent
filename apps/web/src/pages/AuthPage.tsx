import { FormEvent, useState } from 'react';
import { Shell } from '../components/Shell';
import { api, ApiError, type User } from '../services/api';
import { navigate } from '../router';

export function AuthPage({ user, onUser }: { user: User | null; onUser: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const next = new URLSearchParams(location.search).get('next'); const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/workspace';
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); if (password.length < 12) return setError('密码至少需要 12 位。'); setBusy(true); try { if (mode === 'register') await api.register(email, password, name); await api.login(email, password); const current = await api.me(); onUser(current); navigate(safeNext); } catch (e) { setError(e instanceof ApiError ? e.message : '请求失败。'); } finally { setBusy(false); } }
  if (user) { navigate(safeNext); return null; }
  return <Shell user={null}><section className="auth-layout"><div className="eyebrow">HHBA 账户</div><h1>{mode === 'login' ? '欢迎回来。' : '创建你的 HHBA 账户。'}</h1><p>求职端与企业端使用同一个安全账户。</p><form className="form-card" onSubmit={submit}>{mode === 'register' && <label>展示名称<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}<label>邮箱<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>密码<input required type="password" minLength={12} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /><small>至少 12 位；不会在浏览器保存。</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册并继续'}</button></form><button className="text-button switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? '还没有账户？注册' : '已有账户？登录'}</button></section></Shell>;
}
