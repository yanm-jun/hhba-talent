import {useEffect,useState} from 'react';
import {ClipboardCheck,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {api,ApiError,recruitmentResponsibilityApiReady,type RecruitmentResponsibilityQueue,type EmployerPosting,type User} from '../services/api';
import '../styles/employer-workspace.css';
import '../styles/recruitment-responsibility.css';
type Applicant={organization_id:string;legal_name:string;status:string;revision:number;representative_name?:string;evidence_snapshot_id?:string};
function err(e:unknown){return e instanceof ApiError?e.message:'管理接口当前不可用'}
export function AdminRecruitmentPage({user}:{user:User|null}){
 const [applications,setApplications]=useState<Applicant[]>([]);
 const [postings,setPostings]=useState<EmployerPosting[]>([]);
 const [responsibilityQueue,setResponsibilityQueue]=useState<RecruitmentResponsibilityQueue|null>(null);
 const [responsibilityError,setResponsibilityError]=useState('');
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 async function refresh(){
  try{const [a,b]=await Promise.all([api.adminVerificationQueue(),api.adminPendingPostings()]);
   setApplications(a.items);setPostings(b.items);setNotice('');
   if(recruitmentResponsibilityApiReady){try{const q=await api.adminRecruitmentResponsibilities();setResponsibilityQueue(q);setResponsibilityError('')}catch(e){setResponsibilityQueue(null);setResponsibilityError(err(e))}}
  }
  catch(e){setNotice(err(e))}
 }
 useEffect(()=>{if(user?.role==='admin')void refresh()},[user]);
 if(!user){navigate('/auth?next='+encodeURIComponent('/admin/recruitment'));return null}
 if(user.role!=='admin')return <Shell user={user}><section className="employer-workspace"><h1>无权访问审核工作台</h1><p>只有平台管理员能够查看企业申请与招聘岗位审核队列。</p><Link to="/">返回首页</Link></section></Shell>
 async function review(p:EmployerPosting,decision:'approved'|'rejected'){
  const reason=(reasons[p.id]||'').trim();
  if(reason.length<3)return setNotice('请填写至少三个字符的实际审核说明。');
  setBusy(true);setNotice('');
  try{await api.adminReviewPosting(p.id,decision,reason);await refresh();
   setNotice(decision==='approved'?'岗位经独立人工审核通过，将按有效期展示。':'已拒绝岗位，企业可查看审核原因并修改草稿。')}
  catch(e){setNotice(err(e))}finally{setBusy(false)}
 }
 return <Shell user={user}><main className="employer-workspace">
  <div className="employer-ws-top"><span className="page-kicker">HHBA 平台管理</span><h1>企业认证与招聘岗位审核</h1><p>严格区分企业主体核验、经办人核验及招聘内容审核。不会自动批准营业执照或直接推断招聘授权。</p></div>
  {notice&&<p role="status" className="employer-ws-notice">{notice}</p>}
  <div className="employer-ws-layout">
   <section className="employer-ws-card"><div className="employer-ws-card-heading"><ShieldCheck size={20}/><div><h2>企业资质审核队列 · {applications.length}</h2><p>审核应包括营业执照真实性、经办人身份及授权材料；认证结论不能靠文件上传自动生成。</p></div></div>
    {applications.length===0?<p className="employer-ws-muted">当前没有等待审核的企业认证。</p>:applications.map(a=><article className="employer-ws-job" key={a.organization_id}><strong>{a.legal_name}</strong><p>申请经办人：{a.representative_name||'待核对'}</p><p>材料版本：{a.revision} · 当前：{a.status}</p><p>证据快照：{a.evidence_snapshot_id?'已提交，需线下及安全审核':'未获得完整证据快照'}</p><small>当前网页仅展示审核队列；证明材料查验和最终核准仍须通过受控审核流程操作。</small></article>)}
   </section>
   <section className="employer-ws-card"><div className="employer-ws-card-heading"><ClipboardCheck size={20}/><div><h2>待审核企业岗位 · {postings.length}</h2><p>与 Greenhouse、Ashby、Lever 的官方同步岗位分开处理。提交岗位不能自行公开。</p></div></div>
    {postings.length===0?<p className="employer-ws-muted">暂无待审核岗位。</p>:postings.map(p=><article className="employer-ws-job" key={p.id}>
     <strong>{p.title}</strong><p>{p.company} · {p.location} · {p.work_mode}</p>
     <h3>岗位职责</h3><p>{p.description}</p><h3>任职要求</h3><p>{p.requirements}</p>
     <a href={p.apply_url} target="_blank" rel="noopener noreferrer">核对企业提供的原始投递链接</a>
     <label>审核依据 / 拒绝原因（必须填写）<textarea rows={2} maxLength={120} value={reasons[p.id]||''} onChange={e=>setReasons({...reasons,[p.id]:e.target.value})} placeholder="填写人工审查结论，不要自动生成"/></label>
     <div className="employer-ws-actions"><button disabled={busy||!(reasons[p.id]||'').trim()} onClick={()=>void review(p,'approved')}>审核通过</button><button disabled={busy||!(reasons[p.id]||'').trim()} onClick={()=>void review(p,'rejected')}>退回修改</button></div>
    </article>)}
   </section>
  </div>
  <section className="employer-ws-card hhba-sla-admin" aria-label="招聘履约管理">
   <div className="employer-ws-card-heading"><ClipboardCheck size={20}/><div><h2>招聘履约管理</h2><p>直接在原管理后台核查站内申请是否按期获得初步回应，不把审阅中当成已完成，不自动处罚企业。</p></div></div>
   {!recruitmentResponsibilityApiReady?<p className="hhba-sla-unavailable">真实责任服务和独立审核权限尚未接通。当前没有可核实的履约统计，未知不等于零。</p>:
     responsibilityError?<p role="alert" className="hhba-sla-unavailable">{responsibilityError}</p>:
     !responsibilityQueue?<p className="hhba-sla-unavailable">正在核实履约记录…</p>:
     <><p className="hhba-sla-admin-summary">逾期待核查记录：<strong>{responsibilityQueue.total??'未核实'}</strong></p>
      {responsibilityQueue.items.length===0?<p className="employer-ws-muted">本次查询没有返回待核查记录，不代表未查询范围也是零。</p>:
       <div className="hhba-sla-admin-list">{responsibilityQueue.items.map(r=><article key={r.application_id}><strong>申请编号：{r.application_id}</strong><small>组织：{r.organization_id} · 岗位：{r.posting_id}</small><small>回应期限：{r.response_due_at}</small><span>超期待复核</span></article>)}</div>}</>}
  </section>
 </main></Shell>
}
