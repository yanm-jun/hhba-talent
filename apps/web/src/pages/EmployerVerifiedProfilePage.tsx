import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BadgeCheck,BookOpen,Building2,ClipboardCheck,HeartHandshake,History,LockKeyhole,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {api,publicationApiReady,type HHBAPublicGrowthProfile,type HHBAPublicVersion,type HHBAPublicationCase,type User} from '../services/api';
import '../styles/employer-verified-profile.css';
const labels:Record<string,string>={pay_and_contracts:'工资与合同',social_insurance:'社保保障',working_hours:'工时休假',employee_development:'员工发展',recruitment_integrity:'招聘诚信',business_integrity:'经营履约'};
const isUUID=(x:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const message=(e:unknown)=>e instanceof Error?e.message:'当前服务未能响应';
function Guard({title,body}:{title:string;body:string}){return <div className="vp-guard" role="status"><LockKeyhole size={22}/><div><strong>{title}</strong><p>{body}</p></div></div>}
export function EmployerVerifiedProfilePage({user}:{user:User|null}){
 const org=new URLSearchParams(window.location.search).get('org')||'';
 const [profile,setProfile]=useState<HHBAPublicGrowthProfile|null>(null);
 const [versions,setVersions]=useState<HHBAPublicVersion[]>([]);
 const [error,setError]=useState('');
 const ready=publicationApiReady&&isUUID(org);
 useEffect(()=>{if(!ready){setProfile(null);setVersions([]);return;}let live=true;
  Promise.all([api.employerGrowthProfile(org),api.employerGrowthVersions(org)])
   .then(([p,h])=>{if(live){setProfile(p);setVersions(h.items)}})
   .catch(e=>{if(live)setError(message(e))});
  return()=>{live=false}
 },[org,ready]);
 const released=ready&&profile?.publication==='published';
 const items=profile?.improvements||[];
 return <Shell user={user}><main className="vp-page">
  <Link className="vp-back" to="/employer/public"><ArrowLeft size={16}/> 返回企业公开档案</Link>
  <div className="vp-hero"><p>HHBA · 企业公开成长档案</p><h1>企业怎么样，让证据和行动说话。</h1>
    <span>企业信誉与员工关怀分开评价；审核通过的改善有日期、有依据。数据失效或出现未处理的争议，暂停公开旧分数。</span></div>
  {!publicationApiReady&&<Guard title="正式评分发布服务尚未开放" body="当前静态预览不展示虚构分数、企业案例或订单。企业、员工和求职者看到的状态一致。"/>}
  {publicationApiReady&&!isUUID(org)&&<Guard title="尚未选择已核验企业" body="请从真实企业的公开档案进入，以查看该企业获准公开的评分及改善记录。"/>}
  {error&&<p className="vp-error" role="alert">{error}</p>}
  <div className="vp-scores">
   <article className="vp-card"><div className="vp-score-title"><ShieldCheck size={22}/><h2>企业信誉值</h2></div>
     <div className="vp-score-number">{released?profile?.trust.score:'待评估'}{released&&<small>/100</small>}</div>
     <p>招聘真实度与经营履约等事实均需有独立核验材料。</p><span className="vp-small">{released?'双人复核获准公布':'不能将待评估理解为零分'}</span></article>
   <article className="vp-card"><div className="vp-score-title"><HeartHandshake size={22}/><h2>员工善待值</h2></div>
     <div className="vp-score-number">{released?profile?.care.score:'待评估'}{released&&<small>/100</small>}</div>
     <p>劳动保障、员工成长与受隐私保护的季度员工反馈共同参与评价。</p><span className="vp-small">{released?'仅公开合规汇总结果':'不披露员工个人反馈和身份'}</span></article>
  </div>
  <div className="vp-version"><BadgeCheck size={20}/><div><strong>{released?'已获准发布的当前版本':'评价状态：待评估'}</strong>
     <p>{released&&profile?'第 '+profile.version+' 版 · '+profile.rule_version+' · '+(profile.updated_at||'').slice(0,10):'评分来源、审核、申诉或发布条件未全部满足；尚无有效公开分数。'}</p>
   </div><Link to="/employer/scoring">评分规则 <ArrowRight size={15}/></Link></div>
  <section className="vp-card"><div className="vp-section-header"><h2><ClipboardCheck size={20}/> 经核验的实际改善</h2>
    <Link to={'/employer/improvements/public'+(isUUID(org)?'?org='+encodeURIComponent(org):'')}>成长时间线 <ArrowRight size={15}/></Link></div>
    {items.length===0?<div className="vp-empty">暂无可以公开的真实改善记录。</div>:<ol className="vp-timeline">{items.map(i=><li key={i.id}>
     <time>{i.effective_date}</time><div><strong>{labels[i.category]||'实际改善事项'}</strong><p>{i.summary}</p><small>审核日期 {i.reviewed_date}</small></div>
    </li>)}</ol>}
  </section>
  <section className="vp-card"><h2><History size={20}/> 评分发布与版本追溯</h2>
    <p className="vp-hint">只展示版本号及发布日期；已撤销版本不继续展示原分数。</p>
    {versions.length===0?<div className="vp-empty">暂无经批准的历史发布版本。</div>:<div className="vp-list">{versions.map(v=><div key={v.version}>
      <strong>第 {v.version} 版</strong><small>{v.released_on}</small><span>{v.status==='withdrawn'?'已撤销':'历史发布版本'}</span>
    </div>)}</div>}
  </section>
  <div className="vp-disclaimer"><BookOpen size={19}/><p>HHBA 评分是限定证据和规则下的评价，不构成劳动法律合规、客户订单或经营履约保证。员工隐私不公开；平台商业帮扶仍需要另外申请和审核。<Link to="/employer/aid/apply">了解企业帮扶申请 <ArrowRight size={14}/></Link></p></div>
 </main></Shell>;
}
export function AdminEmployerPublicationPage({user}:{user:User|null}){
 const enabled=publicationApiReady&&user?.role==='admin';
 const [org,setOrg]=useState(''),[run,setRun]=useState('');
 const [queue,setQueue]=useState<HHBAPublicationCase[]>([]);
 const [selected,setSelected]=useState(''),[decision,setDecision]=useState<'approve'|'reject'>('approve'),[reason,setReason]=useState('');
 const [revokeId,setRevokeId]=useState(''),[revokeReason,setRevokeReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!enabled)return;let live=true;
  api.adminPublicationQueue().then(r=>{if(live)setQueue(r.items)}).catch(e=>{if(live)setError(message(e))});
  return()=>{live=false}
 },[enabled]);
 async function refresh(){setQueue((await api.adminPublicationQueue()).items)}
 async function prepare(e:FormEvent){e.preventDefault();if(!enabled)return;
  setBusy(true);setError('');setNotice('');
  try{await api.adminPreparePublication(org,run);await refresh();setNotice('候选版本已创建，但尚未公开。');setRun('')}
  catch(e){setError(message(e))}finally{setBusy(false)}
 }
 async function review(e:FormEvent){e.preventDefault();if(!enabled||!selected)return;
  setBusy(true);setError('');setNotice('');
  try{const result=await api.adminPublicationDecision(selected,decision,reason.trim());
   await refresh();setSelected('');setReason('');
   setNotice(result.status==='first_approved'?'第一位审核人已签批，必须由另一人继续复核。':result.status==='published'?'双人独立签批通过，生成公开版本。':'候选版本已被拒绝。')}
  catch(e){setError(message(e))}finally{setBusy(false)}
 }
 async function revoke(e:FormEvent){e.preventDefault();if(!enabled)return;
  setBusy(true);setError('');setNotice('');
  try{await api.adminPublicationRevoke(revokeId,revokeReason.trim());setRevokeId('');setRevokeReason('');await refresh();setNotice('公开版本已撤销，审计历史保留。')}
  catch(e){setError(message(e))}finally{setBusy(false)}
 }
 return <Shell user={user}><main className="vp-page">
  <Link className="vp-back" to="/admin/employer-scoring"><ArrowLeft size={16}/> 返回评分审核</Link>
  <div className="vp-hero"><p>HHBA · 内部发布治理 / 模块 10</p><h1>双人审核、版本发布与撤销</h1><span>企业提交人、材料核验人、评分审核人、发布准备人和发布签批人之间必须满足严格的角色回避规则。</span></div>
  {!enabled&&<Guard title="真实评分发布与撤销尚未开放" body="可信企业认证、审批人员权限、正式批准的评分规则尚未完成生产接入。静态预览不会公开任何分数。"/>}
  {error&&<p className="vp-error" role="alert">{error}</p>}{notice&&<p className="vp-success" role="status">{notice}</p>}
  <div className="vp-admin-grid">
   <form className="vp-card vp-form" onSubmit={prepare}><h2><Building2 size={20}/> 第一步：准备公开版本</h2>
    <label>企业组织 UUID<input value={org} onChange={e=>setOrg(e.target.value)} disabled={!enabled||busy} placeholder="服务器验证的真实企业 UUID"/></label>
    <label>最新内部评分运行 UUID<input value={run} onChange={e=>setRun(e.target.value)} disabled={!enabled||busy} placeholder="有完整材料和季度汇总的记录 UUID"/></label>
    <p className="vp-hint">不满足认证、证据、隐私门槛或有未决申诉时，服务器拒绝创建。</p>
    <button disabled={!enabled||busy||!isUUID(org)||!isUUID(run)}>{enabled?'创建待审版本':'待可信发布服务接入'}</button>
   </form>
   <form className="vp-card vp-form" onSubmit={review}><h2><BadgeCheck size={20}/> 第二步：独立两人签批</h2>
    <label>选择待审批事项<select disabled={!enabled||busy} value={selected} onChange={e=>setSelected(e.target.value)}>
     <option value="">请选择真实审批记录</option>{queue.map(c=><option value={c.id} key={c.id}>{c.organization_id.slice(0,8)} · {c.status==='prepared'?'待第一审核':'待第二审核'}</option>)}</select></label>
    <label>审核决定<select disabled={!enabled||busy} value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="approve">同意（进入下一步或正式发布）</option><option value="reject">不批准（须说明依据）</option></select></label>
    <label>独立核验依据<textarea rows={4} minLength={25} maxLength={1200} value={reason} onChange={e=>setReason(e.target.value)} disabled={!enabled||busy} placeholder="说明证据、隐私、申诉状态和审核依据"/></label>
    <button disabled={!enabled||busy||!selected||reason.trim().length<25}>{enabled?'提交签批决定':'待双人审核接入'}</button>
   </form>
  </div>
  <form className="vp-card vp-form vp-revoke" onSubmit={revoke}><h2><ShieldCheck size={20}/> 公开版本撤销</h2>
   <p className="vp-hint">独立于原审批人员的其他审核员才能撤销。证据或企业资格失效时，公开读取会自动暂停展示旧分数。</p>
   <label>已发布记录 UUID<input disabled={!enabled||busy} value={revokeId} onChange={e=>setRevokeId(e.target.value)}/></label>
   <label>撤销原因<textarea rows={3} minLength={25} maxLength={1200} disabled={!enabled||busy} value={revokeReason} onChange={e=>setRevokeReason(e.target.value)}/></label>
   <button disabled={!enabled||busy||!isUUID(revokeId)||revokeReason.trim().length<25}>{enabled?'申请独立撤销':'待撤销权限接入'}</button>
  </form>
  <div className="vp-disclaimer"><BookOpen size={19}/><p>公开制度仍需真实会话、CSRF、审计、人工审核规章以及申诉纠正流程。正式生产未接入前不允许使用演示按钮发布真实企业评价。 <Link to="/admin/employer-aid">转到独立帮扶审核与客户对接记录</Link></p></div>
 </main></Shell>;
}
