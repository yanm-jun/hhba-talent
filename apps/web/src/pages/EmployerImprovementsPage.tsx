import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BadgeCheck,Building2,CalendarCheck2,ClipboardCheck,FileCheck2,LockKeyhole,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {api,improvementsApiReady,type HHBAImprovement,type PublicHHBAImprovement,type EmployerEvidence,type Organization,type User} from '../services/api';
import '../styles/employer-improvements.css';

const labels:Record<string,string>={
 pay_and_contracts:'工资与劳动合同',social_insurance:'社保与员工保障',
 working_hours:'工时与休息休假',employee_development:'员工培训与成长',
 recruitment_integrity:'招聘信息诚信',business_integrity:'经营与履约诚信'
};
const statuses:Record<string,string>={
 submitted:'待独立核验',needs_more_info:'待补充依据',approved:'核验通过',rejected:'未通过',
 revoked:'已撤销公开'
};
const isUUID=(s:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
const message=(e:unknown)=>e instanceof Error?e.message:'服务暂不可用';
const today=new Date().toISOString().slice(0,10);

function Disclaimer(){
 return <div className="im-note"><ShieldCheck size={21}/><div><strong>让改善有据可查，而不是包装企业形象</strong>
 <p>只有经过独立核验和隐私检查的改善事项才可能进入公开成长时间线。公开记录不自动代表加分、官方劳动合规认证、订单增长，也不能替代员工真实体验。</p></div></div>;
}
function Empty({children}:{children:string}){return <div className="im-empty"><ClipboardCheck size={25}/><p>{children}</p></div>}

export function EmployerImprovementsPage({user}:{user:User|null}){
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [org,setOrg]=useState('');
 const [proofs,setProofs]=useState<EmployerEvidence[]>([]);
 const [items,setItems]=useState<HHBAImprovement[]>([]);
 const [evidence,setEvidence]=useState('');
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [effective,setEffective]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const enabled=improvementsApiReady&&!!user&&organizations.some(o=>o.id===org&&o.status==='approved');
 useEffect(()=>{
  if(!improvementsApiReady||!user)return;
  let active=true;
  api.organizations().then(r=>{
   if(!active)return;
   setOrganizations(r.organizations);
   setOrg(r.organizations.find(x=>x.status==='approved')?.id||'');
  }).catch(e=>{if(active)setError(message(e))});
  return()=>{active=false};
 },[user]);
 useEffect(()=>{
  if(!improvementsApiReady||!org){setProofs([]);setItems([]);return}
  let active=true;
  Promise.all([api.employerEvidence(org),api.employerImprovements(org)]).then(([proof,record])=>{
   if(!active)return;setProofs(proof.items);setItems(record.items);
  }).catch(e=>{if(active)setError(message(e))});
  return()=>{active=false};
 },[org]);
 if(improvementsApiReady&&user===null){navigate('/recruiter/login?next=%2Femployer%2Fimprovements');return null}
 async function submit(e:FormEvent){
  e.preventDefault();if(!enabled||!isUUID(evidence)||!effective)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api.submitEmployerImprovement(org,{evidence_id:evidence,title:title.trim(),
     description:description.trim(),effective_date:effective});
   setItems((await api.employerImprovements(org)).items);
   setTitle('');setDescription('');setEvidence('');setEffective('');
   setNotice('改善记录已进入独立核验队列。审核前不会出现在公开成长时间线，也不会自动加分。');
  }catch(err){setError(message(err))}
  finally{setBusy(false)}
 }
 const eligibleProofs=proofs.filter(p=>p.status==='verified'&&p.security_status==='clean');
 return <Shell user={user}><main className="im-page">
  <Link className="im-back" to="/employer/growth"><ArrowLeft size={15}/> 返回企业成长档案</Link>
  <div className="im-heading"><p>HHBA · 企业员工关怀成长体系 / 第 09 模块</p><h1>企业真实改善记录</h1>
   <p>对员工好，不应该只是一句宣传。把已经落实的改善措施和核验材料连接起来，让求职者看见真实变化。</p></div>
  <Disclaimer/>
  {!improvementsApiReady&&<div className="im-safety" role="status"><LockKeyhole size={20}/><div><strong>真实改善提交尚未开放</strong><p>这是一套可审查的静态页面预览。企业身份、独立复核和安全业务数据库接通前，不会提交、保存或伪造任何企业记录。</p></div></div>}
  {improvementsApiReady&&<div className="im-org"><Building2 size={18}/><label>当前企业 <select value={org} onChange={e=>setOrg(e.target.value)} aria-label="当前企业"><option value="">选择已认证企业</option>{organizations.map(o=><option value={o.id} key={o.id}>{o.legal_name}</option>)}</select></label></div>}
  {error&&<p className="im-error" role="alert">{error}</p>}{notice&&<p className="im-success" role="status">{notice}</p>}
  <div className="im-grid"><form className="im-card im-form" onSubmit={submit}>
   <h2><FileCheck2 size={19}/> 提交已完成的改善</h2>
   <p className="im-hint">只能关联本企业已核验且安全检查通过的证明材料。尚在计划中的措施不能作为已完成改善申报。</p>
   <label>核验证据<select disabled={!enabled||busy} value={evidence} onChange={e=>setEvidence(e.target.value)} required><option value="">请选择经核验的证明材料</option>{eligibleProofs.map(x=><option key={x.id} value={x.id}>{labels[x.category]||x.category} · {x.id.slice(0,8)}</option>)}</select></label>
   <label>改善事项名称<input value={title} maxLength={100} minLength={8} disabled={!enabled||busy} onChange={e=>setTitle(e.target.value)} placeholder="例如：新的休息休假管理制度已实施" required/></label>
   <label>具体落实情况<textarea value={description} disabled={!enabled||busy} maxLength={1200} minLength={30} rows={5} required onChange={e=>setDescription(e.target.value)} placeholder="描述已经实施的措施、执行方式和可核查依据；不要填写员工姓名、电话、工资明细等敏感资料。"/></label>
   <label>实际生效日期<input type="date" value={effective} max={today} disabled={!enabled||busy} onChange={e=>setEffective(e.target.value)} required/></label>
   <button type="submit" disabled={!enabled||busy||!evidence||title.trim().length<8||description.trim().length<30||!effective}>{enabled?'提交独立核验':'待可信认证后台接入'}</button>
  </form>
  <section className="im-card"><h2><ClipboardCheck size={19}/> 本企业改善审核进度</h2>
   <p className="im-hint">保留已经申报、待补充、核验通过和被撤销的状态记录，不能直接修改历史结论。</p>
   {items.length===0?<Empty>目前没有真实申报记录。</Empty>:
    <div className="im-list">{items.map(x=><article key={x.id} className="im-item">
     <div><strong>{x.title}</strong><span>{statuses[x.status]||x.status}</span></div>
     <p>{labels[x.category]} · 实施日期 {x.effective_date}</p>
     <small>记录编号 {x.id.slice(0,8)}</small>
    </article>)}</div>}
   <Link className="im-textlink" to={'/employer/improvements/public'+(org?'?org='+encodeURIComponent(org):'')}>查看求职者能看到的成长时间线 <ArrowRight size={15}/></Link>
  </section></div>
 </main></Shell>;
}

export function PublicEmployerImprovementsPage({user}:{user:User|null}){
 const org=new URLSearchParams(window.location.search).get('org')||'';
 const [items,setItems]=useState<PublicHHBAImprovement[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!improvementsApiReady||!isUUID(org))return;
  let active=true;
  api.publicEmployerImprovements(org).then(r=>{if(active)setItems(r.items)}).catch(e=>{if(active)setError(message(e))});
  return()=>{active=false};
 },[org]);
 return <Shell user={user}><main className="im-page">
  <Link to="/employer/verified-profile" className="im-back"><ArrowLeft size={15}/> 返回企业成长评分档案</Link>
  <div className="im-heading"><p>HHBA · 企业公开成长档案</p><h1>看得见的员工关怀改善</h1>
   <p>只有已经实施、经独立核实且获准公开的措施才会出现。没有记录，不代表企业一定不好；也不代表企业所有劳动问题已解决。</p></div>
  <Disclaimer/>
  {!improvementsApiReady&&<div className="im-safety" role="status"><LockKeyhole size={20}/><div><strong>真实成长档案尚未接通</strong><p>当前不会展示模拟企业、虚构改善事项或未经核验的评分变化。</p></div></div>}
  {improvementsApiReady&&!isUUID(org)&&<p className="im-safety">请从具体企业的公开档案进入本页，才能查看对应企业的经核验改善事项。</p>}
  {error&&<p role="alert" className="im-error">{error}</p>}
  <div className="im-card im-timeline-card"><h2><CalendarCheck2 size={20}/> 经核验的改善时间线</h2>
   {items.length===0?<Empty>暂无可以公开展示的已核验改善事项。</Empty>:
    <ol className="im-timeline">{items.map(x=><li key={x.id}><div className="im-timeline-date">{x.effective_date}</div>
     <div className="im-timeline-detail"><strong>{labels[x.category]||'企业管理改善'}</strong><p>{x.summary}</p>
      <small><BadgeCheck size={13}/> HHBA 独立材料核验 · 审核日期 {x.reviewed_date}</small></div>
    </li>)}</ol>}
   <p className="im-hint">该时间线不显示未经核实的分数变化、员工个人身份或企业自行宣传的“获得多少订单”。</p>
  </div>
 </main></Shell>;
}

export function AdminEmployerImprovementsPage({user}:{user:User|null}){
 const enabled=improvementsApiReady&&user?.role==='admin';
 const [items,setItems]=useState<HHBAImprovement[]>([]);
 const [item,setItem]=useState('');
 const [decision,setDecision]=useState<'approved'|'needs_more_info'|'rejected'>('needs_more_info');
 const [reason,setReason]=useState('');
 const [summary,setSummary]=useState('');
 const [privacy,setPrivacy]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  if(!enabled)return;let active=true;
  api.adminImprovementQueue().then(r=>{if(active)setItems(r.items)})
   .catch(e=>{if(active)setError(message(e))});
  return()=>{active=false};
 },[enabled]);
 async function review(e:FormEvent){
  e.preventDefault();if(!enabled||!item||busy)return;
  if(reason.trim().length<25){setError('审核依据至少需要 25 字。');return}
  if(decision==='approved'&&(!privacy||summary.trim().length<40)){setError('公开前须独立确认隐私安全，并提供至少 40 字的核验事实摘要。');return}
  setBusy(true);setError('');setNotice('');
  try{
   await api.adminReviewImprovement(item,{decision,reason:reason.trim(),
    public_summary:decision==='approved'?summary.trim():null,privacy_checked:decision==='approved'?privacy:false});
   setItems((await api.adminImprovementQueue()).items);
   setItem('');setReason('');setSummary('');setPrivacy(false);
   setNotice('审核结果已写入不可修改的事件流水。仅批准的真实改善可对外展示，不会直接修改企业分数。');
  }catch(e){setError(message(e))}
  finally{setBusy(false)}
 }
 return <Shell user={user}><main className="im-page">
  <Link to="/admin/employer-appeals" className="im-back"><ArrowLeft size={15}/> 返回独立申诉审核</Link>
  <div className="im-heading"><p>HHBA · 内部审核 / 企业改善核验</p><h1>改善事实独立核验</h1><p>审核者不能是资料提交人、原始证据核验人，也不能参与被审企业。只有再次核对事实和隐私风险后，才能批准公开。</p></div>
  {!enabled&&<div role="status" className="im-safety"><LockKeyhole size={21}/><div><strong>真实改善审核暂未开放</strong><p>当前预览不允许发布、撤销或伪造企业成长记录。审核权限须由可信服务器独立核实。</p></div></div>}
  {error&&<p role="alert" className="im-error">{error}</p>}{notice&&<p role="status" className="im-success">{notice}</p>}
  <div className="im-grid"><section className="im-card"><h2><ClipboardCheck size={20}/> 待审核改善事项</h2>
   {items.length===0?<Empty>目前没有待处理的真实改善申请。</Empty>:
    <div className="im-list">{items.map(x=><button type="button" className={'im-queue '+(item===x.id?'selected':'')} onClick={()=>{setItem(x.id);setSummary('');setPrivacy(false)}} key={x.id}><strong>{x.title}</strong><small>{labels[x.category]} · {statuses[x.status]} · {x.id.slice(0,8)}</small></button>)}</div>}
  </section>
  <form className="im-card im-form" onSubmit={review}><h2><ShieldCheck size={20}/> 审核与公开决策</h2>
   <label>选择真实待审事项<select disabled={!enabled||busy} value={item} onChange={e=>{setItem(e.target.value);setSummary('');setPrivacy(false)}}><option value="">选择待审核事项</option>{items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
   <label>审核处理<select disabled={!enabled||busy} value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="needs_more_info">要求补充资料</option><option value="rejected">审核不通过</option><option value="approved">真实改善核验通过并批准公开</option></select></label>
   <label>独立审核依据<textarea rows={4} minLength={25} maxLength={1200} disabled={!enabled||busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="记录核查事实、依据和审核理由，不要包含员工敏感资料。"/></label>
   <label>拟公开的事实摘要<textarea rows={4} minLength={40} maxLength={240} disabled={!enabled||busy||decision!=='approved'} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="仅陈述有证据支持的改善事实；不得宣称评分上涨、订单增长或平台背书。"/></label>
   <label className="im-check"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)} disabled={!enabled||busy||decision!=='approved'}/>我已完成独立证据复核和公开隐私检查，确认不包含任何可识别员工的信息。</label>
   <button type="submit" disabled={!enabled||busy||!item}>{enabled?'提交独立审核决定':'待安全审核系统接入'}</button>
   <p className="im-hint">已经公开的记录若被发现失实，须在受控管理员接口执行撤销并留痕，不能直接编辑原记录。</p>
  </form></div>
 </main></Shell>;
}
