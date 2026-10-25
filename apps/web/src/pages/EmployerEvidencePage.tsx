import {useEffect, useState, type FormEvent} from 'react';
import {ArrowLeft, Building2, FileCheck2, FileClock, FilePlus2, FileSearch, LockKeyhole, ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link, navigate} from '../router';
import {
  api, ApiError, employerApiReady, evidenceApiReady,
  type EmployerEvidence, type EmployerEvidenceCategory, type Organization, type User
} from '../services/api';
import '../styles/employer-evidence.css';

const categories:{id:EmployerEvidenceCategory; label:string; description:string}[]=[
  {id:'pay_and_contracts', label:'劳动合同与工资支付',description:'劳动合同制度、工资支付及异常处理规范'},
  {id:'social_insurance',label:'社会保障',description:'依法参保、福利制度及相关保障说明'},
  {id:'working_hours',label:'工时与休假',description:'工时规则、排班与休息休假管理'},
  {id:'employee_development',label:'员工培训与成长',description:'培训制度、晋升政策、员工发展计划'},
  {id:'recruitment_integrity',label:'招聘信息诚信',description:'招聘公告、岗位真实性与招聘流程'},
  {id:'business_integrity',label:'经营与履约诚信',description:'经营资质、履约及争议处理规范'}
];
const stateLabels:Record<string,string>={
  pending_review:'待审核',verified:'已核验',needs_more_info:'需补充材料',
  rejected:'未通过',expired:'已失效',disputed:'存在争议'
};
function nameFor(id:string){return categories.find(item=>item.id===id)?.label||'企业材料'}
function errorFor(error:unknown){return error instanceof ApiError?error.message:'企业证据服务暂时不可用，请稍后重试。';}

export function EmployerEvidencePage({user}:{user:User|null}){
  const [organizations,setOrganizations]=useState<Organization[]>([]);
  const [oid,setOid]=useState('');
  const [items,setItems]=useState<EmployerEvidence[]>([]);
  const [category,setCategory]=useState<EmployerEvidenceCategory>('pay_and_contracts');
  const [statement,setStatement]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(evidenceApiReady);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!evidenceApiReady||!user){setLoading(false);return;}
    let live=true;
    api.organizations().then(r=>{if(!live)return;setOrganizations(r.organizations);setOid(r.organizations[0]?.id||'');})
      .catch(e=>{if(live)setError(errorFor(e))})
      .finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
  },[user]);
  useEffect(()=>{
    if(!oid||!evidenceApiReady){setItems([]);return;}
    let live=true;
    api.employerEvidence(oid).then(r=>{if(live)setItems(r.items)})
      .catch(e=>{if(live)setError(errorFor(e))});
    return()=>{live=false};
  },[oid]);
  if(employerApiReady&&!user){navigate('/recruiter/login?next=%2Femployer%2Fevidence');return null;}
  const org=organizations.find(o=>o.id===oid);
  const allowed=evidenceApiReady&&!!user&&org?.status==='approved';
  async function submit(e:FormEvent){
    e.preventDefault();
    if(!allowed){setError('请先完成企业认证并连接可信的证据审核服务。');return;}
    if(!file||file.size<1||file.size>10*1024*1024){setError('请选择不超过 10MB 的 PDF、JPG 或 PNG 文件。');return;}
    if(statement.trim().length<12||statement.trim().length>1200){setError('材料说明需要 12—1200 字。');return;}
    setBusy(true);setError('');setNotice('');
    try{
      await api.submitEmployerEvidence(oid,category,statement.trim(),file);
      setItems((await api.employerEvidence(oid)).items);
      setStatement('');setFile(null);
      setNotice('材料已提交审核。文件不会公开，核验通过前不会改变企业评分。');
    }catch(err){setError(errorFor(err))}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ee-page">
    <div className="ee-page-top"><Link to="/employer/growth"><ArrowLeft size={16}/> 返回企业成长档案</Link><p>HHBA · 企业证据与核验</p><h1>企业证明材料</h1><p>只提交与企业经营、劳动保障相关的可信材料。HHBA 审核后记录核验结论；未经核验的内容不计入评分。</p></div>
    {!evidenceApiReady&&<div className="ee-alert" role="status"><LockKeyhole size={20}/><div><strong>安全上传尚未开放</strong><p>当前预览未接入独立的认证企业 API、私有文件存储与审核后台。为保护真实员工和企业信息，本页面不接受文件上传，也不会生成虚构核验结果。</p></div></div>}
    {evidenceApiReady&&<div className="ee-org"><Building2 size={18}/><label>当前企业 <select aria-label="当前企业" value={oid} onChange={e=>setOid(e.target.value)} disabled={loading}><option value="">请选择企业</option>{organizations.map(o=><option value={o.id} key={o.id}>{o.legal_name}</option>)}</select></label><span>{!org?'未选择企业':org.status==='approved'?'认证通过':'待企业认证'}</span></div>}
    {error&&<p className="ee-error" role="alert">{error}</p>}
    {notice&&<p className="ee-success" role="status">{notice}</p>}
    <div className="ee-layout">
      <section className="ee-panel">
        <div className="ee-panel-heading"><FilePlus2 size={20}/><div><h2>提交待核验证据</h2><p>审核前仅上传企业真实材料，不能直接增加评分。</p></div></div>
        <form onSubmit={submit} className="ee-form">
          <label>材料类别<select value={category} onChange={e=>setCategory(e.target.value as EmployerEvidenceCategory)} disabled={!allowed||busy}>{categories.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
          <p className="ee-hint">{categories.find(c=>c.id===category)?.description}</p>
          <label>材料说明<textarea value={statement} onChange={e=>setStatement(e.target.value)} rows={4} maxLength={1200} minLength={12} placeholder="概述文件证明的制度和已落实的措施；不要填写员工姓名、身份证号码或工资明细。" disabled={!allowed||busy}/></label>
          <label>证明材料（PDF、JPG、PNG；不超过 10MB）<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={!allowed||busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
          <p className="ee-hint">请尽量提供脱敏后的制度与证明。不要上传员工个人工资表、身份证、病历或其他不必要的敏感信息。</p>
          <button type="submit" disabled={!allowed||busy}>{busy?'正在提交审核…':allowed?'提交材料审核':'待安全审核服务接入'}</button>
        </form>
      </section>
      <section className="ee-panel">
        <div className="ee-panel-heading"><FileClock size={20}/><div><h2>已提交材料</h2><p>只列出当前已授权企业的核验记录。</p></div></div>
        {items.length ? <div className="ee-items">{items.map(item=><article key={item.id} className="ee-item"><div><strong>{nameFor(item.category)}</strong><span>{stateLabels[item.status]||item.status}</span></div><p>{item.statement}</p><small>{new Date(item.created_at).toLocaleDateString('zh-CN')} · {Math.ceil(item.file_size_bytes/1024)} KB · 私有文件</small></article>)}</div>
        : <div className="ee-empty"><FileSearch size={24}/><strong>暂无可展示的核验材料</strong><p>{evidenceApiReady?'企业提交后会在这里展示真实审核状态。':'安全服务尚未启用，不显示演示材料或虚假已核验记录。'}</p></div>}
        <p className="ee-hint"><ShieldCheck size={15}/> 真实材料文件仅限授权企业成员和独立审核人员查看；求职者只看到允许公开的核验结论。</p>
      </section>
    </div>
  </main></Shell>;
}

export function AdminEmployerEvidencePage({user}:{user:User|null}){
  const [items,setItems]=useState<EmployerEvidence[]>([]);
  const [selected,setSelected]=useState('');
  const [decision,setDecision]=useState<'verified'|'needs_more_info'|'rejected'>('needs_more_info');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!evidenceApiReady||user?.role!=='admin')return;
    let live=true;
    api.adminPendingEmployerEvidence().then(r=>{if(live)setItems(r.items)})
      .catch(e=>{if(live)setError(errorFor(e))});
    return()=>{live=false};
  },[user]);
  if(employerApiReady&&!user){navigate('/recruiter/login?next=%2Fadmin%2Femployer-evidence');return null;}
  const enabled=evidenceApiReady&&user?.role==='admin';
  async function review(e:FormEvent){
    e.preventDefault();if(!enabled||!selected)return;
    if(reason.trim().length<12){setError('审核理由至少 12 字，必须说明核验证据。');return;}
    setBusy(true);setError('');setNotice('');
    try{
      await api.adminReviewEvidence(selected,decision,reason.trim());
      setItems((await api.adminPendingEmployerEvidence()).items);
      setSelected('');setReason('');
      setNotice('核验结果已写入不可直接修改的审核流水。');
    }catch(err){setError(errorFor(err))}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ee-page">
    <div className="ee-page-top"><Link to="/admin/employer-review"><ArrowLeft size={16}/> 返回企业管理审核</Link><p>HHBA · 审核管理</p><h1>企业证据核验队列</h1><p>独立审核人员对真实证明材料进行核验，审核人与提交人不得为同一人；全部变更需保留不可篡改的操作记录。</p></div>
    {!enabled&&<div className="ee-alert"><LockKeyhole size={20}/><div><strong>独立审核服务未开放</strong><p>需接入可信管理员会话、审核角色和企业材料数据库；当前不会提供模拟审核通过操作。</p></div></div>}
    {error&&<p className="ee-error" role="alert">{error}</p>}{notice&&<p className="ee-success" role="status">{notice}</p>}
    <div className="ee-layout"><section className="ee-panel"><div className="ee-panel-heading"><FileClock size={19}/><div><h2>等待核验</h2><p>仅来自可信业务数据库的材料</p></div></div>
      {items.length?items.map(item=><button key={item.id} className={'ee-queue-item '+(selected===item.id?'active':'')} type="button" onClick={()=>setSelected(item.id)}><span>{nameFor(item.category)}</span><small>{item.status} · {item.organization_id}</small></button>):<div className="ee-empty"><FileCheck2 size={23}/><p>尚无真实待审核数据</p></div>}
    </section><section className="ee-panel"><div className="ee-panel-heading"><ShieldCheck size={19}/><div><h2>审核结论</h2><p>核实文件内容与来源后提交，禁止无理由直接加分。</p></div></div>
    <form className="ee-form" onSubmit={review}>
      <label>选择审核项<select value={selected} disabled={!enabled||busy} onChange={e=>setSelected(e.target.value)}><option value="">请选择材料</option>{items.map(item=><option value={item.id} key={item.id}>{nameFor(item.category)} · {item.id.slice(0,8)}</option>)}</select></label>
      <label>审核决定<select value={decision} disabled={!enabled||busy} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="needs_more_info">要求补充证明</option><option value="verified">核验通过</option><option value="rejected">核验未通过</option></select></label>
      <label>核验理由<textarea rows={5} minLength={12} maxLength={1200} disabled={!enabled||busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明核验方法、证据依据以及需要补充的内容。"/></label>
      <button type="submit" disabled={!enabled||!selected||busy}>{enabled?'记录审核结论':'待审核服务接入'}</button>
      <p className="ee-hint">这一步只改变材料核验状态，不直接授予信誉值或员工善待值。独立评分将由后续的评分引擎完成。</p>
    </form></section></div>
  </main></Shell>;
}
