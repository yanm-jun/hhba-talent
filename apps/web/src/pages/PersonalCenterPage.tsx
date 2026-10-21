import {useEffect,useState} from 'react';
import {ArrowRight,Bookmark,BriefcaseBusiness,FileUser,ShieldCheck,SlidersHorizontal,UserRound,ChartNoAxesCombined} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {getJob,localizedCompany,localizedLocation,localizedTitle,officialStatus,type LiveJob} from '../services/liveRecruitment';
import {listSavedJobs,setSavedJob,savedAvailable,type SavedJob} from '../services/savedJobs';
import {analyticsChoice,chooseAnalytics} from '../services/engagement';
import {employerApiReady,type User} from '../services/api';
import '../styles/personal-center.css';

type RecordRow={record:SavedJob;job:LiveJob|null};
export function PersonalCenterPage({user,onlySaved=false}:{user:User|null;onlySaved?:boolean}){
 const [rows,setRows]=useState<RecordRow[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[consent,setConsent]=useState<boolean|null>(()=>analyticsChoice());
 const [busy,setBusy]=useState('');
 const reload=()=>{
  if(!savedAvailable){setLoading(false);return;}
  setLoading(true);setError('');
  listSavedJobs().then(async records=>{
   const chosen=records.slice(0,40);const results:RecordRow[]=[];
   // Bounded sequential detail reads avoid hammering the job upstream.
   for(const record of chosen){
    try{const detail=await getJob(record.jobId,new AbortController().signal);
      results.push({record,job:detail.job});}
    catch{results.push({record,job:null})}
   }
   setRows(results);
  }).catch(e=>setError(e instanceof Error?e.message:'收藏服务暂不可用'))
  .finally(()=>setLoading(false));
 };
 useEffect(()=>{reload()},[]);
 const cancel=async(id:string)=>{
  setBusy(id);setError('');
  try{await setSavedJob(id,false);setRows(current=>current.filter(row=>row.record.jobId!==id))}
  catch(e){setError(e instanceof Error?e.message:'取消收藏失败')}
  finally{setBusy('')}
 };
 return <Shell user={user}>
 <section className="hhba-personal">
   <nav className="hhba-personal-trail"><Link to="/">首页</Link><span>/</span><Link to="/candidate/account">个人中心</Link>{onlySaved&&<><span>/</span><strong>我的收藏</strong></>}</nav>
   <header className="hhba-personal-heading">
     <span className="hhba-personal-avatar"><UserRound size={26}/></span>
     <div><h1>{onlySaved?'我的岗位收藏':'个人中心'}</h1>
     <p>{user?user.display_name||'已登录用户':'访客工作空间'} · {employerApiReady&&user?'账户已连接':'账号服务待接入'}</p></div>
   </header>
   <p className="hhba-personal-notice"><ShieldCheck size={17}/>当前收藏保存在 Railway 并按本浏览器的安全随机标识隔离；还不是登录账号级跨设备同步。不要将当前收藏数当作注册用户数。</p>
   {!onlySaved&&<>
     <div className="hhba-personal-cards">
       <Link to="/candidate/saved"><Bookmark size={21}/><strong>我的收藏</strong><small>{loading?'读取中':rows.length+' 条已展示'}</small></Link>
       <Link to={employerApiReady?'/candidate/my-applications':'/candidate'}><BriefcaseBusiness size={21}/><strong>求职记录</strong><small>{employerApiReady?'查看实际申请状态':'账户开放后可用'}</small></Link>
       <Link to={employerApiReady?'/candidate/profile':'/candidate'}><FileUser size={21}/><strong>简历与档案</strong><small>{employerApiReady?'管理隐私和简历':'账户开放后可用'}</small></Link>
       <Link to="/candidate/jobs"><SlidersHorizontal size={21}/><strong>找工作</strong><small>继续搜索官方岗位</small></Link>
     </div>
     <section className="hhba-personal-panel">
       <h2><ChartNoAxesCombined size={18}/>访问统计隐私选项</h2>
       <p>仅在你同意后记录匿名页面浏览、岗位浏览与搜索动作；不保存搜索词、简历、邮箱或职位 URL。拒绝不会影响正常求职。</p>
       <div className="hhba-personal-consent">
         <button type="button" aria-pressed={consent===true} onClick={()=>{chooseAnalytics(true);setConsent(true)}}>同意匿名统计</button>
         <button type="button" aria-pressed={consent===false} onClick={()=>{chooseAnalytics(false);setConsent(false)}}>拒绝统计</button>
       </div>
     </section>
   </>}
   <section className="hhba-personal-panel" aria-label="已收藏岗位">
     <div className="hhba-personal-row"><h2><Bookmark size={18}/>我的收藏</h2><Link to="/candidate/jobs">搜索更多 <ArrowRight size={16}/></Link></div>
     {error&&<p className="hhba-personal-error" role="alert">{error}<button type="button" onClick={reload}>重试</button></p>}
     {loading?<p role="status">正在读取本设备的真实收藏…</p>:
      rows.length===0?<p>还没有收藏任何岗位。浏览职位时点击「收藏」，就可以在这里查看。</p>:
      <div className="hhba-personal-saved-list">{rows.map(({record,job})=><article key={record.jobId}>
        <div><strong>{job?localizedTitle(job,'zh'):'该岗位暂时无法获取'}</strong>
         <small>{job?localizedCompany(job,'zh')+' · '+localizedLocation(job,'zh'):'保留收藏记录以供用户自行清理'}</small>
         <small>收藏时间：{record.savedAt.slice(0,10)}</small>
        </div>
        <div className="hhba-personal-actions">
         {job&&<Link to={'/candidate/jobs/'+encodeURIComponent(record.jobId)}>查看岗位</Link>}
         <button type="button" disabled={busy===record.jobId} onClick={()=>cancel(record.jobId)}>{busy===record.jobId?'处理中…':'取消收藏'}</button>
        </div>
       </article>)}</div>}
   </section>
   <p className="hhba-personal-bottom">个人资料、简历、真正的跨设备收藏会在正式账号 API 接入后开放。当前未接入的数据不会显示模拟值。</p>
 </section></Shell>;
}
