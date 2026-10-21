/**
 * 注册/登录页（手机号 + 短信验证码，双入口严格分开）—— 合并补丁整文件
 * 落点: apps/web/src/pages/AuthPage.tsx（整文件替换旧邮箱+密码版）
 *
 * 与原文件的 diff 要点:
 *   1. 删除 email/password/name 三个字段与 api.register/api.login（旧邮箱账户 API）调用；
 *      改为手机号 + 6 位短信验证码，接口走新 services/smsAuth.ts。
 *   2. 注册与登录是两个明确页签（mode），且 mode 同时就是发码 purpose:
 *      注册页签 → sendSmsCode(phone,'register') + registerBySms；
 *      登录页签 → sendSmsCode(phone,'login') + loginBySms。切换页签会清空验证码并重置倒计时，
 *      已按旧用途发出的码不会被带到新页签提交（后端也会按用途拒绝，前端先自律）。
 *   3. 未注册手机号在登录页签提交发码时，后端回 PHONE_NOT_REGISTERED，
 *      文案「该手机号尚未注册，请先注册」由 SmsAuthError 直接给出，本页只负责展示与提供切换入口；
 *      已注册手机号在注册页签同理回 PHONE_ALREADY_REGISTERED。
 *   4. 注册只收手机号: 昵称等资料注册后在个人中心完善（user_profiles），不在注册表单里收，
 *      避免「先注册后登录」的主流程被资料表单拖长。accountType 保留: 招聘方注册成功后仍须
 *      单独走企业认证，手机注册不授予任何企业权限（与后端语义一致，文案已注明）。
 *   5. Props 变化: user/onUser 的类型由 api.ts 的 User 改为 smsAuth.ts 的 SmsUser；
 *      App.tsx 装配处需同步（登录态守卫改用 smsAuth.me()，DemoAuthPage 的演示态与之互斥，见 isolation 说明）。
 */
import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { smsAuth, SmsAuthError, type SmsUser } from '../services/smsAuth';
import { navigate } from '../router';

type AccountType = 'candidate' | 'recruiter';
type Mode = 'login' | 'register';
const CN_PHONE_RE = /^1[3-9]\d{9}$/;

export function AuthPage({ user, onUser, accountType = 'candidate', initialMode = 'login' }: {
  user: SmsUser | null;
  onUser: (user: SmsUser) => void;
  accountType?: AccountType;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => { setMode(initialMode); setError(''); setCode(''); setSecondsLeft(0); }, [accountType, initialMode]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft]);

  const next = new URLSearchParams(location.search).get('next');
  const defaultNext = accountType === 'recruiter' ? '/employer' : '/candidate/account';
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : defaultNext;
  const label = accountType === 'recruiter' ? '招聘方账户' : '求职者账户';
  const basePath = accountType === 'recruiter' ? 'recruiter' : 'candidate';

  useEffect(() => { if (user) navigate(safeNext); }, [safeNext, user]);
  if (user) return null;

  function switchMode(nextMode: Mode) {
    setMode(nextMode); setError(''); setCode(''); setSecondsLeft(0);
    navigate(`/${basePath}/${nextMode}`);
  }

  async function sendCode() {
    setError('');
    if (!CN_PHONE_RE.test(phone)) return setError('请输入正确的中国大陆手机号');
    setSending(true);
    try {
      await smsAuth.sendSmsCode(phone, mode); // purpose 与页签严格一致
      setSecondsLeft(60);
    } catch (e) {
      setError(e instanceof SmsAuthError ? e.message : '短信发送失败，请稍后再试。');
    } finally { setSending(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!CN_PHONE_RE.test(phone)) return setError('请输入正确的中国大陆手机号');
    if (!/^\d{6}$/.test(code)) return setError('请输入 6 位短信验证码。');
    setBusy(true);
    try {
      const current = mode === 'register'
        ? await smsAuth.registerBySms(phone, code)
        : await smsAuth.loginBySms(phone, code);
      onUser(current);
      navigate(safeNext);
    } catch (e) {
      setError(e instanceof SmsAuthError ? e.message : '请求失败。');
    } finally { setBusy(false); }
  }

  return (
    <Shell user={null}>
      <section className="auth-layout">
        <div className="eyebrow">HHBA · {label}</div>
        <h1>{mode === 'login' ? `登录${label}` : `注册${label}`}</h1>
        <p>{mode === 'register'
          ? '使用中国大陆手机号和短信验证码注册。注册成功后将直接进入个人中心，昵称等资料可随后完善。'
          : '使用注册时预留的手机号和短信验证码登录。尚未注册的手机号无法直接登录，请先注册。'}
          {accountType === 'recruiter' ? '招聘方注册后还需单独提交企业认证，认证通过前不能检索人才。' : ''}</p>
        <div className="auth-tabs" role="tablist" aria-label="注册或登录">
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')}>注册</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>登录</button>
        </div>
        <form className="form-card" onSubmit={submit}>
          <label>手机号<input required inputMode="numeric" autoComplete="tel" maxLength={11} placeholder="请输入 11 位手机号" value={phone} onChange={(e) => setPhone(e.target.value.trim())} /></label>
          <label>短信验证码
            <span className="code-row">
              <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 位验证码" value={code} onChange={(e) => setCode(e.target.value.trim())} />
              <button type="button" className="text-button" disabled={sending || secondsLeft > 0} onClick={() => void sendCode()}>
                {secondsLeft > 0 ? `${secondsLeft} 秒后重发` : sending ? '发送中…' : '获取验证码'}
              </button>
            </span>
            <small>验证码 5 分钟内有效；注册与登录的验证码不能混用。</small>
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册并进入'}</button>
        </form>
        <button className="text-button switch" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? '还没有账户？先注册' : '已有账户？直接登录'}
        </button>
      </section>
    </Shell>
  );
}
