import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Building2,
  CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Clock3,
  FileCheck2, FilePlus2, HeartHandshake, LayoutDashboard, LockKeyhole,
  Search, ShieldCheck, TrendingUp, UserRoundCheck, UsersRound
} from 'lucide-react';
import { Shell } from '../components/Shell';
import { Link, navigate } from '../router';
import { api, employerApiReady, type EmployerPosting, type Organization, type User } from '../services/api';
import '../styles/employer-growth-hub.css';

type View = 'dashboard' | 'growth' | 'aid' | 'public';
type Identity = 'legal' | 'hr' | 'authorized';
const STEPS = ['企业身份', '企业信息', '经办人身份', '核对规则'];
const evaluationItems = [
  ['劳动合同与工资支付', '待独立核验'],
  ['社会保险与休息休假', '待独立核验'],
  ['员工成长与培训', '待独立核验'],
  ['经核实的员工反馈', '尚未开放收集']
] as const;

function routeFor(view: View) {
  return view === 'dashboard' ? '/employer/hub' : '/employer/' + view;
}
function entryRoute(user: User | null) {
  if (!employerApiReady) return '/employer/onboarding-preview';
  return user ? '/recruiter/onboarding' : '/recruiter/register?next=%2Frecruiter%2Fonboarding';
}

export function EmployerStartPage({ user }: { user: User | null }) {
 return <Shell user={user}><main className="eh-entry hhba-employer-intro">
  <div className="hhba-employer-intro-hero">
   <p className="eh-kicker">HHBA · ENTERPRISE SERVICES</p>
   <h1>让招聘更透明，让企业更值得信赖。</h1>
   <p className="eh-lead">从企业招聘与授权人才搜索，到员工反馈、信誉核验和发展帮扶。
     先了解平台服务，再决定是否入驻；不需要进入首页就提交认证材料。</p>
  </div>
  <section className="hhba-employer-services" aria-label="企业招聘与治理服务">
   <article className="eh-card hhba-employer-service"><Building2 size={22}/>
    <h2>企业入驻与认证</h2>
    <p>核验企业主体及招聘经办人授权，明确组织成员与使用权限。</p>
    <Link to={entryRoute(user)}>了解入驻流程 <ChevronRight size={15}/></Link>
   </article>
   <article className="eh-card hhba-employer-service"><BriefcaseBusiness size={22}/>
    <h2>招聘与人才管理</h2>
    <p>维护岗位、跟进申请，并在候选人明确授权的范围内检索人才。</p>
    <Link to="/employer/workspace">查看招聘能力 <ChevronRight size={15}/></Link>
   </article>
   <article className="eh-card hhba-employer-service"><ShieldCheck size={22}/>
    <h2>企业信誉与治理</h2>
    <p>了解员工反馈保护、证据核验、双评分、申诉与真实改善机制。</p>
    <Link to="/employer/growth">了解治理规则 <ChevronRight size={15}/></Link>
   </article>
   <article className="eh-card hhba-employer-service"><HeartHandshake size={22}/>
    <h2>企业发展帮扶</h2>
    <p>查看可信评价、帮扶申请及企业合作对接的具体规则和边界。</p>
    <Link to="/employer/aid">查看发展帮扶 <ChevronRight size={15}/></Link>
   </article>
  </section>
  <div className="eh-entry-grid hhba-employer-actions">
   <section className="eh-card eh-entry-option">
    <Building2 size={25} aria-hidden="true"/>
    <h2>首次来到 HHBA 的企业</h2>
    <p>从企业服务介绍进入身份与资质认证；只有审核通过的经办人才能使用对应业务权限。</p>
    <Link className="eh-primary" to={entryRoute(user)}>开始企业入驻 <ArrowRight size={16}/></Link>
   </section>
   <section className="eh-card eh-entry-option">
    <LayoutDashboard size={25} aria-hidden="true"/>
    <h2>已有企业账户</h2>
    <p>进入企业工作台，管理招聘事务、企业成长信息与后续申请。</p>
    <Link className="eh-secondary" to="/employer/hub">查看企业工作台 <ArrowRight size={16}/></Link>
   </section>
  </div>
  {!employerApiReady&&<p className="eh-status" role="status"><ShieldCheck size={17}/>
    当前为 GitHub Pages 静态功能预览。正式企业认证、招聘发布、人才检索和证据提交需要独立的受保护后端；演示不收集企业隐私资料。
   </p>}
  <div className="eh-promise"><HeartHandshake size={21}/><div>
   <strong>让善待员工的企业获得更多发展机会</strong>
   <p>企业信誉与员工善待表现需要证据、独立核验、隐私保护及申诉机制。
    分数不可购买，也不能承诺一定获得商业订单；企业招聘账户不等于 HHBA 内部审核账户。</p>
  </div></div>
 </main></Shell>;
}

export function EmployerOnboardingPreviewPage({ user }: { user: User | null }) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Identity>('hr');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('manufacturing');
  const [region, setRegion] = useState('');
  const [role, setRole] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1 && (!orgName.trim() || !region.trim())) return setError('请补充企业名称和所在地，以继续预览。');
    if (step === 2 && !role.trim()) return setError('请填写经办人在企业内的职务。');
    if (step === 3 && !agreed) return setError('请先阅读并确认招聘和评分规则。');
    setError('');
    if (step === 3) return navigate('/employer/hub');
    setStep(x => x + 1);
  }
  return <Shell user={user}><main className="eh-wizard">
    <div className="eh-wizard-head">
      <div><p className="eh-kicker">企业入驻 · 交互演示</p><h1>{STEPS[step]}</h1><p>实际企业认证将复用 HHBA 已有的安全上传、验证和人工审核接口。</p></div>
      <b>{step + 1} / 4</b>
    </div>
    <ol className="eh-steps" aria-label="企业入驻进度">
      {STEPS.map((label, i) => <li className={i === step ? 'current' : i < step ? 'done' : ''} key={label}><span>{i < step ? '✓' : i + 1}</span><small>{label}</small></li>)}
    </ol>
    <div className="eh-wizard-grid"><form className="eh-card eh-wizard-form" onSubmit={next}>
      {step === 0 && <>
        <h2>您以什么身份代表企业？</h2>
        {([['legal','我是法定代表人'],['hr','我是 HR 或招聘负责人'],['authorized','我是获得授权的经办人']] as const).map(([v,label])=><label key={v} className={'eh-choice '+(identity===v?'selected':'')}><input type="radio" name="identity" checked={identity===v} onChange={()=>setIdentity(v)}/>{label}</label>)}
        <p className="eh-field-help">企业经办人与企业主体分别核验。求职者不能直接创建企业组织。</p>
      </>}
      {step === 1 && <>
        <h2>请介绍企业</h2>
        <label>企业法定名称<input maxLength={200} value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="请输入营业执照上的企业全称"/></label>
        <label>所属行业<select value={industry} onChange={e=>setIndustry(e.target.value)}><option value="manufacturing">制造业</option><option value="technology">互联网与软件</option><option value="retail">零售与服务</option><option value="other">其他行业</option></select></label>
        <label>企业所在地<input maxLength={120} value={region} onChange={e=>setRegion(e.target.value)} placeholder="例如：山东省济南市"/></label>
        <p className="eh-field-help">营业执照、统一社会信用代码与相关证明只在正式安全认证流程中提交。</p>
      </>}
      {step === 2 && <>
        <h2>确认经办人授权</h2>
        <label>在企业担任的职务<input maxLength={120} value={role} onChange={e=>setRole(e.target.value)} placeholder="例如：人力资源负责人"/></label>
        <div className="eh-upload-placeholder"><FileCheck2 size={21}/><div><strong>营业执照与授权书</strong><p>正式系统需通过安全通道上传并由平台核验。预览页面不接收真实文件。</p></div></div>
      </>}
      {step === 3 && <>
        <h2>了解招聘与企业成长规则</h2>
        <div className="eh-rule"><CheckCircle2 size={18}/><span>公开岗位必须真实，经平台审核后才可发布。</span></div>
        <div className="eh-rule"><ShieldCheck size={18}/><span>人才搜索遵守候选人授权；撤回授权即时生效。</span></div>
        <div className="eh-rule"><HeartHandshake size={18}/><span>企业评分需要证据、独立核验、申诉与员工隐私保护。</span></div>
        <div className="eh-rule"><BadgeCheck size={18}/><span>达到帮扶条件只代表可以申请，不承诺商业订单。</span></div>
        <label className="eh-consent"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>我已阅读以上规则</label>
      </>}
      {error && <p className="eh-error" role="alert">{error}</p>}
      <div className="eh-form-actions">
        <button type="button" className="eh-secondary" onClick={()=>step===0?navigate('/employer/start'):(setError(''),setStep(x=>x-1))}>上一步</button>
        <button className="eh-primary" type="submit">{step===3?'预览企业工作台':'下一步'} <ArrowRight size={15}/></button>
      </div>
    </form>
    <aside className="eh-wizard-aside"><LockKeyhole size={20}/><strong>入驻答题不会代替实际认证</strong><p>本演示的输入只存在于当前页面，不发送到服务器；关闭页面后不会保存。需要上线业务数据时，使用 HHBA 原有实名认证与审核链路。</p>{employerApiReady&&<Link to={entryRoute(user)}>前往正式企业认证 <ArrowUpRight size={14}/></Link>}</aside></div>
  </main></Shell>;
}

const nav = [
  { view:'dashboard' as View, label:'工作台', icon:LayoutDashboard },
  { view:'growth' as View, label:'信誉与善待', icon:HeartHandshake },
  { view:'aid' as View, label:'HHBA 帮扶', icon:BadgeCheck },
  { view:'public' as View, label:'企业公开视图', icon:Building2 }
];
function Evaluation({ compact = false }: { compact?: boolean }) {
  return <div className={'eh-evaluation '+(compact?'compact':'')}>
    <div><span>企业信誉值</span><strong>待评估</strong><small>尚无可信核验结果</small></div>
    <div><span>员工善待值</span><strong>待评估</strong><small>员工反馈机制待接入</small></div>
  </div>;
}
function EmptyMetric({ label, value }: { label:string; value:string }) {
  return <div className="eh-metric"><small>{label}</small><strong>{value}</strong></div>;
}
export function EmployerGrowthHubPage({ user, view }: { user: User | null; view: View }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [oid, setOid] = useState('');
  const [jobs, setJobs] = useState<EmployerPosting[]>([]);
  const [loading, setLoading] = useState(employerApiReady);
  const [error, setError] = useState('');
  const [aidBusiness, setAidBusiness] = useState('');
  const [aidNeed, setAidNeed] = useState('customers');
  const [aidNotice, setAidNotice] = useState('');
  const [employeeView, setEmployeeView] = useState(false);
  useEffect(()=>{
    if(!employerApiReady || !user || view === 'public') return;
    let live = true;
    api.organizations().then(r=>{if(!live)return;setOrganizations(r.organizations);setOid(old=>r.organizations.some(x=>x.id===old)?old:(r.organizations[0]?.id||''));})
      .catch(()=>{if(live)setError('企业资料暂时无法读取，请检查企业服务连接。')})
      .finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  },[user,view]);
  useEffect(()=>{
    if(!oid || view !== 'dashboard' || !employerApiReady) return;
    let live=true;
    api.postings(oid).then(r=>{if(live)setJobs(r.items)}).catch(()=>{if(live)setError('岗位数据读取失败，请进入招聘管理检查。')});
    return ()=>{live=false};
  },[oid,view]);
  if(employerApiReady && !user && view !== 'public') {
    navigate('/recruiter/login?next='+encodeURIComponent(routeFor(view)));
    return null;
  }
  const org=organizations.find(x=>x.id===oid);
  const approved=org?.status==='approved';
  const demo=!employerApiReady;
  const publicPage=view==='public';
  // Only forward a public organization identifier; never treat it as employment proof.
  const linkedOrg=new URLSearchParams(window.location.search).get('org')||'';
  const employeeFeedbackHref=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(linkedOrg)
    ? '/employee/feedback?org='+encodeURIComponent(linkedOrg)
    : '/employee/feedback';
  return <Shell user={user}><div className="eh-layout">
    <aside className="eh-sidebar">
      <p className="eh-sidebar-title">企业工作台</p>
      <nav aria-label="企业服务导航">
        {nav.map(({view:v,label,icon:Icon})=><Link className={'eh-sidebar-link '+(view===v?'active':'')} key={v} to={routeFor(v)}><Icon size={17}/>{label}</Link>)}
        <Link className="eh-sidebar-link" to="/employer/evidence"><FileCheck2 size={17}/>证明材料核验</Link><Link className="eh-sidebar-link" to="/employer/appeals"><ShieldCheck size={17}/>异议与申诉</Link><Link className="eh-sidebar-link" to="/employer/improvements"><TrendingUp size={17}/>真实改善记录</Link><Link className="eh-sidebar-link" to="/employer/verified-profile"><ShieldCheck size={17}/>企业公开评分档案</Link><Link className="eh-sidebar-link" to="/employer/aid/apply"><HeartHandshake size={17}/>帮扶申请</Link><Link className="eh-sidebar-link" to="/employer/commercial"><BriefcaseBusiness size={17}/>客户对接记录</Link>
        <Link className="eh-sidebar-link" to="/employer/workspace"><BriefcaseBusiness size={17}/>招聘管理</Link>
        <Link className="eh-sidebar-link" to="/employer/workspace"><UsersRound size={17}/>候选人与人才</Link>
        <Link className="eh-sidebar-link" to="/recruiter/onboarding"><UserRoundCheck size={17}/>企业认证</Link>
      </nav>
      <div className="eh-sidebar-foot"><ShieldCheck size={17}/><span>评分不可购买，员工隐私受保护</span></div>
    </aside>
    <main className="eh-main">
      <div className="eh-main-head"><div><p className="eh-kicker">HHBA 企业服务</p><h1>{view==='dashboard'?'企业招聘概览':view==='growth'?'企业成长档案':view==='aid'?'HHBA 企业发展帮扶':'企业公开档案'}</h1><p>{view==='dashboard'?'先做好招聘，再让真正善待员工的企业得到更多关注。':view==='growth'?'真实表现经核验后，才能转化为公开、可解释的企业评分。':view==='aid'?'把平台支持给予负责任、具备实际交付能力的企业。':'求职者和员工能够看到什么，以及为什么能看到。'}</p></div>{!publicPage&&<Link className="eh-header-cta" to="/employer/workspace"><FilePlus2 size={16}/> 招聘管理</Link>}</div>
      {demo&&<div className="eh-status"><ShieldCheck size={18}/><span><strong>静态预览模式</strong>：未连接企业账户 API。所有业务指标只显示未接入状态，不模拟简历、评分、认证结果或订单。</span></div>}
      {error&&<p className="eh-error" role="alert">{error}</p>}
      {!publicPage&&!demo&&<div className="eh-company-picker"><Building2 size={18}/><label>当前企业 <select value={oid} onChange={e=>{setOid(e.target.value);setJobs([])}} disabled={loading}><option value="">请选择企业</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.legal_name}</option>)}</select></label><span>{!org?'暂无企业':approved?'组织已审核':'企业认证待审核'}</span><Link to="/recruiter/onboarding">管理企业身份 <ArrowUpRight size={13}/></Link></div>}
      {!publicPage&&!demo&&!org&&<section className="eh-card eh-no-org"><Building2 size={23}/><h2>还没有可使用的企业组织</h2><p>请先提交营业执照、经办人授权等资料。招聘草稿与公开职位、受限人才检索的权限分开管理。</p><Link className="eh-primary" to="/recruiter/onboarding">开始企业认证 <ArrowRight size={15}/></Link></section>}
      {view==='dashboard'&&<div className="eh-stack">
        <div className="eh-metrics"><EmptyMetric label="在招职位" value={demo||!oid?'—':String(jobs.filter(x=>x.status==='published').length)}/><EmptyMetric label="收到简历" value="—"/><EmptyMetric label="待处理申请" value="—"/></div>
        <div className="eh-card eh-application-card"><div className="eh-card-head"><div><h2>招聘管理</h2><p>岗位、候选人、面试进展和授权人才搜索。</p></div><Link to="/employer/workspace">发布职位 <ArrowUpRight size={15}/></Link></div>
          {jobs.length ? jobs.slice(0,4).map(job=><div className="eh-job-row" key={job.id}><strong>{job.title}</strong><span>{job.status==='published'?'招聘中':job.status==='draft'?'草稿':job.status==='pending_review'?'审核中':job.status==='closed'?'已关闭':'未通过审核'}</span></div>) : <p className="eh-empty">{demo?'静态预览不连接岗位数据。登录并接入企业服务后可查看真实招聘记录。':'暂无可展示的岗位数据。进入招聘管理发布真实招聘需求。'}</p>}
        </div>
        <Link className="eh-card eh-growth-shortcut" to="/employer/growth"><div className="eh-card-head"><div><h2>企业成长档案</h2><p>公开、有依据的信誉和员工善待表现。</p></div><ChevronRight size={16}/></div><Evaluation compact/></Link>
        <Link to="/employer/aid" className="eh-aid-banner"><HeartHandshake size={26}/><div><h2>HHBA 企业发展帮扶</h2><p>经过独立评分和资格审核后，争取品牌曝光、潜在客户引荐及订单对接机会。</p><small>当前状态：帮扶资格尚未评估</small></div><ArrowUpRight size={17}/></Link>
      </div>}
      {view==='growth'&&<div className="eh-stack">
        <div className="eh-card"><div className="eh-card-head"><div><h2>信誉值与员工善待值</h2><p>两项独立评估，不能简单用高信誉值掩盖低员工善待值。</p></div><span className="eh-tag">暂无经核验分数</span></div><Evaluation/></div>
        <div className="eh-card"><div className="eh-card-head"><h2>评分依据与核验状态</h2><Link to="/employer/scoring">查看双评分规则 <ArrowUpRight size={15}/></Link></div><p className="eh-field-help"><Link to="/employer/evidence">提交证明材料</Link> · 必须经独立核验与评分复核，不能因为上传材料就直接加分。</p><div className="eh-checklist">{evaluationItems.map(([label,status])=><div key={label}><span>{label}</span><small>{status}</small></div>)}</div><p className="eh-field-help">未来每个评分项必须包含证据来源、核验日期、规则版本、异议处理通道。未经核实的匿名指控不能直接扣分；企业也不能用虚假员工好评刷分。</p></div>
        <div className="eh-card"><div className="eh-card-head"><div><h2>真实改善记录</h2><p>提交有证据支持的改善事项，独立核验后才可能公开，不会虚构历史曲线。</p></div><Link to="/employer/improvements">进入成长记录 <ArrowUpRight size={15}/></Link></div><div className="eh-timeline-empty"><Clock3 size={20}/><span>公开时间线仅收录经独立核验的实际改善，不会将企业自述直接当成成果。</span></div><p className="eh-field-help"><Link to="/employer/improvements/public">查看公开成长时间线</Link></p></div>
      </div>}
      {view==='aid'&&<div className="eh-stack">
        <div className="eh-aid-banner"><HeartHandshake size={29}/><div><h2>让善待员工的企业获得更多发展机会</h2><p>在招聘服务之外，HHBA 将为符合条件的企业争取客户引荐、业务匹配和合作机会。</p><p><Link to="/employer/aid/apply">进入帮扶申请与审核记录 <ArrowUpRight size={15}/></Link> · <Link to="/employer/commercial">查看客户合作进度 <ArrowUpRight size={15}/></Link></p></div></div>
        <div className="eh-card"><div className="eh-card-head"><div><h2>帮扶资格评估</h2><p>资格认定需要信誉、善待、材料真实性和业务交付能力的综合评估。</p></div><span className="eh-tag">未评估</span></div>
          <div className="eh-checklist">{[['企业身份及招聘授权','视企业认证结果而定'],['企业信誉与员工善待','独立评分机制待接入'],['业务交付能力与资质','需人工核验'],['帮扶资格审核','尚未开放']].map(([n,s])=><div key={n}><span>{n}</span><small>{s}</small></div>)}</div>
        </div>
        <div className="eh-card"><h2>平台可能提供的支持</h2><div className="eh-aid-perks"><span><Search size={18}/> 寻找有真实需求的采购商</span><span><UsersRound size={18}/> 对接客户及上下游合作伙伴</span><span><Building2 size={18}/> 优秀雇主展示与合理曝光</span><span><ClipboardCheck size={18}/> 跟踪商业合作意向</span></div><p className="eh-field-help">任何帮扶和商业订单都不保证成功，企业仍需提供真实产品、服务和履约能力。</p></div>
        <form className="eh-card eh-aid-prep" onSubmit={e=>{e.preventDefault();setAidNotice('材料清单已在当前页面整理；尚未提交或保存到 HHBA。请不要在未认证的预览环境填写商业机密。')}}><h2>帮扶意向资料准备</h2><p>这是申请前的资料准备表单。当前无法提交真实帮扶申请，也不会声称审核通过。</p><label>主营产品或服务<textarea rows={3} value={aidBusiness} maxLength={600} onChange={e=>setAidBusiness(e.target.value)} placeholder="概述主营业务、适用行业及可交付能力；请勿填入商业秘密"/></label><label>希望获得的支持<select value={aidNeed} onChange={e=>setAidNeed(e.target.value)}><option value="customers">寻找客户或订单</option><option value="partners">寻找上下游合作伙伴</option><option value="exposure">企业品牌曝光</option></select></label><button type="submit" className="eh-secondary">检查准备情况</button>{aidNotice&&<p className="eh-status" role="status">{aidNotice}</p>}</form>
      </div>}
      {view==='public'&&<div className="eh-stack">
        <div className="eh-card eh-public-card"><div className="eh-public-header"><span className="eh-company-avatar"><Building2 size={26}/></span><div><h2>企业公开档案（结构预览）</h2><p>实际企业名称和认证状态将取自核验后的组织数据，不能由预览页伪造。</p></div></div><Evaluation/><p className="eh-field-help">未形成核验记录时统一显示「待评估」，不会显示 0 分，也不会在企业主页或岗位详情中使用任何虚构的评分。</p>
          <div className="eh-checklist">{evaluationItems.map(([name,state])=><div key={name}><span>{name}</span><small>{state}</small></div>)}</div>
        </div>
        <div className="eh-card"><div className="eh-card-head"><div><h2>{employeeView?'在职员工视角':'求职者视角'}</h2><p>{employeeView?'反馈前须核实在职关系并严格保护个人身份。':'公开评分应和招聘职位、企业介绍保持一致。'}</p></div><div className="eh-role-switch"><button type="button" aria-pressed={!employeeView} className={!employeeView?'active':''} onClick={()=>setEmployeeView(false)}>求职者</button><button type="button" aria-pressed={employeeView} className={employeeView?'active':''} onClick={()=>setEmployeeView(true)}>员工</button></div></div>
          {employeeView?<div className="eh-privacy-note"><LockKeyhole size={20}/><div><p>员工反馈问卷已设计为独立核验、每季度一次、只公开符合人数门槛的汇总数据。当前尚未接入身份核验服务，不收集真实员工评价。</p><Link to={employeeFeedbackHref}>查看员工反馈流程 <ArrowUpRight size={14}/></Link></div></div>:<div className="eh-privacy-note"><BriefcaseBusiness size={20}/><p>求职者将能在查看企业招聘岗位时，看到已公开的可信评分和解释。评分未核验前只显示「待评估」，不影响查看职位。</p></div>}
        </div>
      </div>}
      <div className="eh-footer-nav"><Link to="/employer/start">企业服务入口</Link><Link to="/employer/workspace">现有招聘管理</Link><Link to="/recruiter/onboarding">现有认证流程</Link></div>
    </main>
  </div></Shell>;
}
