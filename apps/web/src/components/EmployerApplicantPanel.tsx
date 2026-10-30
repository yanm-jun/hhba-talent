import {useEffect,useState} from 'react';
import {LockKeyhole,ShieldCheck,Users} from 'lucide-react';
import {RecruitmentDue} from './RecruitmentDue';
import {api,ApiError,employerApiReady,recruitmentResponsibilityApiReady,type RecruitmentResponsibility,type ApplicationStage,type EmployerJobApplication,type EmployerPosting} from '../services/api';
import '../styles/employer-applications.css';
const stages:Record<ApplicationStage,string>={submitted:'已提交',reviewing:'审阅中',shortlisted:'入围',interview:'面试',rejected:'未通过',hired:'拟录用',withdrawn:'已撤回'};
const next:Record<string,ApplicationStage[]>={submitted:['reviewing','shortlisted','rejected'],reviewing:['shortlisted','interview','rejected'],shortlisted:['interview','rejected'],interview:['hired','rejected']};
function explain(e:unknown){return e instanceof ApiError?e.status===403?'招聘主体认证、成员权限或授权失效，已阻止访问申请资料。':e.status===404?'岗位已关闭或申请资料已撤回，不能继续查看。':e.status===409?'申请状态已变化，请刷新后重试。':e.message:'服务器暂不可用，请稍后重试'}
export function EmployerApplicantPanel({oid,postings}:{oid:string;postings:EmployerPosting[]}){
 const [pid,setPid]=useState('');
 const [items,setItems]=useState<EmployerJobApplication[]>([]);
 const [responsibilities,setResponsibilities]=useState<RecruitmentResponsibility[]>([]);
 const [slaError,setSlaError]=useState('');
 const [slaLoaded,setSlaLoaded]=useState(false);

 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const available=postings.filter(p=>p.status==='published');
 useEffect(()=>{if(!available.some(p=>p.id===pid)){setPid(available[0]?.id||'');setItems([]);setResponsibilities([]);setSlaLoaded(false)}},[oid,postings,pid]);
 useEffect(()=>{if(!pid||!oid||!employerApiReady){setItems([]);setResponsibilities([]);setSlaLoaded(false);return}
  let alive=true;setBusy(true);setMsg('');setSlaError('');setResponsibilities([]);setSlaLoaded(false);
  api.employerJobApplications(oid,pid).then(r=>{if(alive)setItems(r.items)})
   .catch(e=>{if(alive){setItems([]);setMsg(explain(e))}})
   .finally(()=>{if(alive)setBusy(false)});
  if(recruitmentResponsibilityApiReady)api.employerRecruitmentResponsibilities(oid,pid).then(r=>{if(alive){setResponsibilities(r.items);setSlaLoaded(true)}}).catch(e=>{if(alive){setResponsibilities([]);setSlaLoaded(false);setSlaError(explain(e))}});
  return()=>{alive=false};
 },[oid,pid]);
 async function change(row:EmployerJobApplication,status:ApplicationStage){
  setBusy(true);setMsg('');
  try{
   await api.updateEmployerApplicationStatus(oid,pid,row.id,status,row.status as ApplicationStage);
   const r=await api.employerJobApplications(oid,pid);
   setItems(r.items);setMsg('申请状态已更新；责任是否完成由独立服务端履约记录判定。');
   if(recruitmentResponsibilityApiReady){try{const t=await api.employerRecruitmentResponsibilities(oid,pid);setResponsibilities(t.items);setSlaError('');setSlaLoaded(true)}catch(e){setResponsibilities([]);setSlaLoaded(false);setSlaError(explain(e))}}
  }catch(e){setMsg(explain(e));try{const r=await api.employerJobApplications(oid,pid);setItems(r.items)}catch{setItems([])}}
  finally{setBusy(false)}
 }
 return <section className="hhba-employer-applicants">
  <div className="employer-ws-card-heading"><Users size={19}/><div><h2>收到的求职申请</h2>
   <p>原有申请状态功能保留，增加处理期限与待办核查；只展示本岗位获明确授权的资料，不展示原始简历或联系方式。</p></div></div>
  {!employerApiReady?<p className="hhba-apply-offline"><LockKeyhole size={16}/> 当前只提供界面预览，实际申请数据库尚未上线。</p>:
   available.length===0?<p className="hhba-applications-muted">当前没有处于公开有效状态的岗位。岗位审核通过后，才能开始接收和管理申请。</p>:
   <>
    <label className="hhba-apply-label">选择已审核的企业直发岗位
     <select value={pid} onChange={e=>setPid(e.target.value)}>{available.map(p=><option key={p.id} value={p.id}>{p.title} · {p.location}</option>)}</select>
    </label>
    {recruitmentResponsibilityApiReady&&slaLoaded&&!slaError?<div className="hhba-sla-metrics" aria-label="本岗位招聘责任待办"><div><strong>{responsibilities.filter(r=>['awaiting','reviewing','overdue'].includes(r.state)).length}</strong><small>待处理</small></div><div><strong>{responsibilities.filter(r=>r.state==='overdue').length}</strong><small>超期待核查</small></div><div><strong>{responsibilities.filter(r=>r.state==='responded').length}</strong><small>已初步处理</small></div></div>:
     <p className="hhba-sla-unavailable">{slaError?'责任服务无法查询：'+slaError:recruitmentResponsibilityApiReady?'正在读取服务端履约记录；未完成查询前不显示零值。':'招聘责任服务尚未接通；不展示虚构待办、期限或逾期数量。'}</p>}
    {msg&&<p role="status" className="hhba-apply-note">{msg}</p>}
    {busy&&<p className="hhba-applications-muted">正在读取或更新申请…</p>}
    {!busy&&items.length===0&&!msg&&<p className="hhba-applications-muted">此岗位目前没有求职者授权提交的有效申请。</p>}
    {items.map(item=><article className="hhba-applicant-card" key={item.id}>
     <div className="hhba-applicant-top"><strong>{item.shared_fields?.display_name||'求职者未披露姓名'}</strong><span>{stages[item.status as ApplicationStage]||item.status}</span></div>
     <p>能力方向：{item.shared_fields?.headline||'未披露'}</p>
     <p>技能：{item.shared_fields?.skills?.join('、')||'未披露'}</p>
     <p>地区：{item.shared_fields?.location||'未披露'} · 经验：{item.shared_fields?.work_years===null?'未披露':item.shared_fields?.work_years+' 年'}</p>
     {item.cover_note&&<p className="hhba-applicant-note">候选人申请说明：{item.cover_note}</p>}
     {recruitmentResponsibilityApiReady&&<RecruitmentDue record={responsibilities.find(r=>r.application_id===item.id)}/>}
     <div className="hhba-applicant-actions"><small>申请：{item.created_at?.slice(0,10)||'未提供'}</small>
      {next[item.status]?.map(status=><button key={status} disabled={busy} onClick={()=>void change(item,status)}>{status==='reviewing'?'开始审阅（不结束回应责任）':'标记为'+stages[status]}</button>)}
     </div>
    </article>)}
   </>}
  <p className="hhba-apply-footer"><ShieldCheck size={14}/> 企业身份或招聘授权失效、岗位关闭、候选人撤回申请时，后台会拒绝继续读取或处理相关申请。</p>
 </section>;
}
