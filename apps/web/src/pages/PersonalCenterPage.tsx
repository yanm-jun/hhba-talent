import {type FormEvent,useEffect,useState} from 'react';
import {ArrowRight,Bookmark,BriefcaseBusiness,CheckCircle2,Compass,FileUser,LockKeyhole,LogOut,Scale,ShieldCheck,SlidersHorizontal,Trash2,UserRound,ChartNoAxesCombined} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {getJob,localizedCompany,localizedLocation,localizedTitle,type LiveJob} from '../services/liveRecruitment';
import {listSavedJobs,setSavedJob,savedAvailable,type SavedJob} from '../services/savedJobs';
import {analyticsChoice,chooseAnalytics} from '../services/engagement';
import {demoModeEnabled,useDemoAccount,exitDemoAccount,deleteDemoAccount,updateDemoAccount} from '../services/demoAccount';
import {employerApiReady,type User} from '../services/api';
import '../styles/personal-center.css';
import '../styles/demo-account.css';

type Section='overview'|'profile'|'preferences'|'resume'|'applications'|'privacy'|'saved';
type RecordRow={record:SavedJob;job:LiveJob|null};
const pages:{id:Section;label:string;icon:typeof UserRound;description:string}[]=[
 {id:'overview',label:'工作台',icon:Compass,description:'了解你的职业探索进度'},
 {id:'saved',label:'我的收藏',icon:Bookmark,description:'查看保存的真实岗位'},
 {id:'profile',label:'个人资料',icon:UserRound,description:'自定义演示头像和个人介绍'},
 {id:'preferences',label:'求职偏好',icon:SlidersHorizontal,description:'地点、职位和工作方式'},
 {id:'resume',label:'我的简历',icon:FileUser,description:'体验简历管理界面'},
 {id:'applications',label:'求职记录',icon:BriefcaseBusiness,description:'查看申请流程占位'},
 {id:'privacy',label:'账户与隐私',icon:ShieldCheck,description:'管理匿名统计和演示数据'},
];
function routeFor(id:Section){return id==='overview'?'/candidate/account':id==='saved'?'/candidate/saved':'/candidate/account/'+id;}
export function PersonalCenterPage({user,onlySaved=false,section='overview'}:{user:User|null;onlySaved?:boolean;section?:Section}){
 const current:Section=onlySaved?'saved':section;
 const demo=useDemoAccount();
 const displayName=user?.display_name||demo?.nickname||'访客';
 const [rows,setRows]=useState<RecordRow[]>([]),[savedCount,setSavedCount]=useState(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [consent,setConsent]=useState<boolean|null>(()=>analyticsChoice());
 const [nickname,setNickname]=useState(''),[headline,setHeadline]=useState(''),[city,setCity]=useState(''),[intro,setIntro]=useState(''),[skills,setSkills]=useState('');
 const [role,setRole]=useState(''),[targetCity,setTargetCity]=useState(''),[mode,setMode]=useState<'不限'|'远程'|'现场'|'混合办公'>('不限');
 const [notice,setNotice]=useState('');
 const [selectedFile,setSelectedFile]=useState('');
 useEffect(()=>{
  setNickname(demo?.nickname||'');setHeadline(demo?.headline||'');setCity(demo?.city||'');
  setIntro(demo?.intro||'');setSkills(demo?.skills||'');
  setRole(demo?.preferredRole||'');setTargetCity(demo?.preferredCity||'');setMode(demo?.workMode||'不限');
 },[demo?.updatedAt]);
 useEffect(()=>{
  if(!savedAvailable||!['overview','saved'].includes(current))return;
  let active=true;
  setLoading(true);setError('');
  listSavedJobs().then(async records=>{
   if(!active)return;
   setSavedCount(records.length);
   if(current==='overview'){setRows([]);return;}
   const results:RecordRow[]=[];
   for(const record of records.slice(0,40)){
    if(!active)return;
    try{const detail=await getJob(record.jobId,new AbortController().signal);
      results.push({record,job:detail.job});}
    catch{results.push({record,job:null});}
   }
   if(active)setRows(results);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'收藏服务暂不可用')})
  .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[current]);
 const cancel=async(id:string)=>{
  setBusy(id);setError('');
  try{await setSavedJob(id,false);setRows(all=>all.filter(item=>item.record.jobId!==id));setSavedCount(n=>Math.max(0,n-1))}
  catch(e){setError(e instanceof Error?e.message:'操作失败')}
  finally{setBusy('')}
 };
 function update(event:FormEvent<HTMLFormElement>,which:'profile'|'preferences'){
  event.preventDefault();setNotice('');
  if(!demoModeEnabled||!demo){setNotice('请先进入模拟账户');return;}
  try{
   if(which==='profile')updateDemoAccount({nickname,headline,city,intro,skills});
   else updateDemoAccount({preferredRole:role,preferredCity:targetCity,workMode:mode});
   setNotice('演示资料已保存在本浏览器；并未创建真实账号。');
  }catch(e){setNotice(e instanceof Error?e.message:'暂无法保存')}
 }
 const sectionTitle=pages.find(page=>page.id===current)?.label||'个人中心';
 return <Shell user={user}>
 <section className="hhba-personal hhba-account-page">
  <nav className="hhba-personal-trail"><Link to="/">首页</Link><span>/</span><Link to="/candidate">求职中心</Link><span>/</span><strong>{sectionTitle}</strong></nav>
  <header className="hhba-account-header">
   <div className="hhba-account-avatar"><UserRound size={28}/></div>
   <div className="hhba-account-identity"><span className="hhba-account-eyebrow">MY CAREER SPACE</span>
    <h1>{displayName}，欢迎回来</h1>
    <p>{demo?.headline||'把每一份职业机会都整理好，找到更适合自己的方向。'}</p>
    <span className="hhba-account-chip">{user?'真实账户':demo?'已进入演示账户':'未进入演示'} · {user?'账户资料': '前端体验模式'}</span>
   </div>
   {demoModeEnabled&&demo&&<button className="hhba-account-exit" type="button" onClick={()=>{exitDemoAccount();navigate('/candidate/login')}}><LogOut size={15}/>退出演示</button>}
  </header>
  {demoModeEnabled&&<div className="hhba-account-warning"><ShieldCheck size={17}/>
   <span><strong>模拟账户演示：</strong>这里的昵称、简历界面和求职偏好不代表真实注册，数据仅留在当前浏览器；不会获得企业权限，也不计入平台注册及活跃用户。</span>
  </div>}
  {!demo&&!user&&<section className="hhba-account-entry">
   <div><strong>先体验完整个人中心</strong><p>无需真实邮箱或密码。选择模拟登录，也可以注册一个自定义的演示昵称。</p></div>
   <div className="hhba-account-actions"><Link to="/candidate/login">模拟登录</Link><Link to="/candidate/register">模拟注册</Link></div>
  </section>}
  <div className="hhba-account-grid">
   <aside className="hhba-account-sidebar" aria-label="个人中心导航">
    <p>我的空间</p>
    {pages.map(page=><Link key={page.id} to={routeFor(page.id)} className={page.id===current?'active':''} aria-current={page.id===current?'page':undefined}>
      <page.icon size={17}/><span>{page.label}</span><ArrowRight size={14} className="hhba-account-chevron"/>
    </Link>)}
    <Link to="/candidate/account/legal-aid"><Scale size={17}/><span>法律援助</span><ArrowRight size={14} className="hhba-account-chevron"/></Link>
   </aside>
   <div className="hhba-account-content">
    {current==='overview'&&<>
      <div className="hhba-account-section-heading"><div><h2>个人工作台</h2><p>你的职业探索，从这里开始。</p></div><Link to="/candidate/jobs">探索职位 <ArrowRight size={15}/></Link></div>
      <div className="hhba-account-stat-grid">
       <Link to="/candidate/saved"><Bookmark size={21}/><span>已收藏岗位</span><strong>{!savedAvailable?'—':loading?'…':error?'—':savedCount}</strong><small>本浏览器真实收藏记录</small></Link>
       <Link to="/candidate/account/applications"><BriefcaseBusiness size={21}/><span>求职申请</span><strong>—</strong><small>正式账号接入后开放</small></Link>
       <Link to="/candidate/account/resume"><FileUser size={21}/><span>我的简历</span><strong>—</strong><small>仅演示页面，不保存文件</small></Link>
      </div>
      <section className="hhba-account-panel"><div className="hhba-account-section-heading"><div><h3>完善我的职业档案</h3><p>体验个人资料、求职偏好与账户隐私设置。</p></div></div>
       <div className="hhba-account-tool-grid">
        {pages.filter(x=>['profile','preferences','resume','privacy'].includes(x.id)).map(x=><Link to={routeFor(x.id)} key={x.id} className="hhba-account-tool-card"><x.icon size={20} className="hhba-account-tool-icon"/><span className="hhba-account-tool-copy"><strong>{x.label}</strong><small>{x.description}</small></span><ArrowRight size={15} className="hhba-account-tool-arrow"/></Link>)}
       </div>
      </section>
      <section className="hhba-account-panel"><div className="hhba-account-section-heading"><div><h3>真实招聘市场</h3><p>收藏后返回这里查看，企业岗位是否仍在招以官网为准。</p></div><Link to="/candidate/jobs">查看全部岗位 <ArrowRight size={15}/></Link></div>
        {error?<p role="alert">{error}</p>:<p>当前收藏数据按本浏览器隔离，正式账号级跨设备同步仍在规划中。</p>}
      </section>
    </>}
    {current==='saved'&&<section className="hhba-account-panel">
      <div className="hhba-account-section-heading"><div><h2>我的收藏</h2><p>只展示来自真实职位索引的收藏记录。下架职位不会被伪装成仍在招聘。</p></div><Link to="/candidate/jobs">搜索更多 <ArrowRight size={15}/></Link></div>
      {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
      {loading?<p role="status">正在读取本浏览器收藏…</p>:rows.length===0?<div className="hhba-account-empty"><Bookmark size={27}/><strong>还没有保存职位</strong><p>在职位列表或详情页点击「收藏」，就可以回到这里查看。</p><Link to="/candidate/jobs">去逛逛招聘市场</Link></div>:
      <div className="hhba-personal-saved-list">{rows.map(({record,job})=><article key={record.jobId}>
       <div><strong>{job?localizedTitle(job,'zh'):'此岗位当前无法获取'}</strong><small>{job?localizedCompany(job,'zh')+' · '+localizedLocation(job,'zh'):'收藏记录已保留，但岗位可能已失效'}</small><small>收藏于 {record.savedAt.slice(0,10)}</small></div>
       <div className="hhba-personal-actions">{job&&<Link to={'/candidate/jobs/'+encodeURIComponent(record.jobId)}>查看岗位</Link>}<button type="button" disabled={busy===record.jobId} onClick={()=>cancel(record.jobId)}>取消收藏</button></div>
      </article>)}</div>}
      {savedCount>40&&<p className="hhba-account-muted">当前仅显示最近 40 条收藏。</p>}
      <p className="hhba-account-muted">当前是本设备收藏，并非模拟账户创造的虚假数据。</p>
    </section>}
    {current==='profile'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>个人资料</h2><p>填写用于界面体验的非敏感示例内容。</p></div></div>
     {!demo&&demoModeEnabled?<p>进入演示账户后可修改并保存资料。</p>:
     <form className="hhba-account-form" onSubmit={e=>update(e,'profile')}>
      <div className="hhba-account-form-row"><label>展示昵称<input value={nickname} maxLength={32} onChange={e=>setNickname(e.target.value)} placeholder="职业探索者"/></label><label>所在城市<input value={city} maxLength={70} onChange={e=>setCity(e.target.value)} placeholder="例如：济南"/></label></div>
      <label>职业介绍<input value={headline} maxLength={110} onChange={e=>setHeadline(e.target.value)} placeholder="用一句话介绍自己"/></label>
      <label>擅长的能力 / 技能<input value={skills} maxLength={150} onChange={e=>setSkills(e.target.value)} placeholder="例如：市场策划、数据整理、项目沟通"/></label>
      <label>个人简介<textarea value={intro} maxLength={380} rows={4} onChange={e=>setIntro(e.target.value)} placeholder="写一段简单的职业自我介绍"/></label>
      <div className="hhba-account-form-actions"><button type="submit" disabled={!demo}>保存演示资料</button><small>仅保存于本机浏览器，不上传服务器</small></div>
     </form>}
     {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
    </section>}
    {current==='preferences'&&<section className="hhba-account-panel">
      <div className="hhba-account-section-heading"><div><h2>求职偏好</h2><p>让个人中心先具备真实交互，不触发 AI 匹配或岗位申请。</p></div></div>
      <form className="hhba-account-form" onSubmit={e=>update(e,'preferences')}>
       <label>期望岗位<input value={role} onChange={e=>setRole(e.target.value)} maxLength={70} placeholder="例如：产品运营、销售管理"/></label>
       <label>期望工作城市<input value={targetCity} onChange={e=>setTargetCity(e.target.value)} maxLength={70} placeholder="例如：上海、杭州或远程"/></label>
       <label>期望工作方式<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option>不限</option><option>远程</option><option>现场</option><option>混合办公</option></select></label>
       <div className="hhba-account-form-actions"><button type="submit" disabled={!demo}>保存求职偏好</button><small>这是界面预览，尚未作为自动匹配条件</small></div>
      </form>{notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
    </section>}
    {current==='resume'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>我的简历</h2><p>预览未来简历管理的页面与交互。</p></div></div>
     <div className="hhba-account-upload"><FileUser size={31}/><h3>添加你的简历</h3>
      <p>选择文件仅在浏览器中展示文件名，本演示不读取、保存或上传文件。</p>
      <label className="hhba-account-upload-button">选择演示文件<input type="file" accept=".pdf,.docx" onChange={e=>setSelectedFile(e.target.files?.[0]?.name||'')}/></label>
      {selectedFile&&<p className="hhba-account-notice" role="status">已选择：{selectedFile}（未上传）</p>}
     </div><p className="hhba-account-muted">正式账户上线后才会开放私有文件存储、简历解析与真实状态展示。</p>
    </section>}
    {current==='applications'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>求职记录</h2><p>未来集中查看真实投递记录与进度。</p></div></div>
     <div className="hhba-account-empty"><BriefcaseBusiness size={27}/><strong>暂无真实求职记录</strong><p>当前模拟身份不会向招聘企业发送申请，也不会生成虚假的「已投递」记录。</p><Link to="/candidate/jobs">浏览招聘岗位</Link></div>
    </section>}
    {current==='privacy'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>账户与隐私</h2><p>在这里决定是否允许匿名行为统计，并管理演示资料。</p></div></div>
     <div className="hhba-account-privacy-row"><div><strong><ChartNoAxesCombined size={18}/>匿名网站使用统计</strong><p>仅在同意后记录访问和职位操作，不采集简历、邮箱或搜索词。</p></div>
      <div className="hhba-personal-consent"><button type="button" aria-pressed={consent===true} onClick={()=>{chooseAnalytics(true);setConsent(true)}}>同意</button><button type="button" aria-pressed={consent===false} onClick={()=>{chooseAnalytics(false);setConsent(false)}}>拒绝</button></div>
     </div>
     <div className="hhba-account-privacy-row"><div><strong><LockKeyhole size={18}/>账户安全</strong><p>尚未建立真实登录凭据；演示模式不会要求密码或验证邮箱。</p></div><span className="hhba-account-chip">未连接</span></div>
     <div className="hhba-account-privacy-row"><div><strong><Trash2 size={18}/>清除本地演示资料</strong><p>仅删除昵称和偏好，不会删除服务器中本设备已有的岗位收藏。</p></div>
      <button type="button" className="hhba-account-danger" disabled={!demo} onClick={()=>{if(confirm('确定清除本浏览器的演示账户资料吗？本设备岗位收藏不会删除。')){deleteDemoAccount();navigate('/candidate/login')}}}>清除演示资料</button></div>
    </section>}
   </div>
  </div>
  <footer className="hhba-account-footer"><CheckCircle2 size={15}/> 你看到的是 HHBA 前端体验版。展示数据不会被计入管理后台融资指标。</footer>
 </section>
 </Shell>;
}
