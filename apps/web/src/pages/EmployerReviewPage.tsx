import {useEffect,useState} from 'react';
import {ArrowLeft,CheckCheck,ClipboardCheck,FileCheck2,ShieldAlert,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,ApiError,type EmployerPosting,type EmployerVerificationQueue,type EmployerVerificationAdminDetail,type User} from '../services/api';
import '../styles/employer-review.css';

const reasonLength=3;
const readable=(e:unknown)=>e instanceof ApiError?e.message:'审核接口暂不可用，请勿将此项视为通过审核';
const uuid=(s:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
const privateDocumentHref=(docId:string)=>{
 const root=import.meta.env.VITE_API_BASE||'/api/v1';
 if(!uuid(docId))return '#';
 return root.replace(/\/$/,'')+'/admin/verification/documents/'+docId;
};

export function EmployerReviewPage({user}:{user:User|null}){
 const [tab,setTab]=useState<'jobs'|'orgs'>('jobs');
 const [jobs,setJobs]=useState<EmployerPosting[]>([]);
 const [orgs,setOrgs]=useState<EmployerVerificationQueue['items']>([]);
 const [selected,setSelected]=useState<EmployerVerificationAdminDetail|null>(null);
 const [selectedId,setSelectedId]=useState('');
 const [reviewReason,setReviewReason]=useState('manual_review_completed');
 const [approval,setApproval]=useState({entity:false,representative:false,authorization:false});
 const [docChecked,setDocChecked]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);
 async function load(){
  const [j,v]=await Promise.all([api.adminPendingPostings(),api.adminOrgVerificationQueue()]);
  setJobs(j.items);setOrgs(v.items);
 }
 useEffect(()=>{if(user?.role!=='admin'){setLoading(false);return;}let active=true;
  load().catch(e=>{if(active)setNotice(readable(e))}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[user]);
 async function reviewJob(job:EmployerPosting,decision:'approved'|'rejected'){
  if(reviewReason.trim().length<reasonLength)return setNotice('请填写至少 3 个字符的审核理由代码。');
  setBusy(true);setNotice('');
  try{await api.adminPostingReview(job.id,decision,reviewReason.trim());await load();setNotice('处理完成，页面显示的是当前真实审核状态。')}
  catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 async function pickOrg(id:string){
  setSelectedId(id);setSelected(null);setApproval({entity:false,representative:false,authorization:false});setDocChecked({});
  setNotice('');setBusy(true);
  try{setSelected(await api.adminOrgVerificationDetail(id))}
  catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 async function markDocument(id:string,status:'clean'|'rejected'){
  if(!docChecked[id])return setNotice('请先打开并人工核验原始材料，再确认检查结果。');
  setNotice('');setBusy(true);
  try{await api.adminMarkDocumentSecurity(id,status,reviewReason.trim().length>=3?reviewReason.trim():'manual_document_check');
   setSelected(await api.adminOrgVerificationDetail(selectedId));setDocChecked(p=>({...p,[id]:false}));
   setNotice('已记录材料人工安全检查状态；此操作不等于企业认证。');}
  catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 async function reviewOrg(status:'approved'|'rejected'|'need_more_info'){
  if(!selected||!selectedId||!selected.evidence_snapshot)return setNotice('认证证据快照不存在，不能审核。');
  if(reviewReason.trim().length<3)return setNotice('请填写至少 3 个字符的审核原因代码。');
  const v=selected.verification;
  if(status==='approved'&&(!approval.entity||!approval.representative||!approval.authorization||!v.documents.length||v.documents.some(d=>d.security_status!=='clean')))
   return setNotice('不可通过：必须查看原件、独立核实企业主体及招聘授权，经办人真实身份，并确认全部证明材料检查完成。');
  setNotice('');setBusy(true);
  try{
   await api.adminReviewOrgVerification(selectedId,{
    status,reason_code:reviewReason.trim(),expected_revision:v.revision,evidence_snapshot_id:selected.evidence_snapshot.id,
    entity_verification:status==='approved'?'manual_verified':'not_verified',
    representative_verification:status==='approved'?'manual_verified':'not_verified',
    authorization_verification:status==='approved'?'manual_verified':'not_verified',valid_days:180});
   setSelected(null);setSelectedId('');await load();setNotice('人工审核结果已保存。')}
  catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 if(!user||user.role!=='admin')return <Shell user={user}><main className="employer-review"><h1>无权访问管理审核</h1><p>此处仅限 HHBA 管理员，不对普通求职者或招聘方开放。</p><Link to="/">返回首页</Link></main></Shell>;
 return <Shell user={user}><main className="employer-review">
  <Link className="employer-review-back" to="/employer/workspace"><ArrowLeft size={14}/> 企业工作台</Link>
  <div className="employer-review-head"><ShieldCheck size={20}/><div><span className="page-kicker">HHBA 审核后台 · 管理员专属</span><h1>企业认证及职位人工审核</h1><p>独立核验材料、招聘主体、职位真实性。任何操作均需服务器管理员权限及 CSRF 令牌，不能靠切换前端状态批准。</p></div></div>
  <p><Link to="/admin/employer-evidence" className="employer-review-back"><FileCheck2 size={15}/> 进入企业员工关怀证据核验队列</Link></p><p><Link to="/admin/employer-scoring" className="employer-review-back"><ShieldCheck size={15}/> 进入企业双评分内部审核</Link></p>
  <div className="employer-review-tabs"><button className={tab==='jobs'?'selected':''} onClick={()=>setTab('jobs')}>待审核岗位（{jobs.length}）</button><button className={tab==='orgs'?'selected':''} onClick={()=>setTab('orgs')}>待审核企业（{orgs.length}）</button></div>
  <label className="employer-review-reason">审核理由代码<input maxLength={120} value={reviewReason} onChange={e=>setReviewReason(e.target.value)} placeholder="例如：manual_verification_completed"/></label>
  {notice&&<p role="status" className="employer-review-alert">{notice}</p>}
  {loading?<p>正在从后台读取待审核资料…</p>:tab==='jobs'?<>
   {!jobs.length?<div className="employer-review-empty"><ClipboardCheck size={22}/> 当前没有待审核职位。</div>:jobs.map(job=><article className="employer-review-card" key={job.id}>
    <header><strong>{job.title}</strong><span>{job.company} · {job.location}</span></header>
    <p><b>岗位职责：</b>{job.description}</p><p><b>任职要求：</b>{job.requirements}</p>
    <p><b>投递地址：</b><a href={job.apply_url} target="_blank" rel="noopener noreferrer">{job.apply_url}</a></p>
    <p className="employer-review-notice">批准前请核对企业主体、具体岗位真实性、投递网址是否由招聘主体控制，且确认无诈骗、非法收费或歧视性招聘信息。</p>
    <footer><button disabled={busy} onClick={()=>void reviewJob(job,'rejected')}>拒绝该岗位</button><button disabled={busy} className="employer-review-approve" onClick={()=>void reviewJob(job,'approved')}><CheckCheck size={15}/> 人工审核通过</button></footer>
   </article>)}
  </>:<>
   {!orgs.length?<div className="employer-review-empty">没有待审核的企业认证申请。</div>:<div className="employer-review-org-list">{orgs.map(x=><button key={x.organization_id} className={selectedId===x.organization_id?'selected':''} onClick={()=>void pickOrg(x.organization_id)}><b>{x.legal_name}</b><small>申请人：{x.representative_name||'待核对'} · 第 {x.revision} 版材料</small></button>)}</div>}
   {selected&&<section className="employer-review-card">
    <h2>企业主体与证据</h2>
    <p>企业法定名称：{selected.verification.legal_name} · 注册地：{selected.verification.registered_location}</p>
    <p>统一社会信用代码（脱敏）：{selected.verification.credit_code_masked}</p>
    <p>经办人：{selected.verification.representative?.real_name} · {selected.verification.representative?.job_title}</p>
    <p>关系：{selected.verification.representative?.relationship_type||'未提交'}</p>
    <p>证据版本：{selected.verification.revision} · {selected.evidence_snapshot?'已有冻结证据快照':'缺少证据快照'}</p>
    <h3>原始认证材料与安全检查</h3>
    {selected.verification.documents.map(d=><div className="employer-review-document" key={d.id}>
     <FileCheck2 size={18}/><div><b>{d.filename}</b><p>{d.document_type==='business_license'?'营业执照':'招聘授权书'} · {d.security_status||'待检查'}</p>
       <a href={privateDocumentHref(d.id)} target="_blank" rel="noopener noreferrer">在受保护接口中查看原始文件</a></div>
     <label><input type="checkbox" checked={!!docChecked[d.id]} onChange={e=>setDocChecked({...docChecked,[d.id]:e.target.checked})}/> 已查看且人工检查原件</label>
     <button disabled={busy||!docChecked[d.id]} onClick={()=>void markDocument(d.id,'clean')}>标记检查通过</button>
     <button disabled={busy||!docChecked[d.id]} onClick={()=>void markDocument(d.id,'rejected')}>材料异常</button>
    </div>)}
    <div className="employer-review-checks"><h3>批准企业前必须独立核验</h3>
      <label><input type="checkbox" checked={approval.entity} onChange={e=>setApproval({...approval,entity:e.target.checked})}/> 确认企业登记信息与营业执照、登记渠道吻合</label>
      <label><input type="checkbox" checked={approval.representative} onChange={e=>setApproval({...approval,representative:e.target.checked})}/> 确认经办人身份真实，关系可验证</label>
      <label><input type="checkbox" checked={approval.authorization} onChange={e=>setApproval({...approval,authorization:e.target.checked})}/> 确认其拥有代表企业开展招聘的有效授权</label>
    </div>
    <footer><button disabled={busy} onClick={()=>void reviewOrg('need_more_info')}>要求补充材料</button><button disabled={busy} onClick={()=>void reviewOrg('rejected')}>拒绝认证</button><button disabled={busy} className="employer-review-approve" onClick={()=>void reviewOrg('approved')}>企业认证审核通过</button></footer>
   </section>}
  </>}
  <p className="employer-review-notice"><ShieldAlert size={14}/> 认证审核不能依靠自动检查代替人工判断。当前没有企业认证资料和后台服务时，不展示演示企业或伪造审批结果。</p>
 </main></Shell>;
}
