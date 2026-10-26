import {useEffect,useState} from 'react';
import {ArrowLeft,ClipboardList,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,ApiError,employerApiReady,recruitmentResponsibilityApiReady,type RecruitmentResponsibility,type CandidateJobApplication,type User} from '../services/api';
import '../styles/employer-applications.css';
import {RecruitmentDue} from '../components/RecruitmentDue';
const stages:Record<string,string>={submitted:'已提交',reviewing:'企业正在查看',shortlisted:'已进入候选名单',interview:'进入面试阶段',rejected:'未通过当前筛选',hired:'企业标记录用',withdrawn:'已撤回'};
function message(e:unknown){return e instanceof ApiError?e.message:'暂时无法读取申请状态，请稍后再试'}
export function MyEmployerApplicationsPage({user}:{user:User|null}){
 const [items,setItems]=useState<CandidateJobApplication[]>([]);
 const [responsibilities,setResponsibilities]=useState<RecruitmentResponsibility[]>([]);
 const [slaError,setSlaError]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{if(!employerApiReady||!user){setLoading(false);return}let active=true;
  api.myEmployerApplications().then(r=>{if(active)setItems(r.items)})
   .catch(e=>{if(active)setNotice(message(e))})
   .finally(()=>{if(active)setLoading(false)});
  if(recruitmentResponsibilityApiReady)api.myRecruitmentResponsibilities().then(r=>{if(active)setResponsibilities(r.items)}).catch(e=>{if(active){setSlaError(message(e));setResponsibilities([])}});
  return()=>{active=false}
 },[user]);
 async function withdraw(id:string){
  if(!window.confirm('撤回后企业将不能继续在 HHBA 查看你本次共享的资料，且无法再次申请同一个岗位。确认撤回？'))return;
  setBusy(id);setNotice('');
  try{
   await api.withdrawEmployerApplication(id);
   const data=await api.myEmployerApplications();setItems(data.items);
   if(recruitmentResponsibilityApiReady){try{const r=await api.myRecruitmentResponsibilities();setResponsibilities(r.items);setSlaError('')}catch(e){setSlaError(message(e));setResponsibilities([])}}
   setNotice('已撤回该岗位申请。本次共享档案和申请说明已在服务器清空。')
  }catch(e){setNotice(message(e))}finally{setBusy('')}
 }
 return <Shell user={user}><main className="hhba-applications-page">
  <Link className="hhba-applications-back" to="/candidate/employer-jobs"><ArrowLeft size={15}/> 企业招聘岗位</Link>
  <div className="hhba-applications-title"><ClipboardList size={22}/><div><span className="page-kicker">HHBA · 我的申请</span>
   <h1>我的企业岗位申请与进度</h1><p>这里只包含你明确授权后通过 HHBA 提交的企业直发岗位申请。海外 ATS 企业官网申请不在此统计。</p></div></div>
  {!employerApiReady&&<div className="hhba-apply-offline" role="status">申请业务服务器尚未上线，此处为页面预览，不会生成任何虚假申请或录用结果。</div>}
  {employerApiReady&&!user&&<div className="hhba-apply-note">请先 <Link to="/candidate/login">登录求职者账户</Link> 查看你的真实申请进度。</div>}
  {notice&&<p className="hhba-apply-error" role="status">{notice}</p>}
  {loading&&<p className="hhba-applications-muted">正在读取申请进度…</p>}
  {!loading&&user&&employerApiReady&&items.length===0&&<div className="hhba-applications-empty">你还没有提交企业直发岗位申请。<Link to="/candidate/employer-jobs">去查看岗位 →</Link></div>}
  {!recruitmentResponsibilityApiReady&&<p className="hhba-sla-unavailable">招聘责任期限和企业履约核查尚未接入真实服务；当前申请进度仍沿用原有功能。</p>}
  {slaError&&<p role="status" className="hhba-sla-unavailable">责任状态暂不可查询：{slaError}</p>}
  {items.map(item=><article className="hhba-applications-item" key={item.id}>
   <div className="hhba-applications-item-top"><div><strong>{item.title}</strong><p>{item.company} · {item.location}</p></div><span>{stages[item.status]||'状态待更新'}</span></div>
   <small>提交时间：{item.created_at?.slice(0,10)||'请核对'} · 最后更新：{item.updated_at?.slice(0,10)||'请核对'}</small>
   {recruitmentResponsibilityApiReady&&<RecruitmentDue record={responsibilities.find(r=>r.application_id===item.id)}/>}
   <div className="hhba-applications-actions">
    <Link to={'/candidate/employer-jobs/'+item.posting_id.replace(/^employer-/,'')}>查看岗位</Link>
    {item.status!=='withdrawn'&&<button disabled={busy===item.id} onClick={()=>void withdraw(item.id)}>{busy===item.id?'正在撤回…':'撤回并删除本次共享资料'}</button>}
   </div>
  </article>)}
  <p className="hhba-apply-footer"><ShieldCheck size={15}/> 你可以撤回单份岗位申请。企业改变招聘状态不会自动获取你的私人联系方式或简历原文件。</p>
 </main></Shell>;
}
