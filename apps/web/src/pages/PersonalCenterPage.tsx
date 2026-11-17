import {type FormEvent,useEffect,useState} from 'react';
import {ArrowRight,Bookmark,BriefcaseBusiness,CheckCircle2,Compass,FileUser,LockKeyhole,LogOut,MousePointerClick,Scale,ShieldCheck,SlidersHorizontal,UserRound,ChartNoAxesCombined,GraduationCap,Building2,ClipboardCheck,FolderOpen,CalendarCheck2} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {getJob,localizedCompany,localizedLocation,localizedTitle,type LiveJob} from '../services/liveRecruitment';
import {listSavedJobs,setSavedJob,savedAvailable,type SavedJob} from '../services/savedJobs';
import {eraseAccountAnalytics,getMyActivityCheck,type MyActivityCheck,type AccountArea} from '../services/engagement';
import {getCandidateWorkspaceProfile,saveCandidateWorkspaceProfile,saveCandidateWorkspacePreferences,realWorkspaceAvailable,type CandidateWorkspaceProfile} from '../services/candidateWorkspace';
import {type User} from '../services/api';
import {PrivateResumeVault} from '../components/PrivateResumeVault';
import {CandidateMatchHistory} from '../components/CandidateMatchHistory';
import {listMatchHistory} from '../services/matchHistory';
import {ApplyAssistantProduct} from '../components/ApplyAssistantProduct';
import {listPrivateResumes,privateResumeAvailable} from '../services/privateResumes';
import '../styles/personal-center.css';
// Preserve the existing workbench layout styles while deleting the obsolete demo identity logic.
import '../styles/demo-account.css';
import '../styles/career-refresh.css';

type Section='overview'|'profile'|'preferences'|'resume'|'applications'|'privacy'|'saved'|'apply-assistant';
type RecordRow={record:SavedJob;job:LiveJob|null};
const pages:{id:Section;label:string;icon:typeof UserRound;description:string}[]=[
 {id:'overview',label:'工作台',icon:Compass,description:'了解你的职业探索进度'},
 {id:'saved',label:'我的收藏',icon:Bookmark,description:'查看保存的真实岗位'},
 {id:'profile',label:'个人资料',icon:UserRound,description:'填写真实个人资料'},
 {id:'preferences',label:'求职偏好',icon:SlidersHorizontal,description:'地点、职位和工作方式'},
 {id:'resume',label:'我的简历',icon:FileUser,description:'账户私有简历管理'},
 {id:'applications',label:'匹配历史',icon:BriefcaseBusiness,description:'AI 推荐的岗位及适配理由'},
 {id:'privacy',label:'账户与隐私',icon:ShieldCheck,description:'账户安全与历史数据管理'},
];
function routeFor(id:Section){return id==='overview'?'/candidate/account':id==='saved'?'/candidate/saved':'/candidate/account/'+id;}
export function PersonalCenterPage({user,onlySaved=false,section='overview',onLogout}:{user:User|null;onlySaved?:boolean;section?:Section;onLogout:()=>Promise<void>}){
 const current:Section=onlySaved?'saved':section;
 const [account,setAccount]=useState<CandidateWorkspaceProfile|null>(null),[profileLoading,setProfileLoading]=useState(true);
 const displayName=account?.display_name||user?.display_name||'求职者';
 const [rows,setRows]=useState<RecordRow[]>([]),[savedCount,setSavedCount]=useState(0);
 const [visibleSaved,setVisibleSaved]=useState(40);
 const [resumeCount,setResumeCount]=useState<number|null>(null);
 const [historyCount,setHistoryCount]=useState<number|null>(null);
 const [newOpportunityCount,setNewOpportunityCount]=useState(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [myActivity,setMyActivity]=useState<MyActivityCheck|null>(null);
 const [activityChecking,setActivityChecking]=useState(false);
 const [activityCheckError,setActivityCheckError]=useState('');
 const [erasureState,setErasureState]=useState<'idle'|'pending'|'cleared'|'failed'>('idle');
 const [nickname,setNickname]=useState(''),[headline,setHeadline]=useState(''),[city,setCity]=useState(''),[intro,setIntro]=useState(''),[skills,setSkills]=useState('');
 const [role,setRole]=useState(''),[targetCity,setTargetCity]=useState(''),[mode,setMode]=useState<'不限'|'远程'|'现场'|'混合办公'>('不限');
 const [notice,setNotice]=useState('');
 const [careerStage,setCareerStage]=useState<'seeking'|'working'>('seeking');
 useEffect(()=>{
  if(!user?.id)return;
  try{setCareerStage(window.localStorage.getItem('hhba:career-stage:'+user.id)==='working'?'working':'seeking');}
  catch{setCareerStage('seeking');}
 },[user?.id]);
 const selectCareerStage=(stage:'seeking'|'working')=>{
  setCareerStage(stage);
  if(user?.id){try{window.localStorage.setItem('hhba:career-stage:'+user.id,stage)}catch{/* Browser preference is optional. */}}
 };
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
   const visible=records.slice(0,visibleSaved);
   // Resolve only the visible page of bookmarks in small, bounded batches.
   for(let offset=0;offset<visible.length;offset+=10){
    if(!active)return;
    const chunk=await Promise.all(visible.slice(offset,offset+10).map(async record=>{
     try{const detail=await getJob(record.jobId,new AbortController().signal);
       return {record,job:detail.job} as RecordRow;}
     catch{return {record,job:null} as RecordRow;}
    }));
    results.push(...chunk);
   }
   if(active)setRows(results);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'收藏服务暂不可用')})
  .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[current,user?.id,visibleSaved]);
 useEffect(()=>{
  if(!user?.account_types?.includes('candidate')||!privateResumeAvailable)return;
  let active=true;
  const refresh=()=>{void listPrivateResumes().then(items=>{
   if(active)setResumeCount(items.length);
  }).catch(()=>{if(active)setResumeCount(null);});};
  refresh();
  window.addEventListener('hhba:private-resumes-changed',refresh);
  return()=>{active=false;window.removeEventListener('hhba:private-resumes-changed',refresh);};
 },[user?.id]);
 useEffect(()=>{
  if(!user?.account_types?.includes('candidate'))return;
  let active=true;
  const refresh=()=>{void listMatchHistory().then(rows=>{
    if(!active)return;
    setHistoryCount(rows.length);
    setNewOpportunityCount(rows[0]?.new_job_count||0);
   }).catch(()=>{if(active)setHistoryCount(null)});
  };
  refresh();
  window.addEventListener('hhba:match-history-changed',refresh);
  return()=>{active=false;window.removeEventListener('hhba:match-history-changed',refresh)};
 },[user?.id]);
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
 useEffect(()=>{setMyActivity(null);setActivityCheckError('')},[user?.id]);
 useEffect(()=>{setErasureState('idle')},[user?.id]);
 async function retryErasure(){
  setErasureState('pending');
  const result=await eraseAccountAnalytics();
  setErasureState(result==='cleared'?'cleared':'failed');
 }
 async function checkMyActivity(){
  setActivityChecking(true);setActivityCheckError('');setMyActivity(null);
  try{setMyActivity(await getMyActivityCheck())}
  catch(e){setActivityCheckError(e instanceof Error?e.message:'暂时无法验证统计结果，请重试。')}
  finally{setActivityChecking(false)}
 }
 const areaLabels:Record<AccountArea,string>={general:'一般访问',jobs:'岗位浏览',companies:'企业资料',policies:'人才政策',tools:'求职工具',job_save:'岗位收藏操作'};
 const trackingPrevented=typeof navigator!=='undefined'&&(navigator.doNotTrack==='1'||(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true);
 const sectionTitle=current==='apply-assistant'?'一键网申':pages.find(page=>page.id===current)?.label||'个人中心';
 if(!user?.account_types?.includes('candidate'))return <Shell user={user}><section className="hhba-personal"><p role="status">请先使用真实求职者账号登录。</p><Link to="/candidate/login">前往登录</Link></section></Shell>;
 return <Shell user={user}>
 <section className="hhba-personal hhba-account-page hhba-career-revamp">
  <nav className="hhba-personal-trail"><Link to="/">首页</Link><span>/</span><Link to="/candidate">求职中心</Link><span>/</span><strong>{sectionTitle}</strong></nav>
  <header className="hhba-account-header">
   <div className="hhba-account-avatar"><UserRound size={28}/></div>
   <div className="hhba-account-identity"><span className="hhba-account-eyebrow">汇方职场 · YOUR CAREER, CONTINUED</span>
    <h1>{displayName}，欢迎回来</h1><p>{account?.headline||'从寻找机会，到进入企业与持续成长，你的职业记录都在这里。'}</p>
    <span className="hhba-account-chip">个人账户 · {account?'资料已连接':profileLoading?'读取中':'资料连接待确认'}</span>
   </div>
   {user&&<button className="hhba-account-exit" type="button" onClick={()=>void onLogout()}><LogOut size={15}/>退出登录</button>}
  </header>
  <div className="hhba-account-grid">
   <aside className="hhba-account-sidebar" aria-label="个人中心导航">
    <p>我的职业空间</p>
    {pages.map(page=><Link key={page.id} to={routeFor(page.id)} className={page.id===current?'active':''} aria-current={page.id===current?'page':undefined}>
      <page.icon size={17}/><span>{page.label}</span><ArrowRight size={14} className="hhba-account-chevron"/>
    </Link>)}
    <Link to="/candidate/account/rights"><ShieldCheck size={17}/><span>职场权益中心</span><ArrowRight size={14} className="hhba-account-chevron"/></Link>
    <Link to="/candidate/account/legal-aid"><Scale size={17}/><span>劳动权益知识</span><ArrowRight size={14} className="hhba-account-chevron"/></Link>
   </aside>
   <div className="hhba-account-content">
    {current==='overview'&&<>
      <div className="hhba-career-switch" aria-label="职业阶段显示偏好">
       <div className="hhba-career-switch-copy"><strong>你目前处于哪个职业阶段？</strong><small>随时切换展示重点；仅在本设备记住偏好，不影响账号、简历或会员资格。</small></div>
       <div className="hhba-career-switch-buttons">
        <button type="button" aria-pressed={careerStage==='seeking'} onClick={()=>selectCareerStage('seeking')}><GraduationCap size={16}/>正在求职</button>
        <button type="button" aria-pressed={careerStage==='working'} onClick={()=>selectCareerStage('working')}><BriefcaseBusiness size={16}/>已经入职</button>
       </div>
      </div>
      <section className="hhba-career-hero" aria-labelledby="career-home-title">
       <div>
        <span className="hhba-career-kicker"><ShieldCheck size={15}/> HHBA · CAREER & RIGHTS</span>
        <h2 id="career-home-title">{careerStage==='working'?'进入职场以后，HHBA 继续与你同行。':'从找到好工作，到安心开启职业生活。'}</h2>
        <p>{careerStage==='working'?'已经入职？可以继续完善职业档案、了解企业公开风险信息，以及规划未来的职场权益服务。':'继续使用官方岗位搜索、AI 匹配和个人简历；找到工作后，无需注册新账号，也能继续使用职业成长与权益服务。'}</p>
        <div className="hhba-career-hero-actions">
         <Link className="hhba-career-primary" to={careerStage==='working'?'/candidate/account/rights':'/candidate/jobs'}>{careerStage==='working'?'了解职场权益服务':'继续探索真实岗位'} <ArrowRight size={16}/></Link>
         <Link className="hhba-career-text-link" to={careerStage==='working'?'/candidate/account/resume':'/candidate/account/rights'}>{careerStage==='working'?'维护我的职业档案':'了解入职后的权益服务'} <ArrowRight size={15}/></Link>
        </div>
       </div>
       <aside className="hhba-career-membership">
        <span>规划中的职业与劳动权益支持会员</span>
        <strong>¥24.90<small> / 月</small></strong>
        <p>面向毕业三年内、符合企业准入条件的年轻劳动者。按月服务、最长36个月；当前尚未开放购买或案件受理。</p>
        <Link to="/candidate/account/rights">查看月度服务与资格说明 <ArrowRight size={15}/></Link>
       </aside>
      </section>
      <div className="hhba-career-section-heading"><div><h3>{careerStage==='working'?'在职阶段 · 计划中的月度服务':'未来入职 · 了解权益支持'}</h3><p>将求职、职业成长与劳动权益支持连接起来；服务尚未开放时如实标注。</p></div><Link to="/candidate/account/rights">查看详情 <ArrowRight size={14}/></Link></div>
      <div className="hhba-career-feature-grid">
       <article className="hhba-career-feature-card"><span className="hhba-career-feature-icon"><Building2 size={19}/></span><strong>任职企业公开信息</strong><p>了解企业公开信用与劳动相关处罚信息，按月追踪重要变化。</p><small>月度监测规划中</small></article>
       <article className="hhba-career-feature-card"><span className="hhba-career-feature-icon"><ClipboardCheck size={19}/></span><strong>个人劳动权益核对</strong><p>根据本人授权资料核对合同、工资、工时和社保，缺失信息不虚构。</p><small>月度检查规划中</small></article>
       <article className="hhba-career-feature-card"><span className="hhba-career-feature-icon"><FolderOpen size={19}/></span><strong>职业成长档案</strong><p>保存职业经历与工作成果，和原有私有简历管理衔接。</p><small>现有简历功能可使用</small></article>
      </div>
      <p className="hhba-career-notice"><CalendarCheck2 size={14} style={{verticalAlign:'middle',marginRight:6}}/>职场权益会员、月度报告和人工法律服务尚未开放。此页面不会显示虚假的付费状态、已完成报告或案件数量。</p>
      <div className="hhba-account-section-heading"><div><h2>我的求职工具</h2><p>原有收藏、AI 匹配历史、私有简历与一键网申全部保留。</p></div><Link to="/candidate/jobs">探索岗位 <ArrowRight size={15}/></Link></div>
      <div className="hhba-account-stat-grid">
       <Link to="/candidate/saved"><Bookmark size={21}/><span>已收藏岗位</span><strong>{!savedAvailable?'—':loading?'…':error?'—':savedCount}</strong><small>真实账户专属收藏</small></Link>
       <Link to="/candidate/account/applications"><BriefcaseBusiness size={21}/><span>AI 匹配历史</span><strong>{historyCount===null?'—':historyCount}</strong><small>{newOpportunityCount>0?'最近一次新增 '+newOpportunityCount+' 个未推荐岗位':'保存真实推荐 · 不等于已投递'}</small></Link>
       <Link to="/candidate/account/resume"><FileUser size={21}/><span>我的简历</span><strong>{resumeCount===null?'—':resumeCount}</strong><small>{resumeCount===null?'私有存储尚未开通':'仅本人可访问'}</small></Link>
       <Link to="/candidate/account/apply-assistant"><MousePointerClick size={21}/><span>一键网申</span><strong className="hhba-account-stat-plugin-version">¥0.30</strong><small>AI 辅助填写 · 次数套餐</small></Link>
      </div>
      <section className="hhba-account-panel"><div className="hhba-account-section-heading"><div><h3>完善我的职业档案</h3><p>真实账户资料与求职偏好可跨设备读取。</p></div></div>
       <div className="hhba-account-tool-grid">
        {pages.filter(x=>['profile','preferences','resume','privacy'].includes(x.id)).map(x=><Link to={routeFor(x.id)} key={x.id} className="hhba-account-tool-card"><x.icon size={20} className="hhba-account-tool-icon"/><span className="hhba-account-tool-copy"><strong>{x.label}</strong><small>{x.description}</small></span><ArrowRight size={15} className="hhba-account-tool-arrow"/></Link>)}
       </div>
      </section>
      {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
    </>}
    {current==='apply-assistant'&&<ApplyAssistantProduct userId={user?.id}/>}
    {current==='saved'&&<section className="hhba-account-panel">
      <div className="hhba-account-section-heading"><div><h2>我的收藏</h2><p>只展示来自真实职位索引的收藏记录。下架职位不会被伪装成仍在招聘。</p></div><Link to="/candidate/jobs">搜索更多 <ArrowRight size={15}/></Link></div>
      {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
      {loading?<p role="status">正在读取当前账户收藏…</p>:rows.length===0?<div className="hhba-account-empty"><Bookmark size={27}/><strong>还没有保存职位</strong><p>在职位列表或详情页点击「收藏」，就可以回到这里查看。</p><Link to="/candidate/jobs">去逛逛招聘市场</Link></div>:
      <div className="hhba-personal-saved-list">{rows.map(({record,job})=><article key={record.jobId}>
       <div><strong>{job?localizedTitle(job,'zh'):'此岗位当前无法获取'}</strong><small>{job?localizedCompany(job,'zh')+' · '+localizedLocation(job,'zh'):'收藏记录已保留，但岗位可能已失效'}</small><small>收藏于 {record.savedAt.slice(0,10)}</small></div>
       <div className="hhba-personal-actions">{job&&<Link to={'/candidate/jobs/'+encodeURIComponent(record.jobId)}>查看岗位</Link>}<button type="button" disabled={busy===record.jobId} onClick={()=>cancel(record.jobId)}>取消收藏</button></div>
      </article>)}</div>}
      {!loading&&savedCount>rows.length&&<div className="hhba-personal-actions">
        <button type="button" onClick={()=>setVisibleSaved(n=>Math.min(300,n+40))}>加载更多收藏（已显示 {rows.length} / {savedCount}）</button>
       </div>}
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
    {current==='resume'&&<PrivateResumeVault/>}
    {current==='applications'&&<CandidateMatchHistory/>}
    {current==='privacy'&&<section className="hhba-account-panel">
     <div className="hhba-account-section-heading"><div><h2>账户与隐私</h2><p>查看账户安全、数据使用说明和历史记录清理。</p></div></div>
     <div className="hhba-account-privacy-row"><div><strong><ChartNoAxesCombined size={18}/>运营数据的使用范围</strong>
      <p>网站只汇总不关联个人的页面访问、岗位浏览、岗位搜索及官网跳转次数。不设置访问统计 Cookie，不保存访客标识、搜索词、详细页面地址、简历正文或个人联系方式。注册人数和岗位收藏数量来自真实业务记录，不据此推断个人浏览轨迹。</p>
      <p>不再新增可按账号识别的日活行为记录，因此账号 DAU、WAU、MAU 和用户留存暂不统计，也不会用浏览量冒充。</p>
     </div></div>
     <div className="hhba-account-privacy-row hhba-activity-verification">
      <div><strong><CheckCircle2 size={18}/>清理旧版账号统计记录</strong>
       <p>下方只读查询和历史删除专用于旧版账号活动记录。新版本不再写入这些记录，也不需要为使用网站单独选择统计授权。</p>
       {erasureState==='pending'&&<p role="status">正在向服务器申请删除旧版账号活动记录…</p>}
       {erasureState==='cleared'&&<p className="hhba-account-activity-result" role="status">服务器已确认旧版账号活动记录清理完成；可重新只读查询核实。</p>}
       {erasureState==='failed'&&<p className="hhba-account-activity-error" role="alert">尚未获得服务器删除成功确认；原记录可能仍在，请重试。</p>}
       {trackingPrevented&&<p role="status">已检测到浏览器 DNT/GPC 隐私偏好，网站会停止普通页面事件统计。</p>}
       {myActivity&&<p className="hhba-account-activity-result" role="status">{myActivity.day} UTC：
        {myActivity.recorded?'旧版今日记录：'+myActivity.areas.map(a=>areaLabels[a]).join('、')+'。':'没有旧版今日账号活动记录。'}
        {myActivity.historicalRecorded?'旧版历史账号活动记录仍存在。':'旧版账号活动记录已不存在。'}</p>}
       {activityCheckError&&<p className="hhba-account-activity-error" role="alert">{activityCheckError}</p>}
      </div>
      <div className="hhba-account-actions">
       <button type="button" className="hhba-account-activity-button" disabled={activityChecking||erasureState==='pending'} onClick={()=>void checkMyActivity()}>
        {activityChecking?'正在查询…':'只读查询旧记录'}
       </button>
       <button type="button" className="hhba-account-activity-button" disabled={erasureState==='pending'} onClick={()=>void retryErasure()}>
        {erasureState==='pending'?'正在清理…':'清除旧版活动记录'}
       </button>
      </div>
     </div>
     <div className="hhba-account-privacy-row"><div><strong><LockKeyhole size={18}/>账户安全</strong><p>只有当前登录用户可读取其个人资料与收藏。</p></div><span className="hhba-account-chip">真实账户</span></div>
     <div className="hhba-account-privacy-row"><div><strong><LogOut size={18}/>安全退出</strong><p>仅撤销当前会话，不删除账户资料。</p></div><button type="button" className="hhba-account-danger" onClick={()=>void onLogout()}>退出登录</button></div>
    </section>}

   </div>
  </div>
 </section>
 </Shell>;
}
