import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { api, ApiError, type AccountType, type User } from '../services/api';
import { navigate } from '../router';

export function AuthPage({ user, onUser, accountType = 'candidate', initialMode = 'login' }: { user: User | null; onUser: (user: User) => void; accountType?: AccountType; initialMode?: 'login'|'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setMode(initialMode); setError(''); }, [accountType, initialMode]);
  const next = new URLSearchParams(location.search).get('next'); const defaultNext=accountType==='recruiter'?'/employer':'/candidate'; const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : defaultNext;
  const label=accountType==='recruiter'?'招聘方账户':'求职者账户';
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); if (password.length < 12) return setError('密码至少需要 12 位。'); setBusy(true); try { if (mode === 'register') await api.register(email, password, name, accountType); await api.login(email, password, accountType); const current = await api.me(); onUser(current); navigate(safeNext); } catch (e) { setError(e instanceof ApiError ? e.message : '请求失败。'); } finally { setBusy(false); } }
  useEffect(() => {
    if (user) navigate((user.account_types || []).includes(accountType) ? safeNext : '/');
  }, [accountType, safeNext, user]);
  if (user) return null;
  return <Shell user={null}><section className="auth-layout"><div className="eyebrow">HHBA · {label}</div><h1>{mode === 'login' ? `登录${label}` : `创建${label}`}</h1><p>{accountType==='recruiter'?'招聘方注册后可创建组织并提交企业与经办人认证；认证通过前不能检索人才。':'上传并核对简历后，由你决定是否授权企业检索或公开分享。'}</p><form className="form-card" onSubmit={submit}>{mode === 'register' && <label>展示名称<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}<label>邮箱<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>密码<input required type="password" minLength={12} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /><small>至少 12 位；不会在浏览器保存。</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册并继续'}</button></form><button className="text-button switch" onClick={() => { const nextMode=mode === 'login' ? 'register' : 'login'; setMode(nextMode); setError(''); navigate(`/${accountType === 'recruiter' ? 'recruiter' : 'candidate'}/${nextMode}${safeNext==='/candidate/official-outbound'?'?next=%2Fcandidate%2Fofficial-outbound':''}`); }}>{mode === 'login' ? '还没有账户？注册' : '已有账户？登录'}</button></section></Shell>;
}
