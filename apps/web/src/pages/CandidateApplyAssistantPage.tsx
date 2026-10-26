import {useEffect,useState,type ChangeEvent,type FormEvent} from 'react';
import {ArrowRight,CheckCircle2,Download,FileJson,FileUser,Info,LockKeyhole,ShieldCheck,Trash2} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/candidate-apply-assistant.css';

const KEY='hhba.apply.profile.v1';
const fields=[
 ['fullName','姓名','例如：李明'],['phone','手机号','例如：13800138000'],
 ['email','联系邮箱','例如：name@example.com'],['school','毕业院校','学校全称'],
 ['major','所学专业','与学历证明一致'],['education','最高学历','例如：本科、硕士'],
 ['degree','最高学位','例如：学士'],['enrollment','入学年月','例如：2021-09'],
 ['graduation','毕业年月','例如：2025-06'],['city','所在城市','例如：济南'],
 ['skills','专业技能','用真实技能描述'],['experience','工作或实习经历','仅填真实经历'],
 ['projects','项目经历','仅填真实项目'],['summary','个人简介','请按真实情况填写']
] as const;
type Key=typeof fields[number][0];
type Profile=Record<Key,string>;
const blank=():Profile=>Object.fromEntries(fields.map(([id])=>[id,''])) as Profile;
const clean=(value:unknown,limit:number)=>typeof value==='string'?value.trim().slice(0,limit):'';
function normalize(raw:unknown):Profile{
 const p=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const data=p.schema==='hhba-apply-profile-v1'&&p.profile&&typeof p.profile==='object'?
  p.profile as Record<string,unknown>:p;
 const result=blank();
 for(const [key] of fields)result[key]=clean(data[key],['experience','projects'].includes(key)?12000:4000);
 return result;
}
const nonempty=(p:Profile)=>fields.filter(([key])=>p[key].trim().length>0).length;
function downloadProfile(p:Profile){
 if(nonempty(p)===0)throw Error('请先填写至少一项真实求职资料，再导出。');
 if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw Error('邮箱格式有误，请先核对。');
 const payload={schema:'hhba-apply-profile-v1',exportedAt:new Date().toISOString(),profile:p};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='HHBA-求职档案.json';document.body.append(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function CandidateApplyAssistantPage({user}:{user:User|null}){
 const [profile,setProfile]=useState<Profile>(blank);
 const [loaded,setLoaded]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 useEffect(()=>{
  try{const raw=localStorage.getItem(KEY);if(raw)setProfile(normalize(JSON.parse(raw)));}
  catch{setError('本机档案无法读取。你可以重新填写或清除浏览器数据。');}
  setLoaded(true);
 },[]);
 const count=nonempty(profile);
 const update=(key:Key,value:string)=>{setProfile(old=>({...old,[key]:value}));setSaved(false);setNotice('');setError('');};
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setNotice('');
  if(count===0){setError('请填写至少一项真实资料。');return;}
  if(profile.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)){setError('请检查邮箱格式。');return;}
  try{localStorage.setItem(KEY,JSON.stringify(profile));setSaved(true);setNotice('档案已保存在当前浏览器。还需下载 JSON 文件并导入扩展，数据不会自动同步。');}
  catch{setError('保存失败：浏览器可能禁用了本地存储。');}
 }
 async function readImport(event:ChangeEvent<HTMLInputElement>){
  const input=event.currentTarget;const file=input.files?.[0];input.value='';
  if(!file)return;
  try{
   if(file.size>200000)throw Error('文件过大，请选择小于 200KB 的 HHBA 档案 JSON。');
   const data=JSON.parse(await file.text());
   const next=normalize(data);
   if(!nonempty(next))throw Error('没有可识别的求职资料。');
   setProfile(next);setSaved(false);setError('');
   setNotice('档案已读取，请检查所有内容后点击「保存到本机」。');
  }catch(e){setError(e instanceof Error?e.message:'读取文件失败');}
 }
 function clear(){
  if(!window.confirm('确定删除此网页在当前浏览器保存的求职档案吗？请确保你已安全备份。'))return;
  try{localStorage.removeItem(KEY);setProfile(blank());setSaved(false);setNotice('此网页的本机档案已清除。扩展中独立保存的资料不受影响。');setError('');}
  catch{setError('浏览器拒绝删除本地数据。');}
 }
 return <Shell user={user}>
  <main className="hhba-apply-page">
   <nav className="hhba-apply-breadcrumb"><Link to="/">首页</Link><span>/</span><Link to="/candidate">求职中心</Link><span>/</span><strong>智能网申助手</strong></nav>
   <div className="hhba-apply-head">
    <span className="hhba-apply-kicker">HHBA · 求职工具</span>
    <h1>认真准备一次，轻松申请更多机会。</h1>
    <p>建立一份自己的求职档案，在 Chrome / Edge 中辅助填写国内企业招聘表单。你决定填写哪些内容，并亲自提交申请。</p>
    <span className="hhba-apply-label">浏览器扩展内测版 · 国内优先 · 本机资料</span>
    <div className="hhba-apply-price"><strong>¥0.30 <small>/ 次完整网申任务</small></strong><p>正式版拟定价格。目前仍是内测，不收取费用，未接通支付或 DeepSeek 智能服务；请勿向任何人支付所谓内测开通费。</p></div>
   </div>
   <div className="hhba-apply-steps">
    <article><span>01</span><div><strong>整理一份资料</strong><p>准确填写常用信息，或导入已经整理好的 JSON 档案。</p></div></article>
    <article><span>02</span><div><strong>安装浏览器助手</strong><p>在 GitHub 下载当前内测版，通过浏览器开发者模式安装。</p></div></article>
    <article><span>03</span><div><strong>打开企业网申页面</strong><p>识别表单 → 预览建议 → 确认填写 → 手动提交。</p></div></article>
   </div>
   <div className="hhba-apply-layout">
    <section className="hhba-apply-panel">
     <div className="hhba-apply-panel-head"><div><h2><FileUser size={21}/> 我的求职档案</h2>
      <p>只收集填写常见网申字段所需的信息。空白项目不会被编造。</p></div>
      <span>{loaded?count+' / '+fields.length+' 项已填写':'正在读取…'}</span></div>
     <div className="hhba-apply-privacy"><LockKeyhole size={18}/><div><strong>本地保存，非账号云同步</strong><p>此页面使用浏览器本地存储，不上传简历至 HHBA 服务器。扩展与网页存储相互独立，需下载并导入 JSON 文件；请避免在公共电脑中填写个人资料。{user?'当前已登录 HHBA，浏览器档案仍不会自动同步。':''}</p></div></div>
     <form onSubmit={save}>
      <div className="hhba-apply-form">
       {fields.map(([key,label,hint])=><label key={key} className={'hhba-apply-field '+(['skills','experience','projects','summary'].includes(key)?'wide':'')}>
        <span>{label}</span>
        {['skills','experience','projects','summary'].includes(key)?
         <textarea maxLength={['experience','projects'].includes(key)?12000:4000} rows={3} value={profile[key]} onChange={e=>update(key,e.target.value)} placeholder={hint}/>:
         <input maxLength={4000} type={key==='email'?'email':'text'} value={profile[key]} onChange={e=>update(key,e.target.value)} placeholder={hint}/>}
       </label>)}
      </div>
      {error&&<p className="hhba-apply-error" role="alert">{error}</p>}
      {notice&&<p className="hhba-apply-notice" role="status">{notice}</p>}
      <div className="hhba-apply-buttons">
       <button className="hhba-apply-primary" type="submit"><CheckCircle2 size={16}/>保存到本机{saved?' · 已保存':''}</button>
       <button type="button" onClick={()=>{try{downloadProfile(profile);setError('');setNotice('已导出 HHBA 档案，请将 JSON 文件导入浏览器扩展。');}catch(e){setError(e instanceof Error?e.message:'无法导出');}}}><Download size={16}/>下载扩展用档案</button>
       <label className="hhba-apply-import"><FileJson size={16}/>导入已有 JSON<input type="file" accept=".json,application/json" onChange={readImport}/></label>
       <button type="button" className="hhba-apply-danger" onClick={clear}><Trash2 size={15}/>清除本机资料</button>
      </div>
     </form>
    </section>
    <aside className="hhba-apply-aside">
     <section className="hhba-apply-panel">
      <h2><Download size={20}/> 安装浏览器助手</h2>
      <p>支持在 Chrome / Edge 开发者模式中加载扩展文件。当前尚未上架浏览器扩展商店。</p>
      <a className="hhba-apply-primary hhba-apply-link" href="https://github.com/yanm-jun/hhba-talent/tree/feat/hhba-domestic-apply-assistant-20261027/apps/browser-extension" target="_blank" rel="noopener noreferrer">查看扩展源码与安装说明 <ArrowRight size={17}/></a>
      <ol><li>打开仓库并下载扩展文件。</li><li>进入浏览器扩展管理页，开启开发者模式。</li><li>加载 <code>apps/browser-extension</code> 目录。</li><li>打开扩展，导入从本页下载的 JSON 档案。</li><li>访问企业官网，扫描并核对填写建议。</li></ol>
     </section>
     <section className="hhba-apply-panel">
      <h2><ShieldCheck size={20}/> 对求职者的承诺</h2>
      <p>不会自动海投，不伪造经历，不绕过验证码，不自动上传附件，不擅自提交申请。</p>
      <p>遇到北森、Moka 或央国企的复杂动态表单，当前版本可能需要人工处理。只有通过真实网站验证的兼容性才会标记为已支持。</p>
     </section>
     <section className="hhba-apply-panel">
      <h2><Info size={20}/> 当前交付范围</h2>
      <p>内测版已具备标准网页控件的识别、建议预览、回填、核验与撤销。正式版由 HHBA 统一提供智能服务，不需要用户配置 API Key。支付和真实 AI 服务目前尚未开放，PDF/DOCX 解析、账号同步及复杂 ATS 仍待开发验证。</p>
     </section>
    </aside>
   </div>
  </main>
 </Shell>;
}
