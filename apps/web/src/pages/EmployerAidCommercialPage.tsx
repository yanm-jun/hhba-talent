import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BadgeCheck,Building2,ClipboardCheck,FileCheck2,Handshake,HeartHandshake,LockKeyhole,ShieldCheck,Users} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,aidCommercialApiReady,type EmployerEvidence,type HHBAAidApplication,type HHBAIntroduction,type Organization,type User} from '../services/api';
import '../styles/employer-aid-commercial.css';

const serviceNames:Record<string,string>={client_introduction:'客户与订单机会引荐',supply_chain:'上下游供应链合作',visibility:'企业正向品牌曝光'};
const stages:Record<string,string>={identified:'待确认线索',consent_verified:'客户同意已核验',introduced:'已正式引荐',in_discussion:'合作洽谈中',not_pursued:'不再继续',closed:'对接已结束'};
const statuses:Record<string,string>={submitted:'已提交 · 等待审核',needs_info:'待补充材料',approved:'审批通过 · 资格持续核验',declined:'审核未通过',suspended:'资格暂不满足',closed:'申请已结束'};
const sectors:Record<string,string>={manufacturing:'制造业',retail:'零售',services:'服务业',technology:'技术服务',logistics:'物流运输',other:'其他行业'};
const opportunities:Record<string,string>={sales:'业务销售',distribution:'渠道合作',procurement:'采购合作',partnership:'战略合作'};
const errorText=(e:unknown)=>e instanceof Error?e.message:'操作失败，请检查服务状态';
const idPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function Notice({children}:{children:string}){return <div className="ac-notice"><ShieldCheck size={21}/><p>{children}</p></div>}
function Empty({text}:{text:string}){return <div className="ac-empty"><ClipboardCheck size={24}/><p>{text}</p></div>}

export function EmployerAidApplicationPage({user}:{user:User|null}){
 const [organizations,setOrganizations]=useState<Organization[]>([]),[org,setOrg]=useState('');
 const [proofs,setProofs]=useState<EmployerEvidence[]>([]),[apps,setApps]=useState<HHBAAidApplication[]>([]);
 const [service,setService]=useState('client_introduction'),[business,setBusiness]=useState(''),[capacity,setCapacity]=useState(''),[evidence,setEvidence]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const enabled=aidCommercialApiReady&&!!user&&organizations.some(x=>x.id===org&&x.status==='approved');
 useEffect(()=>{if(!aidCommercialApiReady||!user)return;let live=true;
  api.organizations().then(r=>{if(live){setOrganizations(r.organizations);setOrg(r.organizations.find(x=>x.status==='approved')?.id||'')}})
   .catch(e=>{if(live)setError(errorText(e))});return()=>{live=false}
 },[user]);
 useEffect(()=>{if(!aidCommercialApiReady||!org){setProofs([]);setApps([]);return}
  let live=true;Promise.all([api.employerEvidence(org),api.employerAidApplications(org)])
   .then(([a,b])=>{if(live){setProofs(a.items);setApps(b.items)}})
   .catch(e=>{if(live)setError(errorText(e))});return()=>{live=false}
 },[org]);
 async function submit(e:FormEvent){e.preventDefault();if(!enabled||!idPattern.test(evidence))return;
  setBusy(true);setError('');setSuccess('');
  try{await api.submitAidApplication(org,{service_type:service,business_summary:business.trim(),
   capacity_summary:capacity.trim(),capacity_evidence_id:evidence});
   setApps((await api.employerAidApplications(org)).items);
   setBusiness('');setCapacity('');setEvidence('');
   setSuccess('真实申请已提交审核。尚未批准，也没有为企业生成任何客户或订单。');
  }catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 const eligible=proofs.filter(x=>x.category==='business_integrity'&&x.status==='verified'&&x.security_status==='clean');
 return <Shell user={user}><main className="ac-page">
   <Link to="/employer/aid" className="ac-back"><ArrowLeft size={15}/> 返回 HHBA 企业发展帮扶</Link>
   <div className="ac-heading"><p>HHBA · 企业发展帮扶 / 模块 11</p><h1>让真正善待员工的企业，获得更多机会。</h1><p>企业可以提出帮扶申请，由平台独立核验公开信誉、员工关怀与实际业务交付能力。申请成功不等于审批通过；审批通过也不保证获得订单。</p></div>
   <Notice>公开评分和员工善待是资格依据之一，仍必须经过经营交付材料及人工审批。当前不开放付费买分、买推荐资格或自动通过。</Notice>
   {!aidCommercialApiReady&&<div className="ac-gate" role="status"><LockKeyhole size={22}/><div><strong>真实企业帮扶申请尚未开放</strong><p>当前为功能预览；尚未接入可信企业账户、正式帮扶资格政策和安全审批服务。请不要上传合同、员工工资或商业秘密。</p></div></div>}
   {aidCommercialApiReady&&<div className="ac-org"><Building2 size={19}/><label>当前企业 <select value={org} onChange={e=>setOrg(e.target.value)}><option value="">请选择企业</option>{organizations.map(x=><option key={x.id} value={x.id}>{x.legal_name}</option>)}</select></label></div>}
   {error&&<p className="ac-error" role="alert">{error}</p>}{success&&<p className="ac-success" role="status">{success}</p>}
   <div className="ac-grid">
    <form className="ac-card ac-form" onSubmit={submit}><h2><FileCheck2 size={20}/> 提交企业帮扶申请</h2>
      <label>希望获得的支持<select value={service} onChange={e=>setService(e.target.value)} disabled={!enabled||busy}>
       {Object.entries(serviceNames).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
      <label>主营产品或服务<textarea rows={4} value={business} disabled={!enabled||busy} onChange={e=>setBusiness(e.target.value)} minLength={40} maxLength={1000} placeholder="如实描述主营业务、服务对象及核心产品，勿填写企业机密。"/></label>
      <label>已具备的供货或交付能力<textarea rows={4} value={capacity} disabled={!enabled||busy} onChange={e=>setCapacity(e.target.value)} minLength={40} maxLength={1000} placeholder="描述已有团队、产能、质量要求及履约能力；不承诺未经核实的交付。"/></label>
      <label>已核验的经营履约证明<select disabled={!enabled||busy} value={evidence} onChange={e=>setEvidence(e.target.value)}>
       <option value="">选择本企业已核实证明文件</option>{eligible.map(x=><option key={x.id} value={x.id}>经营履约 · {x.id.slice(0,8)}</option>)}</select></label>
      <button disabled={!enabled||busy||business.trim().length<40||capacity.trim().length<40||!evidence}>
       {enabled?'提交真实申请':'待可信帮扶服务接入'}</button>
    </form>
    <section className="ac-card"><h2><ClipboardCheck size={20}/> 本企业申请进度</h2><p className="ac-muted">仅展示已由当前企业提交的申请，不会显示其他企业的商业数据。</p>
     {apps.length===0?<Empty text="暂时没有真实帮扶申请。"/>:<div className="ac-list">{apps.map(x=><article key={x.id}><div><strong>{serviceNames[x.service_type]}</strong><span>{statuses[x.status]}</span></div><p>提交日期：{x.created_at.slice(0,10)}</p><small>记录编号：{x.id.slice(0,8)}</small></article>)}</div>}
     <Link className="ac-next" to={'/employer/commercial'+(org?'?org='+encodeURIComponent(org):'')}>查看客户对接记录 <ArrowRight size={15}/></Link>
    </section>
   </div>
 </main></Shell>;
}

export function EmployerCommercialPage({user}:{user:User|null}){
 const [organizations,setOrganizations]=useState<Organization[]>([]),[selected,setSelected]=useState('');
 const [items,setItems]=useState<HHBAIntroduction[]>([]),[error,setError]=useState('');
 useEffect(()=>{if(!aidCommercialApiReady||!user)return;let live=true;
  api.organizations().then(r=>{if(live){setOrganizations(r.organizations);const fromUrl=new URLSearchParams(window.location.search).get('org')||'';
   setSelected(r.organizations.some(x=>x.id===fromUrl)?fromUrl:r.organizations[0]?.id||'')}})
   .catch(e=>{if(live)setError(errorText(e))});return()=>{live=false};
 },[user]);
 useEffect(()=>{if(!aidCommercialApiReady||!selected){setItems([]);return}
  let live=true;api.employerClientIntroductions(selected).then(r=>{if(live)setItems(r.items)})
   .catch(e=>{if(live)setError(errorText(e))});return()=>{live=false};
 },[selected]);
 return <Shell user={user}><main className="ac-page">
   <Link to="/employer/aid/apply" className="ac-back"><ArrowLeft size={15}/> 返回帮扶申请</Link>
   <div className="ac-heading"><p>HHBA · 商业协作跟进 / 模块 12</p><h1>客户引荐与真实商业合作记录</h1><p>把每一次被允许的介绍、双方合作意向与洽谈进展记录清楚。只有独立审核真实订单凭证后，才可显示已核实订单。</p></div>
   <Notice>这不是一个独立交易商城，也不收集或公开客户联系人名单。买方信息采用受限内部编号；引荐、谈判和实际成交有严格区分。</Notice>
   {!aidCommercialApiReady&&<div className="ac-gate" role="status"><LockKeyhole size={22}/><div><strong>真实客户引荐后台尚未开放</strong><p>当前没有真实客户线索或订单。平台需要完成客户知情同意、企业帮扶资格和独立核实后才能进行商业对接。</p></div></div>}
   {aidCommercialApiReady&&<div className="ac-org"><Building2 size={18}/><label>当前企业 <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">选择企业</option>{organizations.map(x=><option key={x.id} value={x.id}>{x.legal_name}</option>)}</select></label></div>}
   {error&&<p className="ac-error" role="alert">{error}</p>}
   <div className="ac-card"><h2><Handshake size={20}/> 对接与订单核验状态</h2>
    {items.length===0?<Empty text="目前没有已经核实的客户引荐记录。"/>:
    <div className="ac-list">{items.map(x=><article key={x.id}>
     <div><strong>{sectors[x.buyer_sector]||'潜在客户'} · {opportunities[x.opportunity_type]||'合作机会'}</strong><span>{stages[x.stage]}</span></div>
     <p>{x.purpose}</p><small>对接编号：{x.buyer_reference} · {x.created_at.slice(0,10)}</small>
     <p className={x.order_status==='independently_verified'?'ac-proof':'ac-pending'}>
       {x.order_status==='independently_verified'?'已独立核验真实订单凭证':'尚无独立核验的真实成交证明'}
     </p>
    </article>)}</div>}
   </div>
 </main></Shell>;
}

export function AdminAidCommercialPage({user}:{user:User|null}){
 const enabled=aidCommercialApiReady&&user?.role==='admin';
 const [queue,setQueue]=useState<HHBAAidApplication[]>([]);
 const [application,setApplication]=useState(''),[decision,setDecision]=useState<'approved'|'needs_info'|'declined'>('needs_info'),[reason,setReason]=useState('');
 const [leadApp,setLeadApp]=useState(''),[leadOrg,setLeadOrg]=useState(''),[buyer,setBuyer]=useState(''),[sector,setSector]=useState('manufacturing'),[kind,setKind]=useState('sales'),[purpose,setPurpose]=useState('');
 const [leadId,setLeadId]=useState(''),[stage,setStage]=useState('introduced'),[ref,setRef]=useState('');
 const [proofId,setProofId]=useState(''),[proofDecision,setProofDecision]=useState('pending'),[proofReason,setProofReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!enabled)return;let live=true;api.adminAidQueue().then(r=>{if(live)setQueue(r.items)})
  .catch(e=>{if(live)setError(errorText(e))});return()=>{live=false}},[enabled]);
 const execute=async(fn:()=>Promise<unknown>,text:string)=>{
  if(!enabled)return;setBusy(true);setError('');setNotice('');
  try{await fn();setNotice(text);setQueue((await api.adminAidQueue()).items)}
  catch(e){setError(errorText(e))}finally{setBusy(false)}
 };
 return <Shell user={user}><main className="ac-page">
  <Link className="ac-back" to="/admin/employer-publication"><ArrowLeft size={15}/> 返回企业评分发布审核</Link>
  <div className="ac-heading"><p>HHBA · 内部审批 / 模块 11–12</p><h1>帮扶审批与客户对接运营台</h1>
   <p>企业帮扶资格、客户同意和订单证明分别由独立权限审核。记录客户接触并不代表平台承诺成交，也不会因为企业高分自动生成订单。</p></div>
  {!enabled&&<div className="ac-gate" role="status"><LockKeyhole size={22}/><div><strong>真实帮扶审批与客户对接暂未开放</strong><p>静态预览中所有审批、客户引荐及订单核验均被禁用，不会产生任何虚构成交数据。</p></div></div>}
  {error&&<p className="ac-error" role="alert">{error}</p>}{notice&&<p className="ac-success" role="status">{notice}</p>}
  <div className="ac-grid">
   <section className="ac-card"><h2><ClipboardCheck size={20}/> 待审核企业帮扶</h2><p className="ac-muted">独立核验公开双评分、经营证明和真实履约能力；平台帮助并不是企业的自动权益。</p>
    {queue.length===0?<Empty text="暂无待处理的真实申请。"/>:<div className="ac-list">{queue.map(x=><button className={'ac-queue '+(application===x.id?'selected':'')} key={x.id} onClick={()=>setApplication(x.id)}><strong>{serviceNames[x.service_type]}</strong><small>{x.organization_id.slice(0,8)} · {statuses[x.status]}</small></button>)}</div>}
   </section>
   <form className="ac-card ac-form" onSubmit={e=>{e.preventDefault();void execute(()=>api.adminAidReview(application,decision,reason.trim()),'帮扶审核意见已记录，不代表客户已成交。')}}>
    <h2><ShieldCheck size={20}/> 申请资格复核</h2>
    <label>申请记录<select disabled={!enabled||busy} value={application} onChange={e=>setApplication(e.target.value)}><option value="">选择真实申请</option>{queue.map(x=><option value={x.id} key={x.id}>{x.id.slice(0,8)} · {serviceNames[x.service_type]}</option>)}</select></label>
    <label>处理结论<select disabled={!enabled||busy} value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}>
     <option value="needs_info">需补充材料</option><option value="declined">未批准</option><option value="approved">独立确认符合帮扶要求</option></select></label>
    <label>审核理由<textarea rows={4} minLength={25} maxLength={1200} disabled={!enabled||busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="证据、员工关怀、政策门槛和交付能力"/></label>
    <button disabled={!enabled||busy||!application||reason.trim().length<25}>{enabled?'保存审核结果':'待独立审核服务接入'}</button>
   </form>
   <form className="ac-card ac-form" onSubmit={e=>{e.preventDefault();void execute(()=>api.adminCreateIntroduction({application_id:leadApp,organization_id:leadOrg,buyer_reference:buyer,buyer_sector:sector,opportunity_type:kind,purpose:purpose.trim()}),'新线索仅被登记为待确认，尚无引荐或订单。')}}>
    <h2><Users size={20}/> 客户机会登记</h2><p className="ac-muted">仅限持有独立匹配角色的工作人员；客户用不包含联系方式的受限内部编号。</p>
    <label>已批准的帮扶申请 UUID<input disabled={!enabled||busy} value={leadApp} onChange={e=>setLeadApp(e.target.value)}/></label>
    <label>企业组织 UUID<input disabled={!enabled||busy} value={leadOrg} onChange={e=>setLeadOrg(e.target.value)}/></label>
    <label>客户内部编号<input disabled={!enabled||busy} value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="8–60 位内部代号，无联系方式"/></label>
    <label>客户行业<select disabled={!enabled||busy} value={sector} onChange={e=>setSector(e.target.value)}>{Object.entries(sectors).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>合作类型<select disabled={!enabled||busy} value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(opportunities).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>业务需求说明<textarea rows={3} minLength={30} maxLength={500} disabled={!enabled||busy} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label>
    <button disabled={!enabled||busy||!idPattern.test(leadApp)||!idPattern.test(leadOrg)||buyer.length<8||purpose.trim().length<30}>{enabled?'登记待确认机会':'待匹配权限接入'}</button>
   </form>
   <form className="ac-card ac-form" onSubmit={e=>{e.preventDefault();
      const fn=stage==='consent_verified'?()=>api.adminVerifyBuyerConsent(leadId,ref):stage==='order_proof'?()=>api.adminSubmitOrderProof(leadId,ref):()=>api.adminAdvanceIntroduction(leadId,stage);
      void execute(fn,'客户对接阶段已记录；没有独立订单证明之前不能宣称成交。')}}>
    <h2><Handshake size={20}/> 客户引荐与阶段跟进</h2>
    <label>对接记录 UUID<input disabled={!enabled||busy} value={leadId} onChange={e=>setLeadId(e.target.value)}/></label>
    <label>操作阶段<select disabled={!enabled||busy} value={stage} onChange={e=>setStage(e.target.value)}>
     <option value="consent_verified">核实买方知情同意（独立角色）</option>
     <option value="introduced">确认已引荐</option><option value="in_discussion">更新：洽谈中</option>
     <option value="not_pursued">终止跟进</option><option value="closed">关闭对接</option>
     <option value="order_proof">提交真实订单证明待独立复核</option></select></label>
    {(stage==='consent_verified'||stage==='order_proof')&&<label>安全存储凭证编号<input disabled={!enabled||busy} value={ref} onChange={e=>setRef(e.target.value)} placeholder="已核验凭证的内部编号，不是客户联系方式"/></label>}
    <button disabled={!enabled||busy||!idPattern.test(leadId)||((stage==='consent_verified'||stage==='order_proof')&&ref.length<8)}>{enabled?'保存阶段进展':'待权限与客户同意核验'}</button>
   </form>
   <form className="ac-card ac-form ac-wide" onSubmit={e=>{e.preventDefault();void execute(()=>api.adminVerifyOrderProof(proofId,proofDecision==='verified',proofReason.trim()),'订单凭证独立复核结果已记录；未经核实的意向不计为成交。')}}>
    <h2><BadgeCheck size={20}/> 订单凭证独立复核</h2><p className="ac-muted">必须由未参与该客户引荐、同意核查、凭证提交的另一名审核员审查真实合同或其他合法凭证。</p>
    <label>待核实订单证明 UUID<input disabled={!enabled||busy} value={proofId} onChange={e=>setProofId(e.target.value)}/></label>
    <label>独立复核结论<select disabled={!enabled||busy} value={proofDecision} onChange={e=>setProofDecision(e.target.value)}>
     <option value="pending">尚未核验</option><option value="verified">真实凭证已核实</option><option value="rejected">证据不足或不成立</option></select></label>
    <label>审核事实与依据<textarea minLength={25} maxLength={1200} disabled={!enabled||busy} rows={3} value={proofReason} onChange={e=>setProofReason(e.target.value)}/></label>
    <button disabled={!enabled||busy||!idPattern.test(proofId)||proofReason.trim().length<25||proofDecision==='pending'}>{enabled?'保存独立订单审核':'待可信订单核验服务接入'}</button>
   </form>
  </div>
 </main></Shell>;
}
