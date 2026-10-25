import {useState, type FormEvent} from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpenCheck, Calculator, ClipboardCheck,
  FileCheck2, HeartHandshake, LockKeyhole, RefreshCw, Scale, ShieldCheck, Users
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {
  api, scoringApiReady, type PrivateScoringRun, type User
} from '../services/api';
import '../styles/employer-scoring.css';

const trustRules=[
  {name:'招聘信息诚信',weight:50,detail:'核验岗位真实性、招聘流程及相关承诺'},
  {name:'经营与履约诚信',weight:50,detail:'核验经营履约材料及公开诚信记录'}
];
const careRules=[
  {name:'工资与劳动合同',weight:20,detail:'劳动合同及工资支付的证据支持'},
  {name:'社保与基本保障',weight:20,detail:'社会保障的制度及执行证据'},
  {name:'工时与休息休假',weight:15,detail:'工时、排班、休假及改进措施'},
  {name:'员工培训与成长',weight:15,detail:'培训投入与职业发展制度'},
  {name:'员工体验季度汇总',weight:30,detail:'仅上一完整季度，且至少十份合格反馈'}
];

function Rules({items}:{items:typeof trustRules}){
  return <div className="es-rules">{items.map(item=><div key={item.name} className="es-rule">
    <div><strong>{item.name}</strong><p>{item.detail}</p></div><span>{item.weight}%</span>
  </div>)}</div>;
}

export function EmployerScoringPage({user}:{user:User|null}){
  return <Shell user={user}><main className="es-page">
    <Link className="es-back" to="/employer/growth"><ArrowLeft size={16}/> 返回企业成长档案</Link>
    <p className="es-kicker">HHBA · 企业成长计划 / 第 07 模块</p>
    <h1>企业双评分：每一分，都应该有依据。</h1>
    <p className="es-subtitle">信誉值、员工善待值分别计算。分数需要材料核验、独立评估和可信员工反馈的支持，不能通过企业自述、刷好评或购买服务获得。</p>
    <div className="es-alert"><LockKeyhole size={21}/><div><strong>正式评分尚未公开</strong><p>评分候选值仅供独立审核人员内部复核。申诉处理、公开审批和规则治理机制完善之前，企业端、求职者端统一显示「待评估」，不会展示未经批准的数值。</p></div></div>
    <div className="es-cols">
      <section className="es-card">
        <div className="es-head"><ShieldCheck size={23}/><div><h2>企业信誉值</h2><span>0–100 分 · 待评估</span></div></div>
        <p className="es-card-desc">必须确认企业认证并具备所有指定类别的经核验评分依据，缺任何一项都不生成正式分数。</p>
        <Rules items={trustRules}/>
      </section>
      <section className="es-card">
        <div className="es-head"><HeartHandshake size={23}/><div><h2>员工善待值</h2><span>0–100 分 · 待评估</span></div></div>
        <p className="es-card-desc">不仅核查劳动保障与福利文件，还要综合上一个已完成季度的合格员工体验汇总。</p>
        <Rules items={careRules}/>
      </section>
    </div>
    <div className="es-card es-bottom">
      <h2><Scale size={20}/> 动态评分、纠错与成长记录</h2>
      <div className="es-process">
        <div><FileCheck2 size={18}/><strong>真实证据</strong><small>文件独立核验，过期或存在争议的证据不继续生效</small></div>
        <ArrowRight size={18}/>
        <div><Users size={18}/><strong>员工反馈</strong><small>只使用满足人数门槛的上一完整季度汇总</small></div>
        <ArrowRight size={18}/>
        <div><Calculator size={18}/><strong>留痕重算</strong><small>固定版本规则、全类别覆盖、结果历史不可无痕更改</small></div>
      </div>
      <div className="es-notice"><BookOpenCheck size={18}/><span>真实改善记录已有独立提交、证据核验与公开审批流程；仍不会依据企业自述虚构评分变化或企业成长曲线。</span></div>
    </div>
    <div className="es-foot"><Link to="/employer/verified-profile">查看公众档案 <ArrowRight size={15}/></Link><Link to="/employer/improvements">提交真实改善记录 <ArrowRight size={15}/></Link><Link to="/employer/appeals">提交评分申诉 <ArrowRight size={15}/></Link><Link to="/employer/evidence">进入证明材料核验 <ArrowRight size={15}/></Link><Link to="/employer/aid">了解 HHBA 帮扶标准 <ArrowRight size={15}/></Link> <Link to="/employer/aid/apply">进入帮扶申请 <ArrowRight size={15}/></Link></div>
  </main></Shell>;
}

export function AdminEmployerScoringPage({user}:{user:User|null}){
  const enabled=scoringApiReady&&user?.role==='admin';
  const [orgId,setOrgId]=useState('');
  const [proofId,setProofId]=useState('');
  const [reason,setReason]=useState('');
  const [grade,setGrade]=useState('');
  const [result,setResult]=useState<PrivateScoringRun|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  async function assess(e:FormEvent){
    e.preventDefault();
    if(!enabled)return;
    const numeric=Number(grade);
    if(!Number.isInteger(numeric)||numeric<0||numeric>100||reason.trim().length<25){
      setError('评分必须是 0–100 的整数，且审核依据至少 25 字。');return;
    }
    setBusy(true);setError('');setNotice('');
    try{
      await api.adminCreateScoreFinding(orgId,proofId,numeric,reason.trim());
      setProofId('');setGrade('');setReason('');
      setNotice('独立审核意见已记录。此操作不会公开分数，也不会自动授予帮扶资格。');
    }catch(err){setError(err instanceof Error?err.message:'无法记录独立评分意见')}
    finally{setBusy(false)}
  }
  async function calculate(){
    if(!enabled)return;
    setBusy(true);setError('');setNotice('');
    try{
      const run=await api.adminRecalculateScores(orgId);
      setResult(run);
      setNotice('已保存内部评分快照。公众和企业仍只看到「待评估」。');
    }catch(err){setError(err instanceof Error?err.message:'无法重新计算评分')}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="es-page">
    <Link className="es-back" to="/admin/employer-evidence"><ArrowLeft size={16}/> 返回证据核验队列</Link>
    <p className="es-kicker">HHBA · 独立审核管理</p><h1>评分候选值与复核</h1><Link to="/admin/employer-appeals">前往申诉独立复核队列 <ArrowRight size={15}/></Link> <Link to="/admin/employer-improvements">前往企业改善核验 <ArrowRight size={15}/></Link> <Link to="/admin/employer-publication">前往双人评分发布审批 <ArrowRight size={15}/></Link>
    <p className="es-subtitle">只有经过服务器独立授权的评分审核员才能操作。资料提交人、文件初审员和评分审核员不能由同一人直接完成全流程。</p>
    {!enabled&&<div className="es-alert" role="status"><LockKeyhole size={20}/><div><strong>独立评分服务尚未开放</strong><p>当前 GitHub Pages 预览没有真实审核权限，提交评估和重算均被禁用。代码不包含管理员万能密码或假评分。</p></div></div>}
    {error&&<p role="alert" className="es-error">{error}</p>}
    {notice&&<p role="status" className="es-ok">{notice}</p>}
    <div className="es-cols">
      <form className="es-card es-form" onSubmit={assess}>
        <h2><ClipboardCheck size={20}/> 证据独立评估</h2>
        <label>企业组织 ID<input value={orgId} onChange={e=>setOrgId(e.target.value)} placeholder="核验后的企业 UUID" disabled={!enabled||busy}/></label>
        <label>已核验证据 ID<input value={proofId} onChange={e=>setProofId(e.target.value)} placeholder="经独立核验的材料 UUID" disabled={!enabled||busy}/></label>
        <label>证据对应的 0–100 评估意见<input inputMode="numeric" value={grade} onChange={e=>setGrade(e.target.value)} placeholder="不能通过上传自动打分" disabled={!enabled||busy}/></label>
        <label>独立审核依据<textarea rows={4} maxLength={1200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="记录证据来源、核验方法、评价理由和依据" disabled={!enabled||busy}/></label>
        <button type="submit" disabled={!enabled||busy||!orgId||!proofId}>{enabled?'记录审核意见':'待独立评分服务接入'}</button>
      </form>
      <section className="es-card es-form">
        <h2><RefreshCw size={20}/> 计算并保存内部候选值</h2>
        <p>依据当前认证、最新合法有效的六类评估依据，以及上一已完成季度达到隐私门槛的员工反馈，计算不可覆写的内部快照。</p>
        <p className="es-fine">缺少任何必备证据，不用其余高分弥补；存在已争议或失效的关键材料，重算结果自动回到待评估。</p>
        <button type="button" disabled={!enabled||busy||!orgId} onClick={()=>void calculate()}>{enabled?'重新计算（内部）':'未开放真实计算'}</button>
        {result&&<div className="es-private-result"><p>内部记录 ID：{result.run_id}</p><div><strong>信誉候选值</strong><span>{result.candidate.trust.score??'待评估'}</span></div><div><strong>善待候选值</strong><span>{result.candidate.care.score??'待评估'}</span></div><small>规则版本：{result.rule_version} · 严禁将内部候选值当作正式公布结果</small></div>}
        <div className="es-notice"><BadgeCheck size={18}/><span>模块 08 申诉与独立发布审批完成之前，所有评分都不能被企业自行展示成 HHBA 正式认证。</span></div>
      </section>
    </div>
  </main></Shell>;
}
