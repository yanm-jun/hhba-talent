import {type FormEvent,useState} from 'react';
import {ArrowRight,Bookmark,CheckCircle2,Compass,FileUser,LockKeyhole,ShieldCheck,UserRound} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {createDemoAccount,enterDemoAccount,readDemoProfile} from '../services/demoAccount';
import '../styles/demo-auth.css';
type Mode='login'|'register';
export function DemoAuthPage({initialMode='login'}:{initialMode?:Mode}){
 const [nickname,setNickname]=useState('');
 const [alias,setAlias]=useState('');
 const [role,setRole]=useState('');
 const [city,setCity]=useState('');
 const [error,setError]=useState('');
 const mode=initialMode;
 const existing=readDemoProfile();
 const returnPath=new URLSearchParams(location.search).get('next');
 const next=returnPath&&['/candidate/account','/candidate/saved','/candidate/account/preferences','/candidate/account/profile','/candidate/official-outbound'].includes(returnPath)?returnPath:'/candidate/account';
 const resumeQuery=returnPath==='/candidate/official-outbound'?'?next=%2Fcandidate%2Fofficial-outbound':'';
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');
  if(mode==='register'){
   if(nickname.trim().length<2)return setError('请填写至少 2 个字符的演示昵称。');
   createDemoAccount({nickname,alias,preferredRole:role,preferredCity:city});
  }else enterDemoAccount();
  navigate(next);
 }
 return <Shell user={null}>
  <section className="demo-auth-layout">
   <div className="demo-auth-main">
    <div className="demo-auth-eyebrow"><span className="demo-auth-light"/> HHBA · 个人账户体验版</div>
    <h1>{mode==='register'?'创建你的演示账户':'欢迎来到 HHBA'}</h1>
    <p className="demo-auth-lead">这里先体验完整的求职账户界面，收藏真实职位、管理模拟职业资料，为正式账户上线前确认交互体验。</p>
    <div className="demo-auth-notice"><ShieldCheck size={18}/><span><strong>这是公开前端演示，不是真正注册或登录。</strong> 不要填写真实密码或敏感信息；所有演示资料仅保存在当前浏览器，不会发送到服务器。</span></div>
    {returnPath==='/candidate/official-outbound'&&<div className="demo-auth-notice" role="status"><LockKeyhole size={18}/><span><strong>正式注册服务尚未开放。</strong> 演示注册无法解锁第三方招聘官网。正式账户系统启用后，需要完成真实注册或登录，再重新点击所需的招聘官网。</span></div>}
    <div className="demo-auth-tabs" role="group" aria-label="账户体验方式">
      <Link className={mode==='login'?'is-active':''} aria-current={mode==='login'?'page':undefined} to={'/candidate/login'+resumeQuery}>模拟登录</Link>
      <Link className={mode==='register'?'is-active':''} aria-current={mode==='register'?'page':undefined} to={'/candidate/register'+resumeQuery}>模拟注册</Link>
    </div>
    <form className="demo-auth-form" onSubmit={submit}>
     {mode==='register'?<>
      <label>演示昵称 <span>不必使用真实姓名</span>
       <input value={nickname} onChange={event=>setNickname(event.target.value)} maxLength={32} autoComplete="off" placeholder="例如：职场探索者" required/></label>
      <label>账户代号 <span>仅用于页面展示，非真实邮箱</span>
       <input value={alias} onChange={event=>setAlias(event.target.value)} maxLength={28} autoComplete="off" placeholder="例如：demo-001"/></label>
      <div className="demo-auth-form-two">
       <label>期望岗位 <span>选填</span><input value={role} onChange={e=>setRole(e.target.value)} maxLength={70} placeholder="如：市场运营"/></label>
       <label>期望城市 <span>选填</span><input value={city} onChange={e=>setCity(e.target.value)} maxLength={70} placeholder="如：上海 / 远程"/></label>
      </div>
     </>:<>
      <div className="demo-auth-account">
       <div className="demo-auth-round"><UserRound size={23}/></div>
       <div><strong>{existing?.nickname||'HHBA 体验用户'}</strong><span>本浏览器演示账户 · 不需要密码</span></div>
       <CheckCircle2 size={18} className="demo-auth-check"/>
      </div>
      <p className="demo-auth-explain">点击下方按钮会进入演示身份，不会执行真实身份验证，也不会产生注册用户统计。</p>
     </>}
     {error&&<p className="demo-auth-error" role="alert">{error}</p>}
     <button className="demo-auth-primary" type="submit">{mode==='register'?'创建演示账户并进入':'一键进入模拟账户'}<ArrowRight size={18}/></button>
    </form>
    <p className="demo-auth-legal"><LockKeyhole size={14}/> 演示账户不能用于简历上传、企业认证或真实求职申请。</p>
    <p className="demo-auth-bottom"><Link to="/candidate/jobs">先浏览真实招聘职位 →</Link></p>
   </div>
   <aside className="demo-auth-side" aria-label="个人中心能力预览">
    <span className="demo-auth-side-tag">YOUR CAREER WORKSPACE</span>
    <h2>一处管理你的<br/>职业探索旅程。</h2>
    <p>从发现岗位，到保存机会，再到规划下一步。</p>
    <div className="demo-auth-feature"><Bookmark size={21}/><span><strong>我的收藏</strong><small>已收藏职位汇总，随时查看</small></span></div>
    <div className="demo-auth-feature"><Compass size={21}/><span><strong>求职偏好</strong><small>按地点、工作方式和岗位方向管理</small></span></div>
    <div className="demo-auth-feature"><FileUser size={21}/><span><strong>简历与申请</strong><small>查看布局，等待正式账户接入</small></span></div>
    <div className="demo-auth-side-foot"><span>HHBA</span><small>Human Capability Network</small></div>
   </aside>
  </section>
 </Shell>;
}
