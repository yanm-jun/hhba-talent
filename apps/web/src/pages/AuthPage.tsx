import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, Info, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { BrandMark } from '../components/BrandMark';
import { Link, navigate } from '../router';
import { api, ApiError, accountAuthReady, type AccountType, type User } from '../services/api';
import '../styles/role-auth.css';

type Mode = 'login' | 'register';
type Props = {
  user: User | null;
  onUser: (user: User) => void;
  accountType?: AccountType;
  initialMode?: Mode;
};

/**
 * Screenshot-matched HHBA auth card: the same identity, logo, proportions,
 * green primary button and role switch as the original phone page.
 *
 * Email/password is the initial auth method in the isolated D1 preview.
 * The phone UI remains in PhoneAuthPage for a future verified SMS provider.
 */
export function AuthPage({ user, onUser, accountType = 'candidate', initialMode = 'login' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<'form'|'verify'|'reset-request'|'reset-confirm'>('form');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [mailStatus, setMailStatus] = useState<{email_delivery_configured:boolean;preview_test_email_enabled:boolean;password_recovery_available:boolean}|null>(null);
  const isCandidate = accountType === 'candidate';
  const stem = isCandidate ? '/candidate' : '/recruiter';
  const accountLabel = isCandidate ? '求职者' : '招聘方';
  const defaultNext = isCandidate ? '/candidate' : '/employer/hub';
  const requested = new URLSearchParams(location.search).get('next');
  // Do not navigate from candidate to employer or to arbitrary user-provided routes.
  const safeNext = isCandidate && requested === '/candidate/official-outbound'
    ? requested
    : !isCandidate && requested === '/recruiter/onboarding'
      ? requested
      : defaultNext;
  const nextSuffix = safeNext === '/candidate/official-outbound'
    ? '?next=%2Fcandidate%2Fofficial-outbound'
    : safeNext === '/recruiter/onboarding'
      ? '?next=%2Frecruiter%2Fonboarding'
      : '';
  const accountHasRole = Boolean(user?.account_types?.includes(accountType));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isSyntheticTestAddress = /@example\\.(test|invalid)$/i.test(email.trim());
  const emailRegistrationAvailable = Boolean(mailStatus?.email_delivery_configured ||
    (mailStatus?.preview_test_email_enabled && isSyntheticTestAddress));
  const formReady = accountAuthReady && emailValid && password.length >= 12
    && (mode === 'login' || (emailRegistrationAvailable && displayName.trim().length >= 2 && passwordConfirm === password));

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setPassword('');
    setPasswordConfirm('');
    setFlow('form');
    setNotice('');
    setCode('');
  }, [accountType, initialMode]);

  useEffect(() => {
    if (!accountAuthReady) return;
    let active=true;
    api.authStatus().then(status => {if(active)setMailStatus(status)})
      .catch(() => {if(active)setMailStatus(null)});
    return () => {active=false};
  }, [accountType]);

  useEffect(() => {
    if (accountHasRole) navigate(safeNext);
  }, [accountHasRole, safeNext]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!accountAuthReady) return setError('账户服务尚未开放。');
    if (!emailValid) return setError('请填写有效邮箱地址。');
    if (password.length < 12) return setError('密码至少需要 12 位。');
    if (mode === 'register') {
      if (!emailRegistrationAvailable) return setError('真实邮箱验证码服务尚未开通，本阶段暂不接收真实邮箱注册资料。');
      if (displayName.trim().length < 2 || displayName.trim().length > 60) return setError('称呼请填写 2—60 个字符。');
      if (password !== passwordConfirm) return setError('两次输入的密码不一致。');
    }
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'register') {
        const result = await api.register(normalizedEmail, password, displayName.trim(), accountType);
        if (result.verification_required) {
          setFlow('verify'); setCode('');
          setNotice('验证码已交给邮件服务发送，请检查收件箱及垃圾邮件。');
          return;
        }
      }
      await api.login(normalizedEmail, password, accountType);
      const current = await api.me();
      if (!current.account_types?.includes(accountType)) {
        await api.logout();
        throw new ApiError(403, '当前账号没有该身份权限，请切换身份后登录。');
      }
      onUser(current);
      navigate(safeNext);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录请求未能完成。');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (flow==='verify') {
        await api.verifyEmail(email.trim().toLowerCase(),code);
        await api.login(email.trim().toLowerCase(),password,accountType);
        const current=await api.me();
        if(!current.account_types?.includes(accountType))throw new ApiError(403,'当前账户没有该身份权限。');
        onUser(current); navigate(safeNext);
      } else if (flow==='reset-request') {
        await api.requestPasswordReset(email.trim().toLowerCase());
        setFlow('reset-confirm');setNotice('如该邮箱已经注册并验证，密码重置验证码将发送到该邮箱。');
      } else if (flow==='reset-confirm') {
        await api.resetPassword(email.trim().toLowerCase(),code,password);
        setFlow('form');setMode('login');setCode('');setPassword('');
        setNotice('密码已重置，请使用新密码登录。');
      }
    } catch(e) {setError(e instanceof ApiError ? e.message : '请求失败，请稍后再试。');}
    finally {setBusy(false);}
  }

  if (accountHasRole) return null;

  return <Shell user={user}>
    <section className="hhba-phone-auth" aria-labelledby="hhba-email-auth-title">
      <div className="hhba-phone-card">
        <div className="hhba-auth-page-logo"><BrandMark variant="icon" size="hero"/></div>
        <div className="hhba-phone-heading">
          <span className="hhba-phone-kicker">{accountLabel}账户</span>
          <h1 id="hhba-email-auth-title">{flow==='verify'?'验证邮箱':flow.startsWith('reset')?'找回密码':mode === 'login' ? '欢迎回来' : '创建你的账户'}</h1>
          <p>{mode === 'login' ? '使用邮箱登录，继续你在 HHBA 的旅程。' : '使用邮箱创建账户，开启你在 HHBA 的旅程。'}</p>
        </div>
        <div className="hhba-phone-identity">
          <span className="hhba-phone-identity-icon" aria-hidden="true">
            {isCandidate ? <UserRound size={17}/> : <Building2 size={17}/>}
          </span>
          <span>以{accountLabel}身份继续</span>
          <Link className="hhba-phone-switch-identity" to="/auth">切换身份 <ArrowRight size={13}/></Link>
        </div>
        {notice && <p className="hhba-phone-notice" role="status">{notice}</p>}
        {mode === 'register' && flow === 'form' && mailStatus && !mailStatus.email_delivery_configured &&
          <p className="hhba-phone-warning" role="status">真实邮箱发信服务尚未配置：QQ、163、Gmail 等注册暂不能提交。{mailStatus.preview_test_email_enabled ? '当前仅可使用 @example.test 测试账户。' : ''}</p>}
        {mode === 'register' && flow === 'form' && !mailStatus &&
          <p className="hhba-phone-warning" role="status">正在检查邮箱验证服务，暂不开放真实邮箱注册。</p>}
        {flow==='form' ? <form className="hhba-phone-form" onSubmit={submit}>
          {mode === 'register' && <label htmlFor="hhba-email-auth-name">
            称呼
            <input id="hhba-email-auth-name" required minLength={2} maxLength={60}
              autoComplete="name" placeholder={isCandidate ? '你的姓名或昵称' : '招聘联系人姓名'}
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </label>}
          <label htmlFor="hhba-email-auth-email">
            邮箱
            <div className="hhba-email-input">
              <Mail size={17} aria-hidden="true"/>
              <input id="hhba-email-auth-email" required type="email" autoComplete="email"
                inputMode="email" maxLength={254} placeholder="请输入邮箱地址"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </label>
          <label htmlFor="hhba-email-auth-password">
            密码
            <input id="hhba-email-auth-password" required type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={12} maxLength={128}
              placeholder={mode === 'login' ? '请输入密码' : '至少 12 位密码'}
              value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {mode === 'register' && <label htmlFor="hhba-email-auth-confirm">
            确认密码
            <input id="hhba-email-auth-confirm" required type="password"
              autoComplete="new-password" minLength={12} maxLength={128}
              placeholder="请再次输入密码"
              value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
          </label>}
          {user && !accountHasRole && <p className="hhba-phone-warning" role="status">当前登录账号尚无{accountLabel}权限，请先退出或切换账号。</p>}
          {error && <p className="hhba-phone-error" role="alert">{error}</p>}
          <button className="hhba-phone-submit" type="submit" disabled={!formReady || busy}>
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并继续'}
            <ArrowRight size={17} aria-hidden="true"/>
          </button>
        </form> : <form className="hhba-phone-form" onSubmit={submitCode}>
          <label htmlFor="hhba-email-account">邮箱
            <input id="hhba-email-account" type="email" required maxLength={254} autoComplete="email"
              value={email} onChange={e=>setEmail(e.target.value)} placeholder="QQ、163、Gmail 等常用邮箱"/>
          </label>
          {flow!=='reset-request' && <label htmlFor="hhba-email-code">邮箱验证码
            <input id="hhba-email-code" required inputMode="numeric" maxLength={6} pattern="[0-9]{6}"
              value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}
              placeholder="请输入 6 位邮件验证码"/>
          </label>}
          {flow==='reset-confirm' && <label htmlFor="hhba-new-password">新密码
            <input id="hhba-new-password" required type="password" minLength={12} maxLength={128}
              value={password} onChange={e=>setPassword(e.target.value)}
              autoComplete="new-password" placeholder="至少 12 位新密码"/>
          </label>}
          {error && <p className="hhba-phone-error" role="alert">{error}</p>}
          <button className="hhba-phone-submit" type="submit" disabled={busy || !emailValid || (flow!=='reset-request' && code.length!==6) || (flow==='reset-confirm' && password.length<12)}>
            {busy?'处理中…':flow==='verify'?'验证并登录':flow==='reset-request'?'发送找回邮件':'设置新密码'} <ArrowRight size={17}/>
          </button>
          {flow==='verify' && <button className="text-button" type="button" onClick={async()=>{setError('');try{await api.resendVerification(email.trim().toLowerCase());setNotice('验证码发送请求已被接受。');}catch(e){setError(e instanceof ApiError?e.message:'暂时无法重新发送。')}}}>重新发送验证码</button>}
          <button className="text-button" type="button" onClick={()=>{setFlow('form');setError('');setNotice('');setCode('');}}>返回邮箱登录</button>
        </form>}
        {flow==='form' && <div className="hhba-phone-account-change">
          {mode === 'login' ? '还没有账户？' : '已经有账户？'}{' '}
          <Link to={stem + (mode === 'login' ? '/register' : '/login') + nextSuffix}>
            {mode === 'login' ? '立即注册' : '返回登录'}
          </Link>
        </div>}
        {flow==='form' && mode==='login' && <button type="button" className="hhba-phone-legacy" onClick={()=>{setFlow('reset-request');setError('');setNotice('');setCode('');setPassword('');}}>忘记密码？通过邮箱找回</button>}
        <div className="hhba-phone-preview-note" role="note">
          <Info size={15} aria-hidden="true"/>
          <span>支持 QQ、163、126、Gmail、Outlook 等常用邮箱。邮箱所有权验证后方可登录。当前预览仅供验收，请勿输入真实个人资料或常用密码。</span>
        </div>
      </div>
      <div className="hhba-phone-below">
        <Link to="/auth"><ArrowLeft size={14}/> 返回身份选择</Link>
        <span aria-hidden="true">·</span>
        <Link to={isCandidate ? '/candidate/jobs' : '/employer/start'}>
          {isCandidate ? '先看看招聘市场' : '了解企业服务'} <ArrowRight size={14}/>
        </Link>
      </div>
      <div className="hhba-phone-footer"><LockKeyhole size={13}/> HHBA · 让劳动更有尊严，让商业更有温度</div>
    </section>
  </Shell>;
}
