import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Building2,CheckCircle2,ClipboardCheck,FileWarning,HeartHandshake,LockKeyhole,Scale,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {api, appealsApiReady, employerApiReady, type HHBAAppeal, type Organization, type User} from '../services/api';
import '../styles/employer-appeals.css';

const appealIssues=[
  {id:'evidence_error',title:'证据核验结论有误'},
  {id:'score_method',title:'评分规则应用有误'},
  {id:'missing_proof',title:'需要补充被遗漏的证明'},
  {id:'outdated_fact',title:'相关事实已发生改变'}
];
const employeeIssues=[
  {id:'identity_risk',title:'担心员工身份或反馈被识别'},
  {id:'retaliation_risk',title:'担心因反馈而遭遇报复'},
  {id:'eligibility_error',title:'在职资格核验存在问题'},
  {id:'consent_problem',title:'反馈告知与授权存在问题'}
];
const statuses:Record<string,string>={
  submitted:'已提交',under_review:'复核中',needs_more_info:'等待补充说明',
  correction_required:'复核认为需要纠正',rejected:'复核未支持',resolved_after_correction:'已按程序纠正'
};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const explain=(err:unknown)=>err instanceof Error?err.message:'服务暂不可用。';
function Cases({items,confidential=false}:{items:HHBAAppeal[];confidential?:boolean}) {
  return <div className="ea-cases">{items.length===0?<div className="ea-empty"><ClipboardCheck size={22}/><p>暂无可展示的真实记录</p></div>:items.map(item=>
    <article className="ea-case" key={item.id}><div><strong>{confidential?(employeeIssues.find(x=>x.id===item.issue)?.title||'私密流程异议'):(appealIssues.find(x=>x.id===item.issue)?.title||'企业复核申请')}</strong><span>{statuses[item.status]||item.status}</span></div>
      <small>{new Date(item.created_at).toLocaleDateString('zh-CN')} · 案件编号 {item.id.slice(0,8)}</small>
      {!confidential&&item.explanation&&<p>{item.explanation}</p>}
    </article>)}</div>;
}
export function EmployerAppealsPage({user}:{user:User|null}) {
  const [organizations,setOrganizations]=useState<Organization[]>([]);
  const [org,setOrg]=useState('');
  const [items,setItems]=useState<HHBAAppeal[]>([]);
  const [kind,setKind]=useState<'evidence'|'scoring_run'>('evidence');
  const [target,setTarget]=useState('');
  const [issue,setIssue]=useState('evidence_error');
  const [text,setText]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const enabled=appealsApiReady&&!!user&&organizations.some(o=>o.id===org&&o.status==='approved');
  useEffect(()=>{
    if(!appealsApiReady||!user)return;
    let active=true;
    api.organizations().then(r=>{if(!active)return;setOrganizations(r.organizations);setOrg(r.organizations[0]?.id||'');})
      .catch(err=>{if(active)setError(explain(err))});
    return()=>{active=false};
  },[user]);
  useEffect(()=>{
    if(!appealsApiReady||!org){setItems([]);return;}
    let active=true;api.employerAppeals(org).then(r=>{if(active)setItems(r.items)}).catch(err=>{if(active)setError(explain(err))});
    return()=>{active=false};
  },[org]);
  if(employerApiReady&&!user){navigate('/recruiter/login?next=%2Femployer%2Fappeals');return null;}
  async function submit(e:FormEvent) {
    e.preventDefault();if(!enabled)return;
    if(!uuid.test(target)){setError('请填写真实材料或内部评分快照的有效编号。');return;}
    if(text.trim().length<30){setError('请至少用 30 个字说明申诉事实及依据。');return;}
    setBusy(true);setError('');setNotice('');
    try{
      await api.submitEmployerAppeal(org,kind,target,issue,text.trim());
      setItems((await api.employerAppeals(org)).items);
      setTarget('');setText('');
      setNotice('已提交复核。提交申请不会自动改变评分；需要由独立人员审查。');
    }catch(err){setError(explain(err))}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ea-page">
    <Link to="/employer/growth" className="ea-back"><ArrowLeft size={15}/> 返回企业成长档案</Link>
    <div className="ea-heading"><p>HHBA · 企业成长与申诉</p><h1>评分异议与复核</h1><p>企业有权要求更正事实、补充证据并追踪处理进度。评分申诉不影响正常招聘，也不代表申诉一经提交就自动获得更高评分。</p></div>
    {!appealsApiReady&&<div className="ea-warning"><LockKeyhole size={22}/><div><strong>申诉业务服务尚未接通</strong><p>静态预览不保存申诉信息、不能生成虚构案件。请不要在未认证的环境上传员工个人资料或企业机密。</p></div></div>}
    {appealsApiReady&&<div className="ea-org"><Building2 size={18}/><label>当前企业 <select value={org} aria-label="当前企业" onChange={e=>setOrg(e.target.value)}><option value="">请选择企业</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.legal_name}</option>)}</select></label></div>}
    {error&&<p className="ea-error" role="alert">{error}</p>}{notice&&<p className="ea-ok" role="status">{notice}</p>}
    <div className="ea-grid"><form className="ea-card ea-form" onSubmit={submit}>
      <h2><Scale size={20}/> 提交企业复核申请</h2>
      <label>争议对象<select value={kind} disabled={!enabled||busy} onChange={e=>setKind(e.target.value as typeof kind)}><option value="evidence">已核验的证明材料</option><option value="scoring_run">内部评分快照</option></select></label>
      <label>材料或评分快照编号<input value={target} onChange={e=>setTarget(e.target.value)} disabled={!enabled||busy} placeholder="请填写已有记录中的 UUID"/></label>
      <label>申诉原因<select value={issue} disabled={!enabled||busy} onChange={e=>setIssue(e.target.value)}>{appealIssues.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label>事实与核验依据<textarea rows={5} maxLength={1200} minLength={30} disabled={!enabled||busy} value={text} onChange={e=>setText(e.target.value)} placeholder="请说明具体争议事实及材料来源，不要填写任何员工的个人敏感信息。"/></label>
      <p className="ea-note">材料补交仍走企业证明核验系统；该文本不能代替正式安全文件审核。</p>
      <button type="submit" disabled={!enabled||busy}>{enabled?'提交独立复核':'待安全申诉服务接入'}</button>
    </form>
    <section className="ea-card"><h2><ClipboardCheck size={20}/> 本企业申诉记录</h2><p className="ea-note">只显示当前授权企业的案件，不包含员工的私密举报或身份信息。</p><Cases items={items}/></section></div>
    <div className="ea-principle"><ShieldCheck size={20}/><div><strong>审核回避与纠错原则</strong><p>被申诉的审核人不能处理本人作出的结论。复核认可问题后进入「需要纠正」状态；后续须核实新的材料、重新计算并另行审批，不能无痕改写旧评分。</p></div></div>
  </main></Shell>;
}

export function EmployeePrivacyConcernsPage({user}:{user:User|null}){
  const orgId=new URLSearchParams(window.location.search).get('org')||'';
  const [issue,setIssue]=useState('identity_risk');
  const [consent,setConsent]=useState(false);
  const [items,setItems]=useState<HHBAAppeal[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const enabled=appealsApiReady&&!!user&&uuid.test(orgId);
  useEffect(()=>{
    if(!appealsApiReady||!user)return;
    let active=true;api.employeePrivacyConcerns().then(r=>{if(active)setItems(r.items)})
      .catch(err=>{if(active)setError(explain(err))});
    return()=>{active=false};
  },[user]);
  if(employerApiReady&&appealsApiReady&&!user){navigate('/candidate/login?next=%2Femployee%2Fprivacy-concerns');return null;}
  async function submit(e:FormEvent){
    e.preventDefault();if(!enabled||!consent)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api.submitEmployeePrivacyConcern(orgId,issue);
      setItems((await api.employeePrivacyConcerns()).items);
      setConsent(false);
      setNotice('你的私密流程异议已登记。企业无法查看该案件或你的账户身份。');
    }catch(err){setError(explain(err))}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ea-page">
    <Link className="ea-back" to="/employee/feedback"><ArrowLeft size={15}/> 返回员工反馈</Link>
    <div className="ea-heading"><p>HHBA · 员工信息保护</p><h1>员工隐私与反馈流程异议</h1><p>关乎员工的真实体验，更关乎员工的安全。这里提供结构化、受限的申诉路径，不向企业展示投诉内容、投诉者身份或小样本统计。</p></div>
    <div className="ea-warning"><LockKeyhole size={22}/><div><strong>保护反馈者身份</strong><p>员工身份记录与案件分开保存；企业没有查看权。由于管理员权限、访问日志等风险，系统不能承诺绝对匿名。发生现实中的威胁时，也应保留其他安全、合法的求助途径。</p></div></div>
    {!appealsApiReady&&<div className="ea-warning" role="status"><ShieldCheck size={19}/><div><strong>真实员工隐私申诉尚未开放</strong><p>当前静态页面不会收集信息或生成案件，必须先接入经核实的员工账户与在职关系验证服务。</p></div></div>}
    {error&&<p className="ea-error" role="alert">{error}</p>}{notice&&<p className="ea-ok" role="status">{notice}</p>}
    <div className="ea-grid"><form className="ea-card ea-form" onSubmit={submit}>
      <h2><HeartHandshake size={20}/> 选择遇到的问题</h2>
      <p className="ea-note">为了减少意外泄露身份，第一版仅收集固定的问题类别，不允许填写姓名、岗位、部门、时间和自由文本。</p>
      <fieldset className="ea-choices" disabled={!enabled||busy}><legend>反馈安全与隐私问题</legend>{employeeIssues.map(x=><label key={x.id}><input type="radio" name="issue" value={x.id} checked={issue===x.id} onChange={()=>setIssue(x.id)}/>{x.title}</label>)}</fieldset>
      <label className="ea-consent"><input type="checkbox" disabled={!enabled||busy} checked={consent} onChange={e=>setConsent(e.target.checked)}/>我已阅读隐私保护说明，确认自愿登记该类问题。</label>
      <button type="submit" disabled={!enabled||!consent||busy}>{enabled?'提交私密流程异议':'待可信员工验证接入'}</button>
    </form>
    <section className="ea-card"><h2><ClipboardCheck size={20}/> 我的私密案件状态</h2><p className="ea-note">需要登录本人账户查看；不会在企业后台出现。</p><Cases items={items} confidential/></section></div>
  </main></Shell>;
}

export function AdminAppealsReviewPage({user}:{user:User|null}){
  const enabled=appealsApiReady&&user?.role==='admin';
  const [items,setItems]=useState<HHBAAppeal[]>([]);
  const [selected,setSelected]=useState('');
  const [decision,setDecision]=useState<'needs_more_info'|'rejected'|'correction_required'>('needs_more_info');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!enabled)return;
    let active=true;api.adminAppealsQueue().then(r=>{if(active)setItems(r.items)})
      .catch(err=>{if(active)setError(explain(err))});
    return()=>{active=false};
  },[enabled]);
  async function submit(e:FormEvent){
    e.preventDefault();if(!enabled||!selected)return;
    if(reason.trim().length<25){setError('复核依据至少需要 25 字。');return;}
    setBusy(true);setError('');setNotice('');
    try{
      await api.adminAppealsDecision(selected,decision,reason.trim());
      setItems((await api.adminAppealsQueue()).items);
      setSelected('');setReason('');
      setNotice('复核决定已写入不可修改的案件事件流水；未直接变更或公开评分。');
    }catch(err){setError(explain(err))}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ea-page">
    <Link to="/admin/employer-scoring" className="ea-back"><ArrowLeft size={15}/> 返回评分审核</Link>
    <div className="ea-heading"><p>HHBA · 独立申诉复核</p><h1>申诉处理工作台</h1><p>企业提出材料或评分复核，员工提出反馈隐私问题；两类案件分权限管理，禁止利益冲突及无痕修改历史。</p></div>
    {!enabled&&<div className="ea-warning" role="status"><LockKeyhole size={21}/><div><strong>独立申诉审核暂未接入</strong><p>真实管理员权限及保密数据库未验证之前，页面不会允许模拟审批通过或调整企业评分。</p></div></div>}
    {error&&<p className="ea-error" role="alert">{error}</p>}{notice&&<p className="ea-ok" role="status">{notice}</p>}
    <div className="ea-grid"><section className="ea-card">
      <h2><FileWarning size={20}/> 待处理申诉</h2>{items.length?items.map(x=><button className={'ea-queue '+(selected===x.id?'active':'')} key={x.id} type="button" onClick={()=>setSelected(x.id)}><strong>{x.kind==='employee_privacy'?'员工隐私流程问题':'企业评分/材料复核'}</strong><small>{statuses[x.status]} · {x.id.slice(0,8)}</small></button>):<div className="ea-empty"><ClipboardCheck size={22}/><p>暂无真实待处理案件</p></div>}
    </section>
    <form className="ea-card ea-form" onSubmit={submit}><h2><Scale size={20}/> 独立复核决定</h2>
      <label>选择案件<select disabled={!enabled||busy} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">请选择真实待办案件</option>{items.map(x=><option key={x.id} value={x.id}>{x.kind==='employee_privacy'?'隐私':'企业'} · {x.id.slice(0,8)}</option>)}</select></label>
      <label>处理结果<select disabled={!enabled||busy} value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="needs_more_info">要求补充核验材料</option><option value="correction_required">复核认可，转入纠正流程</option><option value="rejected">不支持申诉，说明依据</option></select></label>
      <label>复核依据<textarea rows={5} minLength={25} maxLength={1200} disabled={!enabled||busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="仅记录复核依据；不要摘录员工个人身份及受保护反馈明细。"/></label>
      <p className="ea-note">审核员不能参与本人曾经审核的案件，不能审理自己提交的申诉或与自己关联的企业。</p>
      <button disabled={!enabled||busy||!selected} type="submit">{enabled?'提交独立复核决定':'待安全审核服务接入'}</button>
    </form></div>
    <div className="ea-principle"><ShieldCheck size={20}/><p>「复核认可」不等于「直接修改企业分数」。必须经过纠正记录、独立证据核验、重新评分和后续公示审批。员工案件不向企业展示。</p></div>
  </main></Shell>;
}
