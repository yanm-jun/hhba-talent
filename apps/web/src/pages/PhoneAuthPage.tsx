import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Info, LockKeyhole, UserRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { Link, navigate } from '../router';
import { api, ApiError, employerApiReady, phoneAuthReady, type AccountType, type User } from '../services/api';
import {
  clearRealAuthToken,
  getRealAuthToken,
  realAuth,
  realAuthPasswordValid,
  realAuthReady,
  realAuthToUser,
  realAuthUsernameValid,
} from '../services/realAuth';
import '../styles/role-auth.css';
import { BrandMark } from '../components/BrandMark';

type Mode = 'login' | 'register';
type Props = { user: User | null; onUser: (value: User) => void; accountType: AccountType; initialMode: Mode };

/**
 * 手机号登录/注册页。正式流程仍走 /api/v1 正式网关并受 phoneAuthReady 门控。
 * 求职者在 VITE_HHBA_REAL_AUTH_ENABLED='1' 时走测试站真实认证分支（/api/real-auth/*），
 * 该分支不走 employerApiReady 门控；测试后端只签发 candidate 角色，因此招聘方仍走正式流程。
 */
export function PhoneAuthPage({ user, onUser, accountType, initialMode }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authMethod, setAuthMethod] = useState<'code' | 'password'>('code');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const candidate = accountType === 'candidate';
  const stem = candidate ? '/candidate' : '/recruiter';
  const requested = new URLSearchParams(location.search).get('next');
  const safeNext = candidate && requested === '/candidate/official-outbound'
    ? '/candidate/official-outbound'
    : !candidate && requested === '/recruiter/onboarding'
      ? '/recruiter/onboarding'
      : candidate ? '/candidate' : '/employer/hub';
  const suffix = safeNext === '/candidate/official-outbound' ? '?next=%2Fcandidate%2Fofficial-outbound'
    : safeNext === '/recruiter/onboarding' ? '?next=%2Frecruiter%2Fonboarding' : '';
  const title = candidate ? '求职者' : '招聘方';
  const mobileValid = /^1[3-9]\d{9}$/.test(phone);
  const codeValid = /^\d{6}$/.test(code);
  const accountHasRole = !!user?.account_types?.includes(accountType);
  // 真实认证分支只用于求职者：测试后端注册时角色固定为 candidate。
  const useRealAuth = realAuthReady && candidate;
  const realPasswordLogin = useRealAuth && mode === 'login' && authMethod === 'password';
  const canSubmit = useRealAuth
    ? mode === 'register'
      ? mobileValid && codeValid && realAuthUsernameValid(name) && realAuthPasswordValid(password) && password === passwordConfirm
      : realPasswordLogin
        ? realAuthUsernameValid(name) && password.length > 0
        : mobileValid && codeValid
    : phoneAuthReady && mobileValid && codeValid;
  const restoredRef = useRef(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setNotice('');
    setCode('');
    setPassword('');
    setPasswordConfirm('');
    setAuthMethod('code');
  }, [initialMode, accountType]);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  useEffect(() => { if (accountHasRole) navigate(safeNext); }, [accountHasRole, safeNext]);
  // 真实认证的会话恢复：页内已有令牌且当前无用户时，用 /me 恢复一次。
  // 401 时清除令牌，其他错误不清除令牌、不阻断页面；应用级 main.tsx 的正式会话恢复不动。
  useEffect(() => {
    if (restoredRef.current || !useRealAuth || user || !getRealAuthToken()) return;
    restoredRef.current = true;
    void realAuth.me()
      .then((me) => { onUser(realAuthToUser(me)); })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) clearRealAuthToken(); });
  }, [useRealAuth, user, onUser]);

  async function sendCode() {
    setError('');
    setNotice('');
    if (useRealAuth) {
      if (!mobileValid) return setError('请输入正确的中国大陆 11 位手机号。');
      if (sending || seconds > 0) return;
      setSending(true);
      try {
        await realAuth.sendCode(phone, mode);
        setSeconds(60);
        setNotice('验证码请求已提交，请查看手机短信。');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '验证码发送失败，请稍后再试。');
      } finally {
        setSending(false);
      }
      return;
    }
    if (!phoneAuthReady) return setError('真实短信服务尚未接通，暂时不能发送验证码。');
    if (!mobileValid) return setError('请输入正确的中国大陆 11 位手机号。');
    if (sending || seconds > 0) return;
    setSending(true);
    try {
      const result = await api.sendPhoneCode(phone, accountType, mode);
      const cooldown = Math.min(120, Math.max(30, Number(result.retry_after_seconds) || 60));
      setSeconds(cooldown);
      setNotice('验证码请求已提交，请查看手机短信。');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '验证码发送失败，请稍后再试。');
    } finally {
      setSending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (useRealAuth) {
      const username = name.trim();
      if (mode === 'register') {
        if (!mobileValid || !codeValid) return setError('请核对手机号，并输入 6 位短信验证码。');
        if (!realAuthUsernameValid(username)) return setError('称呼需为 2-20 位，首字符为字母或中文，其余为字母、数字、下划线或中文。');
        if (!realAuthPasswordValid(password)) return setError('密码需为 8-64 位，且同时包含字母和数字。');
        if (password !== passwordConfirm) return setError('两次输入的密码不一致。');
      } else if (realPasswordLogin) {
        if (!realAuthUsernameValid(username)) return setError('称呼需为 2-20 位，首字符为字母或中文，其余为字母、数字、下划线或中文。');
        if (!password) return setError('请输入密码。');
      } else if (!mobileValid || !codeValid) {
        return setError('请核对手机号，并输入 6 位短信验证码。');
      }
      setBusy(true);
      try {
        if (mode === 'register') {
          await realAuth.register({ phone, code, username, password, password_confirm: passwordConfirm });
        } else if (realPasswordLogin) {
          await realAuth.loginPassword(username, password);
        } else {
          await realAuth.loginSms(phone, code);
        }
        const me = await realAuth.me();
        onUser(realAuthToUser(me));
        navigate(safeNext);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '账户验证失败，请稍后重试。');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!phoneAuthReady) return setError('真实账户服务尚未接入，不能进行注册或登录。');
    if (!mobileValid || !codeValid) return setError('请核对手机号，并输入 6 位短信验证码。');
    if (mode === 'register' && name.trim().length < 2) return setError('请填写至少两个字符的展示名称。');
    setBusy(true);
    try {
      await api.phoneSession({ phone, code, mode, account_type: accountType, display_name: mode === 'register' ? name.trim() : undefined });
      const current = await api.me();
      if (!current.account_types?.includes(accountType)) throw new ApiError(403, '当前账号尚未开通该身份，请联系管理员核对权限。');
      onUser(current);
      navigate(safeNext);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '账户验证失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }
  if (accountHasRole) return null;
  const modeRoute = stem + (mode === 'login' ? '/register' : '/login') + suffix;
  return (
    <Shell user={user}>
      <section className="hhba-phone-auth" aria-labelledby="hhba-phone-title">
        <div className="hhba-phone-card">
          <div className="hhba-auth-page-logo"><BrandMark variant="icon" size="hero" /></div>
          <div className="hhba-phone-heading">
            <span className="hhba-phone-kicker">{candidate ? '求职者账户' : '招聘方账户'}</span>
            <h1 id="hhba-phone-title">{mode === 'login' ? '欢迎回来' : '创建你的账户'}</h1>
            <p>{mode === 'login' ? '使用手机号登录，继续你在 HHBA 的旅程。' : '只需几步，即可开启你的 HHBA 账户。'}</p>
          </div>
          <div className="hhba-phone-identity">
            <span className="hhba-phone-identity-icon" aria-hidden="true">{candidate ? <UserRound size={17} /> : <Building2 size={17} />}</span>
            <span>{candidate ? '以求职者身份继续' : '以招聘方身份继续'}</span>
            <Link to="/auth" className="hhba-phone-switch-identity">切换身份 <ArrowRight size={13} /></Link>
          </div>
          <form className="hhba-phone-form" onSubmit={submit}>
            {mode === 'register' && (
              <label htmlFor="hhba-auth-name">称呼
                <input id="hhba-auth-name" maxLength={useRealAuth ? 20 : 60} required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={candidate ? '你的姓名或昵称' : '招聘联系人姓名'} />
              </label>
            )}
            {realPasswordLogin && (
              <>
                <label htmlFor="hhba-auth-name">称呼
                  <input id="hhba-auth-name" maxLength={20} required minLength={2} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} placeholder="注册时填写的称呼" />
                </label>
                <label htmlFor="hhba-auth-password">密码
                  <input id="hhba-auth-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" />
                </label>
              </>
            )}
            {!realPasswordLogin && (
              <label htmlFor="hhba-auth-phone">手机号
                <div className="hhba-phone-number"><span>+86</span><input id="hhba-auth-phone" type="tel" inputMode="numeric" maxLength={11} required autoComplete="tel-national" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }} placeholder="请输入手机号码" /></div>
              </label>
            )}
            {!realPasswordLogin && (
              <label htmlFor="hhba-auth-code">验证码
                <div className="hhba-phone-code"><input id="hhba-auth-code" type="text" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 位短信验证码" /><button type="button" disabled={useRealAuth ? !mobileValid || sending || seconds > 0 : !phoneAuthReady || !mobileValid || sending || seconds > 0} onClick={() => void sendCode()}>{sending ? '发送中…' : seconds > 0 ? seconds + ' 秒后重试' : '获取验证码'}</button></div>
              </label>
            )}
            {useRealAuth && mode === 'register' && (
              <>
                <label htmlFor="hhba-auth-password">密码
                  <input id="hhba-auth-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8-64 位，含字母和数字" />
                </label>
                <label htmlFor="hhba-auth-password-confirm">确认密码
                  <input id="hhba-auth-password-confirm" type="password" required autoComplete="new-password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="请再次输入密码" />
                </label>
              </>
            )}
            {useRealAuth && mode === 'login' && (
              <div className="hhba-phone-account-change">
                <button type="button" id="hhba-phone-switch-identity" onClick={() => { setAuthMethod(authMethod === 'password' ? 'code' : 'password'); setError(''); setNotice(''); }}>{authMethod === 'password' ? '用验证码登录' : '用密码登录'}</button>
              </div>
            )}
            {user && !accountHasRole && <p className="hhba-phone-warning" role="status">当前账户尚未开通{title}身份，请先完成对应身份认证。</p>}
            {error && <p className="hhba-phone-error" role="alert">{error}</p>}
            {notice && <p className="hhba-phone-notice" role="status">{notice}</p>}
            <button className="hhba-phone-submit" type="submit" disabled={!canSubmit || busy}>{busy ? '验证中…' : mode === 'login' ? '登录' : '注册并继续'}<ArrowRight size={17} /></button>
          </form>
          <div className="hhba-phone-account-change">{mode === 'login' ? '还没有账户？' : '已经有账户？'} <Link to={modeRoute}>{mode === 'login' ? '立即注册' : '返回登录'}</Link></div>
          {employerApiReady && <Link className="hhba-phone-legacy" to={stem + '/email-' + mode + suffix}>已有邮箱密码账户？使用原登录方式</Link>}
          {!phoneAuthReady && !useRealAuth && <div className="hhba-phone-preview-note" role="status"><Info size={15} /><span>当前为页面预览，短信服务暂未接入，无法真实注册或登录。</span></div>}
        </div>
        <div className="hhba-phone-below">
          <Link to="/auth"><ArrowLeft size={14} /> 返回身份选择</Link>
          <span aria-hidden="true">·</span>
          <Link to={candidate ? '/candidate/jobs' : '/employer/start'}>{candidate ? '先看看招聘市场' : '了解企业服务'} <ArrowRight size={14} /></Link>
        </div>
        <div className="hhba-phone-footer"><LockKeyhole size={13} /> HHBA · 让劳动更有尊严，让商业更有温度</div>
      </section>
    </Shell>
  );
}
