import {type FormEvent,useEffect,useState} from 'react';
import {ArrowRight,Bookmark,BriefcaseBusiness,CheckCircle2,Compass,FileUser,LockKeyhole,LogOut,Scale,ShieldCheck,SlidersHorizontal,UserRound,ChartNoAxesCombined} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {getJob,localizedCompany,localizedLocation,localizedTitle,type LiveJob} from '../services/liveRecruitment';
import {listSavedJobs,setSavedJob,savedAvailable,type SavedJob} from '../services/savedJobs';
import {analyticsChoice,chooseAnalytics} from '../services/engagement';
import {getCandidateWorkspaceProfile,saveCandidateWorkspaceProfile,saveCandidateWorkspacePreferences,realWorkspaceAvailable,type CandidateWorkspaceProfile} from '../services/candidateWorkspace';
import {type User} from '../services/api';
import '../styles/personal-center.css';

type Section='overview'|'profile'|'preferences'|'resume'|'applications'|'privacy'|'saved';
type RecordRow={record:SavedJob;job:LiveJob|null};
const pages:{id:Section;label:string;icon:typeof UserRound;description:string}[]=[
 {id:'overview',label:'工作台',icon:Compass,description:'了解你的职业探索进度'},
 {id:'saved',label:'我的收藏',icon:Bookmark,description:'查看保存的真实岗位'},
 {id:'profile',label:'个人资料',icon:UserRound,description:'填写真实个人资料'},
 {id:'preferences',label:'求职偏好',icon:SlidersHorizontal,description:'地点、职位和工作方式'},
 {id:'resume',label:'我的简历',icon:FileUser,description:'私有简历功能待接入'},
 {id:'applications',label:'求职记录',icon:BriefcaseBusiness,description:'真实投递记录待接入'},
 {id:'privacy',label:'账户与隐私',icon:ShieldCheck,description:'管理真实账户与匿名统计'},
];
function routeFor(id:Section){return id==='overview'?'/candidate/account':id==='saved'?'/candidate/saved':'/candidate/account/'+id;}
export function PersonalCenterPage({user,onlySaved=false,section='overview',onLogout}:{user:User|null;onlySaved?:boolean;section?:Section;onLogout:()=>Promise<void>}){
 const current:Section=onlySaved?'saved':section;
 const [account,setAccount]=useState<CandidateWorkspaceProfile|null>(null),[profileLoading,setProfileLoading]=useState(true);
 const displayName=account?.display_name||user?.display_name||'求职者';
 const [rows,setRows]=useState<RecordRow[]>([]),[savedCount,setSavedCount]=useState(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [consent,setConsent]=useState<boolean|null>(()=>analyticsChoice());
 const [nickname,setNickname]=useState(''),[headline,setHeadline]=useState(''),[city,setCity]=useState(''),[intro,setIntro]=useState(''),[skills,setSkills]=useState('');
 const [role,setRole]=useState(''),[targetCity,setTargetCity]=useState(''),[mode,setMode]=useState<'不限'|'远程'|'现场'|'混合办公'>('不限');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  if(!user?.account_types?.includes('candidate'))navigate('/candidate/login');
 },[user?.id]);
 useEffect(()=>{
  if(!user?.account_types?.includes('candidate')||!realWorkspaceAvailable){setProfileLoading(false);return;}
  let active=true;setProfileLoading(true);setAccount(null);
  getCandidateWorkspaceProfile().then(data=>{
   if(!active)return;
   setAccount(data);
   setNickname(data.display_name||'');setHeadline(data.headline||'');setCity(data.city||'');
   setIntro(data.intro||'');setSkills(data.skills||'');
   setRole(data.preferred_role||'');setTargetCity(data.preferred_city||'');setMode(data.work_mode||'不限');
  }).catch(e=>{if(active)setNotice(e instanceof Error?e.message:'真实账户资料读取失败')})
   .finally(()=>{if(active)setProfileLoading(false)});
  return()=>{active=false};
 },[user?.id]);
 useEffect(()=>{
  if(!user||!savedAvailable||!['overview','saved'].includes(current))return;
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
 },[current,user?.id]);
 const cancel=async(id:string)=>{
  setBusy(id);setError('');
  try{await setSavedJob(id,false);setRows(all=>all.filter(item=>item.record.jobId!==id));setSavedCount(n=>Math.max(0,n-1))}
  catch(e){setError(e instanceof Error?e.message:'操作失败')}
  finally{setBusy('')}
 };
 async function update(event:FormEvent<HTMLFormElement>,which:'profile'|'preferences'){
  event.preventDefault();setNotice('');
  if(!user||!account||!realWorkspaceAvailable){setNotice('真实账户服务未接通或登录状态失效');return;}
  setBusy(which);
  try{
   if(which==='profile'){
    await saveCandidateWorkspaceProfile({display_name:nickname,headline,city,intro,skills});
    setAccount(prev=>prev?{...prev,display_name:nickname.trim(),headline:headline.trim(),city:city.trim(),intro:intro.trim(),skills:skills.trim()}:null);
   }else{
    await saveCandidateWorkspacePreferences({preferred_role:role,preferred_city:targetCity,work_mode:mode});
    setAccount(prev=>prev?{...prev,preferred_role:role.trim(),preferred_city:targetCity.trim(),work_mode:mode}:null);
   }
   setNotice('已保存到当前真实账户。');
  }catch(e){setNotice(e instanceof Error?e.message:'保存失败，请重试')}
  finally{setBusy('')}
 }
 const sectionTitle=pages.find(page=>page.id===current)?.label||'个人中心';
 if(!user?.account_types?.includes('candidate'))return <Shell user={user}><section className="hhba-personal"><p role="status">请先使用真实求职者账号登录。</p><Link to="/candidate/login">前往登录</Link></section></Shell>;
 return <Shell user={user}>
 <section className="hhba-personal hhba-account-page">
  <nav className="hhba-personal-trail"><Link to="/">首页</Link><span>/</span><Link to="/candidate">求职中心</Link><span>/</span><strong>{sectionTitle}</strong></nav>
  <header className="hhba-account-header">
   <div className="hhba-account-avatar"><UserRound size={28}/></div>
   <div className="hhba-account-identity"><span className="hhba-account-eyebrow">MY CAREER SPACE</span>
    <h1>{displayName}，欢迎回来</h1><p>{account?.headline||'把每一份职业机会都整理好，找到更适合自己的方向。'}</p>
    <span className="hhba-account-chip">真实求职者账户 · {account?'资料已连接':profileLoading?'读取中':'资料连接待确认'}</span>
   </div>
   {user&&<button className="hhba-account-exit" type="button" onClick={()=>void onLogout()}><LogOut size={15}/>退出登录</button>}
  </header>
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
       <Link to="/candidate/saved"><Bookmark size={21}/><span>已收藏岗位</span><strong>{!savedAvailable?'—':loading?'…':error?'—':savedCount}</strong><small>真实账户专属收藏</small></Link>
       <Link to="/candidate/account/applications"><BriefcaseBusiness size={21}/><span>求职申请</span><strong>—</strong><small>真实投递服务尚未接通</small></Link>
       <Link to="/candidate/account/resume"><FileUser size={21}/><span>我的简历</span><strong>—</strong><small>私有简历服务尚未接通</small></Link>
      </div>
      <section className="hhba-account-panel"><div className="hhba-account-section-heading"><div><h3>完善我的职业档案</h3><p>真实账户资料与求职偏好可跨设备读取。</p></div></div>
       <div className="hhba-account-tool-grid">
        {pages.filter(x=>['profile','preferences','resume','privacy'].includes(x.id)).map(x=><Link to={routeFor(x.id)} key={x.id} className="hhba-account-tool-card"><x.icon size={20} className="hhba-account-tool-icon"/><span className="hhba-account-tool-copy"><strong>{x.label}</strong><small>{x.description}</small></span><ArrowRight size={15} className="hhba-account-tool-arrow"/></Link>)}
       </div>
      </section>
      <section className="hhba-account-panel"><div className="hhba-account-section-heading"><div><h3>真实招聘市场</h3><p>收藏后返回这里查看，企业岗位是否仍在招以官网为准。</p></div><Link to="/candidate/jobs">查看全部岗位 <ArrowRight size={15}/></Link></div>
        {error?<p role="alert">{error}</p>:<p>收藏按当前已登录账户隔离，匿名设备记录不会自动合并。</p>}
      </section>
    </>}
    {current==='saved'&&<section className="hhba-account-panel">
      <div className="hhba-account-section-heading"><div><h2>我的收藏</h2><p>只展示来自真实职位索引的收藏记录。下架职位不会被伪装成仍在招聘。</p></div><Link to="/candidate/jobs">搜索更多 <ArrowRight size={15}/></Link></div>
      {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
      {loading?<p role="status">正在读取当前账户收藏…</p>:rows.length===0?<div className="hhba-account-empty"><Bookmark size={27}/><strong>还没有保存职位</strong><p>在职位列表或详情页点击「收藏」，就可以回到这里查看。</p><Link to="/candidate/jobs">去逛逛招聘市场</Link></div>:
      <div className="hhba-personal-saved-list">{rows.map(({record,job})=><article key={record.jobId}>
       <div><strong>{job?localizedTitle(job,'zh'):'此岗位当前无法获取'}</strong><small>{job?localizedCompany(job,'zh')+' · '+localizedLocation(job,'zh'):'收藏记录已保留，但岗位可能已失效'}</small><small>收藏于 {record.savedAt.slice(0,10)}</small></div>
       <div className="hhba-personal-actions">{job&&<Link to={'/candidate/jobs/'+encodeURIComponent(record.jobId)}>查看岗位</Link>}<button type="button" disabled={busy===record.jobId} onClick={()=>cancel(record.jobId)}>取消收藏</button></div>
      </article>)}</div>}
      {savedCount>40&&<p className="hhba-account-muted">当前仅显示最近 40 条收藏。</p>}
      <p className="hhba-account-muted">当前收藏只属于你的真实登录账户。</p>
    </section>}
    {current==='profile'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>个人资料</h2><p>资料保存在当前已验证的真实账户中，不会公开给企业。</p></div></div>
     {profileLoading?<p role="status">正在读取账户资料…</p>:<form className="hhba-account-form" onSubmit={e=>void update(e,'profile')}>
      <div className="hhba-account-form-row"><label>展示昵称<input value={nickname} maxLength={32} onChange={e=>setNickname(e.target.value)} placeholder="如何称呼你"/></label><label>所在城市<input value={city} maxLength={70} onChange={e=>setCity(e.target.value)} placeholder="例如：济南"/></label></div>
      <label>职业介绍<input value={headline} maxLength={110} onChange={e=>setHeadline(e.target.value)} placeholder="用一句话介绍自己"/></label>
      <label>擅长能力 / 技能<input value={skills} maxLength={150} onChange={e=>setSkills(e.target.value)} placeholder="例如：项目沟通、数据分析"/></label>
      <label>个人简介<textarea value={intro} maxLength={380} rows={4} onChange={e=>setIntro(e.target.value)} placeholder="写一段真实的职业介绍"/></label>
      <div className="hhba-account-form-actions"><button type="submit" disabled={!account||busy==='profile'}>{busy==='profile'?'保存中…':'保存账户资料'}</button><small>仅写入当前真实账户</small></div>
     </form>}
     {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
    </section>}
    {current==='preferences'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>求职偏好</h2><p>信息保存到当前账户，不会自动产生职位申请。</p></div></div>
     {profileLoading?<p role="status">正在读取偏好…</p>:<form className="hhba-account-form" onSubmit={e=>void update(e,'preferences')}>
      <label>期望岗位<input value={role} onChange={e=>setRole(e.target.value)} maxLength={70} placeholder="例如：产品运营、销售管理"/></label>
      <label>期望工作城市<input value={targetCity} onChange={e=>setTargetCity(e.target.value)} maxLength={70} placeholder="例如：上海、杭州或远程"/></label>
      <label>期望工作方式<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option>不限</option><option>远程</option><option>现场</option><option>混合办公</option></select></label>
      <div className="hhba-account-form-actions"><button type="submit" disabled={!account||busy==='preferences'}>{busy==='preferences'?'保存中…':'保存求职偏好'}</button><small>重新登录后仍可读取</small></div>
     </form>}{notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
    </section>}
    {current==='resume'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>我的简历</h2><p>上传简历需要专属私有文件存储和明确授权。</p></div></div>
     <div className="hhba-account-upload"><FileUser size={31}/><h3>真实简历功能尚未开放</h3><p>尚未接通此账户的私有简历存储，因此暂不收取文件，也不显示虚构的简历数。</p></div>
    </section>}
    {current==='applications'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>求职记录</h2><p>实际申请状态必须由真实投递接口提供。</p></div></div>
     <div className="hhba-account-empty"><BriefcaseBusiness size={27}/><strong>真实投递接口尚未接通</strong><p>仅浏览外部岗位不会被记成“已投递”。</p><Link to="/candidate/jobs">浏览招聘岗位</Link></div>
    </section>}
    {current==='privacy'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>账户与隐私</h2><p>管理当前真实账户和匿名统计授权。</p></div></div>
     <div className="hhba-account-privacy-row"><div><strong><ChartNoAxesCombined size={18}/>匿名网站使用统计</strong><p>仅在同意后记录匿名访问和职位操作，不采集简历正文或密码。</p></div>
      <div className="hhba-personal-consent"><button type="button" aria-pressed={consent===true} onClick={()=>{chooseAnalytics(true);setConsent(true)}}>同意</button><button type="button" aria-pressed={consent===false} onClick={()=>{chooseAnalytics(false);setConsent(false)}}>拒绝</button></div>
     </div>
     <div className="hhba-account-privacy-row"><div><strong><LockKeyhole size={18}/>账户安全</strong><p>只有当前登录用户可读取其个人资料与收藏。</p></div><span className="hhba-account-chip">真实账户</span></div>
     <div className="hhba-account-privacy-row"><div><strong><LogOut size={18}/>安全退出</strong><p>仅撤销当前会话，不删除账户资料。</p></div><button type="button" className="hhba-account-danger" onClick={()=>void onLogout()}>退出登录</button></div>
    </section>}

   </div>
  </div>
  <footer className="hhba-account-footer"><CheckCircle2 size={15}/> 当前账户资料与收藏按真实用户归属；未接通功能不显示虚构数据。</footer>
 </section>
 </Shell>;
}
