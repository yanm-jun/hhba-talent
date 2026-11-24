import {Suspense,type FormEvent,type ReactNode,useEffect,useState} from 'react';
import {ArrowRight,Bookmark,BriefcaseBusiness,CheckCircle2,Compass,FileUser,History,LockKeyhole,LogOut,MousePointerClick,Scale,Search,ShieldCheck,SlidersHorizontal,UserRound,ChartNoAxesCombined} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {getJob,localizedCompany,localizedLocation,localizedTitle,type LiveJob} from '../services/liveRecruitment';
import {listSavedJobs,setSavedJob,savedAvailable,type SavedJob} from '../services/savedJobs';
import {eraseAccountAnalytics,getMyActivityCheck,type MyActivityCheck,type AccountArea} from '../services/engagement';
import {getCandidateWorkspaceProfile,saveCandidateWorkspaceProfile,saveCandidateWorkspacePreferences,realWorkspaceAvailable,type CandidateWorkspaceProfile} from '../services/candidateWorkspace';
import {type User} from '../services/api';
import {PrivateResumeVault} from '../components/PrivateResumeVault';
import {CandidateMatchHistory} from '../components/CandidateMatchHistory';
import {listMatchHistory,type MatchHistorySummary} from '../services/matchHistory';
import {ApplyAssistantProduct} from '../components/ApplyAssistantProduct';
import {listPrivateResumes,privateResumeAvailable} from '../services/privateResumes';
import '../styles/personal-center.css';
// Preserve the existing workbench layout styles while deleting the obsolete demo identity logic.
import '../styles/demo-account.css';
import '../styles/career-refresh.css';

type EmbeddedSection='match'|'rights'|'legal-aid'|'legal-aid-intervention'|'legal-aid-topic';
type Section='overview'|'profile'|'preferences'|'resume'|'applications'|'privacy'|'saved'|'apply-assistant'|'career'|EmbeddedSection;
type RecordRow={record:SavedJob;job:LiveJob|null};
const pages:{id:Section;label:string;icon:typeof UserRound;description:string}[]=[
 {id:'overview',label:'工作台',icon:Compass,description:'了解你的职业探索进度'},
 {id:'saved',label:'我的收藏',icon:Bookmark,description:'查看保存的真实岗位'},
 {id:'profile',label:'个人资料',icon:UserRound,description:'填写真实个人资料'},
 {id:'preferences',label:'求职偏好',icon:SlidersHorizontal,description:'地点、职位和工作方式'},
 {id:'resume',label:'我的简历',icon:FileUser,description:'账户私有简历管理'},
 {id:'applications',label:'历史查找',icon:BriefcaseBusiness,description:'AI 推荐的岗位及适配理由'},
 {id:'privacy',label:'账户与隐私',icon:ShieldCheck,description:'账户安全与历史数据管理'},
 {id:'career',label:'职业成长档案',icon:BriefcaseBusiness,description:'管理现有职业资料与简历'},
];
const navGroups=[
 {title:'求职服务',items:[
  {label:'智能岗位匹配',path:'/candidate/account/match',Icon:Search},
  {label:'我的简历',path:'/candidate/account/resume',Icon:FileUser},
  {label:'我的收藏',path:'/candidate/saved',Icon:Bookmark},
  {label:'历史查找',path:'/candidate/account/applications',Icon:History},
  {label:'一键网申',path:'/candidate/account/apply-assistant',Icon:MousePointerClick}
 ]},
 {title:'职业与权益',items:[
  {label:'职业成长档案',path:'/candidate/account/career',Icon:BriefcaseBusiness},
  {label:'劳动权益知识',path:'/candidate/account/legal-aid',Icon:Scale}
 ]},
 {title:'账户管理',items:[
  {label:'个人资料',path:'/candidate/account/profile',Icon:UserRound},
  {label:'求职偏好',path:'/candidate/account/preferences',Icon:SlidersHorizontal},
  {label:'账户与隐私',path:'/candidate/account/privacy',Icon:LockKeyhole}
 ]}
] as const;
function matchDate(raw:string){const time=Date.parse(raw);return Number.isFinite(time)?new Date(time).toLocaleDateString('zh-CN'):'时间待确认';}
function routeFor(id:Section,legalAidSlug=''){
 if(id==='overview')return '/candidate/account';
 if(id==='saved')return '/candidate/saved';
 if(id==='match')return '/candidate/account/match';
 if(id==='rights')return '/candidate/account/rights';
 if(id==='legal-aid')return '/candidate/account/legal-aid';
 if(id==='legal-aid-intervention')return '/candidate/account/legal-aid/intervention';
 if(id==='legal-aid-topic')return '/candidate/account/legal-aid/'+legalAidSlug;
 return '/candidate/account/'+id;
}
export function PersonalCenterPage({user,onlySaved=false,section='overview',onLogout,externalSections,activePath,legalAidSlug=''}:{user:User|null;onlySaved?:boolean;section?:Section;onLogout:()=>Promise<void>;externalSections?:Partial<Record<EmbeddedSection,ReactNode>>;activePath?:string;legalAidSlug?:string}){
 const current:Section=onlySaved?'saved':section;
 const [visitedSections,setVisitedSections]=useState<Set<Section>>(()=>new Set([current]));
 useEffect(()=>{setVisitedSections(previous=>previous.has(current)?previous:new Set([...previous,current]));},[current]);
 const hasVisited=(id:Section)=>visitedSections.has(id)||current===id;
 const activeRoute=activePath||routeFor(current,legalAidSlug);
 const navActive=(path:string)=>activeRoute===path||(path==='/candidate/account/legal-aid'&&(current==='legal-aid-intervention'||current==='legal-aid-topic'));
 const [account,setAccount]=useState<CandidateWorkspaceProfile|null>(null),[profileLoading,setProfileLoading]=useState(true);
 const displayName=account?.display_name||user?.display_name||'求职者';
 const [rows,setRows]=useState<RecordRow[]>([]),[savedCount,setSavedCount]=useState(0);
 const [visibleSaved,setVisibleSaved]=useState(40);
 const [resumeCount,setResumeCount]=useState<number|null>(null);
 const [historyCount,setHistoryCount]=useState<number|null>(null);
 const [latestMatch,setLatestMatch]=useState<MatchHistorySummary|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [myActivity,setMyActivity]=useState<MyActivityCheck|null>(null);
 const [activityChecking,setActivityChecking]=useState(false);
 const [activityCheckError,setActivityCheckError]=useState('');
 const [erasureState,setErasureState]=useState<'idle'|'pending'|'cleared'|'failed'>('idle');
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
    setLatestMatch([...rows].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]||null);
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
 const embeddedTitles:Partial<Record<EmbeddedSection,string>>={match:'智能岗位匹配',rights:'劳动权益','legal-aid':'劳动权益知识','legal-aid-intervention':'劳动权益知识','legal-aid-topic':'劳动权益知识'};
 const sectionTitle=current==='apply-assistant'?'一键网申':embeddedTitles[current as EmbeddedSection]||pages.find(page=>page.id===current)?.label||'个人中心';
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
    <Link to="/candidate/account" className={current==='overview'?'hhba-account-nav-home active':'hhba-account-nav-home'} aria-current={current==='overview'?'page':undefined}>
     <Compass size={17}/><span>工作台</span><ArrowRight size={14} className="hhba-account-chevron"/>
    </Link>
    {navGroups.map(group=><div className="hhba-account-nav-group" key={group.title}>
     <h2>{group.title}</h2>
     {group.items.map(item=><Link key={item.path} to={item.path}
       className={navActive(item.path)?'active':''} aria-current={navActive(item.path)?'page':undefined}>
      <item.Icon size={17}/><span>{item.label}</span><ArrowRight size={14} className="hhba-account-chevron"/>
     </Link>)}
    </div>)}
   </aside>
   <div className="hhba-account-content">
    {current==='overview'&&<>
     <div className="hhba-workbench-heading">
      <div><h2>我的工作台</h2><p>职业概览与最近记录</p></div>
     </div>
     <section className="hhba-workbench-overview" aria-labelledby="hhba-workbench-overview-title">
      <h3 id="hhba-workbench-overview-title">我的职业概览</h3>
      <div className="hhba-workbench-profile-links">
       <Link to="/candidate/account/resume"><FileUser size={20}/><strong>个人简历</strong><small>{resumeCount===null?'简历状态待确认':resumeCount===0?(historyCount&&historyCount>0?'有匹配历史 · 原文件尚未保存':'尚未保存简历'):'已保存 '+resumeCount+' 份私有简历'}</small></Link>
       <Link to="/candidate/account/career"><BriefcaseBusiness size={20}/><strong>职业经历</strong><small>{account?.headline||'管理职业介绍与成长资料'}</small></Link>
      </div>
      <div className="hhba-workbench-record-list">
       <Link to="/candidate/account/applications"><span>最近岗位匹配</span><small>{historyCount===null?'匹配记录待确认':historyCount===0?'暂无匹配记录':latestMatch?'最近：'+(latestMatch.role_hint||'智能岗位匹配')+' · '+matchDate(latestMatch.created_at):'已保存 '+historyCount+' 次匹配'}</small><ArrowRight size={16}/></Link>
       <Link to="/candidate/saved"><span>收藏的职业机会</span><small>{!savedAvailable?'暂不可读取':loading?'正在读取…':error?'收藏暂不可读取':'已收藏 '+savedCount+' 个岗位'}</small><ArrowRight size={16}/></Link>
      </div>
     </section>
     <section className="hhba-workbench-rights" aria-labelledby="hhba-workbench-rights-title">
      <div className="hhba-workbench-rights-head"><h3 id="hhba-workbench-rights-title">职业与劳动权益</h3><span>免费知识</span></div>
      <div className="hhba-workbench-rights-main"><span className="hhba-workbench-rights-icon"><ShieldCheck size={21}/></span>
       <div><strong>劳动权益知识</strong><p>免费了解劳动合同、工资、社保与职场权益知识。</p></div>
      </div>
      <Link to="/candidate/account/legal-aid" className="hhba-workbench-rights-link">查看劳动权益知识 <ArrowRight size={16}/></Link>
     </section>
     <p className="hhba-workbench-signature">HHBA · YOUR CAREER, CONTINUED</p>
     {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
    </>}
    {current==='career'&&<section className="hhba-account-panel hhba-career-record-panel">
     <div className="hhba-account-section-heading"><div><h2>职业成长档案</h2><p>沿用同一账户的个人资料和私有简历，不另建第二套职业身份。</p></div></div>
     <div className="hhba-career-record-list">
      <Link to="/candidate/account/profile"><UserRound size={20}/><span><strong>职业介绍与个人资料</strong><small>{profileLoading?'正在读取真实资料…':account?.headline||'可在个人资料中完善职业介绍、技能和所在城市'}</small></span><ArrowRight size={16}/></Link>
      <Link to="/candidate/account/resume"><FileUser size={20}/><span><strong>我的简历档案</strong><small>{resumeCount===null?'简历状态待确认':resumeCount===0?'尚未保存原文件':'已保存 '+resumeCount+' 份私有简历'}</small></span><ArrowRight size={16}/></Link>
     </div>
     <p className="hhba-career-record-notice">独立的任职经历、工作成果和阶段性更新记录尚在规划中；目前不将求职偏好当作实际工作经历，也不会生成虚假职业记录。</p>
    </section>}
    {hasVisited('apply-assistant')&&<div className="hhba-account-cached-stage" aria-hidden={current!=='apply-assistant'} style={{display:current==='apply-assistant'?'block':'none'}}><ApplyAssistantProduct userId={user?.id} active={current==='apply-assistant'}/></div>}
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
    {hasVisited('resume')&&<div className="hhba-account-cached-stage" aria-hidden={current!=='resume'} style={{display:current==='resume'?'block':'none'}}><PrivateResumeVault active={current==='resume'}/></div>}
    {hasVisited('applications')&&<div className="hhba-account-cached-stage" aria-hidden={current!=='applications'} style={{display:current==='applications'?'block':'none'}}><CandidateMatchHistory active={current==='applications'}/></div>}
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
    {externalSections&&Object.entries(externalSections).map(([rawKey,element])=>{
     const key=rawKey as EmbeddedSection;
     const inactive=current!==key;
     if(!hasVisited(key))return null;
     return <div key={key} className="hhba-account-external-stage" aria-hidden={inactive}
       style={{display:inactive?'none':'block'}}><Suspense fallback={<section className="hhba-account-panel" role="status">正在加载工作区内容…</section>}>{element}</Suspense></div>;
    })}

   </div>
  </div>
 </section>
 </Shell>;
}
