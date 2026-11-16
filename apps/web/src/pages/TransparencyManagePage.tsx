import {useEffect,useState} from 'react';
import {ArrowLeft,CheckCheck,FileLock2,RefreshCw,ShieldAlert} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/transparency-admin.css';

type Row={period:string;status:string;revision:number;reviewedAt?:string|null;publishedAt?:string|null;
 correctionReason?:string|null;draft?:Record<string,unknown>;published?:Record<string,unknown>|null};
type Status={ok:boolean;admin:string;reports:Row[];subscribers:Record<string,number>;deliveries:Record<string,number>;lastTestEmailSentAt:string|null;sendEnabled:boolean;subscriptionsEnabled:boolean};
type CostEntry={id:string;day:string;direction:'income'|'expense';category:string;amountFen:number;evidenceRef:string;voided:boolean};
type CostRegister={ok:boolean;kind:string;month:string;quality:string;totals:{incomeFen:number;expenseFen:number;netFen:number}|null;eventsCount:number;recordedCount:number;voidedCount:number;byCategory:Record<string,number>;entries:CostEntry[];caution:string};
const costCategoryLabels:Record<string,string>={cloudflare:'Cloudflare',deepseek:'DeepSeek / AI',domain:'域名',email:'邮件服务',infrastructure:'服务器与存储',operations:'日常运营',customer:'客户收入',other:'其他'};

const fields=[
 ['营业收入','revenueFen'],['退款及收入冲减','refundFen'],
 ['AI模型调用费用','aiCostFen'],['服务器与存储成本','infrastructureFen'],
 ['人员费用','personnelFen'],['运营管理费用','operationsFen'],
 ['税费','taxesFen'],['其他支出','otherCostFen'],
 ['调整项（可填写负数）','adjustmentsFen'],['月度经营结果（可填写负数）','netResultFen'],
 ['依法确认的可分配利润','distributableProfitFen'],['帮扶池期初余额','openingPoolFen'],
 ['帮扶池实际入账','poolReceivedFen'],['本月帮扶池实际支出','poolSpentFen'],['帮扶池期末余额','closingPoolFen']
] as const;
const endpoint=(path:string)=>import.meta.env.BASE_URL+'api/transparency/admin'+path;
const init=()=>Object.fromEntries(fields.map(([,key])=>[key,'']));
function parseFen(text:string,canNeg=false){
 if(!new RegExp(canNeg?'^-?\\d{1,10}(?:\\.\\d{1,2})?$':'^\\d{1,10}(?:\\.\\d{1,2})?$').test(text.trim()))return null;
 const negative=text.startsWith('-');
 const [whole,part='']=text.replace('-','').split('.');
 const n=Number(whole)*100+Number(part.padEnd(2,'0'));
 return Number.isSafeInteger(n)?(negative?-n:n):null;
}
const fmtFen=(value:unknown)=>typeof value==='number'?(value/100).toFixed(2):'';

export function TransparencyManagePage({user}:{user:User|null}){
 const [status,setStatus]=useState<Status|null>(null);
 const [authError,setAuthError]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [period,setPeriod]=useState('');
 const [amounts,setAmounts]=useState<Record<string,string>>(init);
 const [beneficiaries,setBeneficiaries]=useState('');
 const [notes,setNotes]=useState({basisNote:'',methodNote:'',poolNote:'',privacyReviewNote:''});
 const [reviewNote,setReviewNote]=useState('');
 const [correctionReason,setCorrectionReason]=useState('');
 const [costMonth,setCostMonth]=useState('');
 const [costSnapshot,setCostSnapshot]=useState<CostRegister|null>(null);
 const [costError,setCostError]=useState('');
 const [costBusy,setCostBusy]=useState(false);


 const [confirmations,setConfirmations]=useState({ledgerReconciled:false,privacyReviewed:false,legalDistributionBasisChecked:false,noFabricationAttested:false,auditEvidenceConfirmed:false});
 const [currentRow,setCurrentRow]=useState<Row|null>(null);

 const refresh=async()=>{
  try{
   const r=await fetch(endpoint('/status'),{cache:'no-store'});
   if(!r.ok){setAuthError(r.status===403?'尚未通过独立财务后台身份核验':r.status===503?'财务后台尚未配置Cloudflare Access或独立数据库':'后台暂不可访问');return;}
   const data=await r.json() as Status;
   if(!data.ok)throw Error('NO_DATA');
   setStatus(data);setAuthError('');
  }catch{setAuthError('当前无法读取财务后台。请检查独立身份验证与数据库配置。');}
 };
 useEffect(()=>{void refresh();},[]);

 const loadCostRegister=async()=>{
  if(costBusy)return;
  if(!/^20\\d{2}-(0[1-9]|1[0-2])$/.test(costMonth)){setCostError('请选择有效的登记月份');return;}
  setCostBusy(true);setCostError('');setCostSnapshot(null);
  try{
   const r=await fetch(endpoint('/register?month='+encodeURIComponent(costMonth)),{cache:'no-store'});
   const data=await r.json() as CostRegister&{code?:string};
   if(!r.ok||!data.ok)throw Error(data.code||'PRIVATE_REGISTER_UNAVAILABLE');
   if(data.kind!=='HHBA_PRIVATE_FINANCE_REGISTER_V1'||data.month!==costMonth||!Array.isArray(data.entries))
    throw Error('PRIVATE_REGISTER_DATA_INVALID');
   setCostSnapshot(data);
  }catch(e){setCostError('旧后台登记簿暂不能读取：'+(e instanceof Error?e.message:'未知错误'));}
  finally{setCostBusy(false);}
 };
 const prefillExpenseReferences=()=>{
  if(!costSnapshot||costSnapshot.month!==period||!costSnapshot.totals){
   setCostError('请先选择与月报相同的月份并读取已登记凭证');return;
  }
  if(currentRow?.status==='published'){
   setCostError('已公开月报不能直接用登记簿替换；请先走正式更正流程');return;
  }
  // Reference mapping only. Cash-register categories and statutory accounting
  // periods differ; income, other, refunds, taxes and profit are never inferred.
  const mapping:Record<string,string>={
   'expense:deepseek':'aiCostFen',
   'expense:cloudflare':'infrastructureFen',
   'expense:domain':'infrastructureFen',
   'expense:infrastructure':'infrastructureFen',
   'expense:email':'operationsFen',
   'expense:operations':'operationsFen'
  };
  const suggested:Record<string,number>={};
  for(const [category,fen] of Object.entries(costSnapshot.byCategory)){
   const target=mapping[category];
   if(target&&Number.isSafeInteger(fen)&&fen>0)
    suggested[target]=(suggested[target]||0)+fen;
  }
  const targets=Object.keys(suggested).filter(key=>!String(amounts[key]||'').trim());
  if(!targets.length){
   setCostError('没有可填充的空白费用科目；已填写金额不会被覆盖，其他类别需要人工分类');
   return;
  }
  if(!window.confirm('仅向本月尚未填写的费用字段带入旧后台待核对的凭证参考数，不保存数据库、不进行审核或公开。继续？'))return;
  setAmounts(current=>{
   const next={...current};
   for(const key of targets)if(!String(current[key]||'').trim())next[key]=fmtFen(suggested[key]);
   return next;
  });
  setCostError('');
  setMessage('已从旧后台登记簿填入 '+targets.length+' 项费用参考数（未保存）。请逐笔核对凭证、会计期间和费用口径，并填写所有其他字段后再保存草稿。');
 };
 const load=(row:Row)=>{
  setCurrentRow(row);setPeriod(row.period);
  setAmounts(Object.fromEntries(fields.map(([,key])=>[key,fmtFen(row.draft?.[key])])));
  setBeneficiaries(row.draft?.beneficiaries===undefined?'':String(row.draft.beneficiaries));
  setNotes({basisNote:String(row.draft?.basisNote||''),methodNote:String(row.draft?.methodNote||''),
   poolNote:String(row.draft?.poolNote||''),privacyReviewNote:String(row.draft?.privacyReviewNote||'')});

  setMessage('已载入 '+row.period+' 记录。修订已发布数据时必须填写更正理由。');
 };
 const draft=()=>{
  const payload:Record<string,unknown>={period};
  for(const [,key] of fields){
   const num=parseFen(amounts[key]||'',key==='adjustmentsFen'||key==='netResultFen');
   if(num===null)throw Error('请完整填写金额（最多两位小数），如实际为零请填写0：'+key);
   payload[key]=num;
  }
  if(!/^\d{1,7}$/.test(beneficiaries))throw Error('请填写实际帮扶事项数量，尚无帮扶请填0');
  payload.beneficiaries=Number(beneficiaries);
  Object.assign(payload,notes,{isAudited:false});
  return payload;
 };
 const act=async(action:'draft'|'correction'|'review'|'publish')=>{
  if(busy)return;
  setBusy(true);setMessage('');
  try{
   const body:Record<string,unknown>={period};
   if(action==='draft'||action==='correction'){body.report=draft();if(action==='correction')body.correctionReason=correctionReason;}
   if(action==='review')Object.assign(body,confirmations,{reviewNote});
   if(action==='publish')body.confirmPublish=window.confirm('确认将该期经过审核的真实财务数据公开展示，并供已验证邮箱订阅者查阅？此操作会留下不可覆盖的历史记录。');
   if(action==='publish'&&body.confirmPublish!==true)return;
   const r=await fetch(endpoint('/'+action),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json() as {ok:boolean;code?:string};
   if(!r.ok||!data.ok)throw Error(data.code||'REQUEST_FAILED');
   setMessage(action==='review'?'已审核，但尚未公开。':action==='publish'?'已发布，可到公开页面查看。':'草稿已保存，尚未公开。');
   await refresh();
  }catch(e){setMessage('操作未完成：'+(e instanceof Error?e.message:'未知错误'));}
  finally{setBusy(false);}
 };


 const testFinanceEmail=async()=>{
  if(busy||!window.confirm('确认只向当前财务管理员邮箱发送一封内部测试邮件？这不会向订阅者发送邮件，也不会发布任何报告。'))return;
  setBusy(true);setMessage('');
  try{
   const r=await fetch(endpoint('/test-email'),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({confirmTestEmail:true})
   });
   const data=await r.json() as {ok:boolean;code?:string};
   if(!r.ok||!data.ok)throw Error(data.code||'TEST_EMAIL_FAILED');
   setMessage('内部测试邮件已提交至 Resend；请查收管理员收件箱并核对实际投递情况。');
   await refresh();
  }catch(e){setMessage('内部测试邮件未完成：'+(e instanceof Error?e.message:'未知错误'));}
  finally{setBusy(false);}
 };


 const publishedRow=status?.reports.find(row=>row.status==='published'&&row.published);
 const publishedSnapshot=publishedRow?.published;
 // Use only the last explicitly published snapshot. Draft or reviewed amounts are
 // never treated as confirmed financial results.
 const asPublishedFen=(key:string)=>{
  const value=publishedSnapshot?.[key];
  return typeof value==='number'&&Number.isSafeInteger(value)?value:null;
 };
 const money=(value:number|null)=>value===null?'—':new Intl.NumberFormat('zh-CN',{
  style:'currency',currency:'CNY',minimumFractionDigits:2
 }).format(value/100);
 const expenseKeys=['aiCostFen','infrastructureFen','personnelFen','operationsFen','taxesFen','otherCostFen'];
 const expenseValues=expenseKeys.map(asPublishedFen);
 const totalExpensesFen=expenseValues.every(value=>value!==null)?
  expenseValues.reduce<number>((sum,value)=>sum+(value??0),0):null;
 const overview=[
  {label:'营业收入',value:money(asPublishedFen('revenueFen')),detail:'未扣退款的营业收入'},
  {label:'经营费用合计',value:money(totalExpensesFen),detail:'AI、服务器、人员、运营、税费及其他，不含退款与调整项'},
  {label:'本期经营结果',value:money(asPublishedFen('netResultFen')),detail:'可为亏损，不等同于可分配利润'},
  {label:'依法确认的可分配利润',value:money(asPublishedFen('distributableProfitFen')),detail:'单独核定，不由月度净利自动推算'},
  {label:'40%帮扶池计提',value:money(asPublishedFen('poolAccrualFen')),detail:'制度计提，非实际资金划拨'},
  {label:'帮扶池期末余额',value:money(asPublishedFen('closingPoolFen')),detail:'期初＋实际入池－实际帮扶支出'}
 ];
 const draftCount=status?.reports.filter(row=>row.status==='draft').length??0;
 const reviewCount=status?.reports.filter(row=>row.status==='reviewed').length??0;

 return <Shell user={user}>
  <div className="hhba-fin-admin">
   <div className="hhba-fin-admin-crumb"><Link to="/transparency"><ArrowLeft size={14}/>返回公开财务中心</Link></div>
   <header><span className="hhba-fin-admin-eyebrow"><FileLock2 size={17}/> HHBA · PRIVATE FINANCE WORKSPACE</span>
    <h1>财务公开管理</h1><p>独立审阅、真实录入、修订留痕、审核后发布。未经认证不能读取或修改财务记录。</p>
   </header>
   {authError?<div className="hhba-fin-admin-locked" role="alert"><ShieldAlert size={20}/><p>{authError}<br/>本页不会提供绕过管理员身份验证的账号密码表单。</p></div>:
    !status?<div className="hhba-fin-admin-locked">正在验证财务后台身份和权限…</div>:
    <>
     <section className="hhba-fin-admin-overview" aria-labelledby="hhba-fin-admin-overview-title">
      <div className="hhba-fin-admin-overview-head">
       <div>
        <span className="hhba-fin-admin-overview-eyebrow">FINANCIAL OVERVIEW / VERIFIED DISCLOSURE</span>
        <h2 id="hhba-fin-admin-overview-title">财务总览</h2>
        <p>{publishedRow?'仅显示 '+publishedRow.period+'（V'+publishedRow.revision+'）已正式发布的月报数据。':'尚无任何已正式发布且核验的月报，以下金额不代表实际为零。'}</p>
       </div>
       <span className={'hhba-fin-admin-state'+(publishedRow?' is-published':'')}>
        {publishedRow?'最近一期已公开':'暂无已发布数据'}
       </span>
      </div>
      <div className="hhba-fin-admin-overview-grid">
       {overview.map(item=><div className="hhba-fin-admin-overview-metric" key={item.label}>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.detail}</small>
       </div>)}
      </div>
      <div className="hhba-fin-admin-overview-foot">
       <p><strong>审核进度：</strong>草稿 {draftCount} 期 · 已审核待公开 {reviewCount} 期 · 已公开 {status.reports.filter(row=>row.status==='published').length} 期</p>
       <p><strong>邮件状态：</strong>已验证订阅 {status.subscribers.verified||0} 人 · 待发送 {status.deliveries?.pending||0} 封 · 已发出 {status.deliveries?.sent||0} 封 · 失败 {status.deliveries?.failed||0} 封</p>
      </div>
      <p className="hhba-fin-admin-overview-note">金额以已发布月报快照为准；私人投资款与营业收入分别核算，帮扶池计提与实际到账严格区分。未披露的草稿不进入财务总览。</p>
     </section>
     <div className="hhba-fin-admin-cards">
      <div><span>已登录财务管理员</span><strong>{status.admin}</strong></div>
      <div><span>已发布报告</span><strong>{status.reports.filter(r=>r.status==='published').length}</strong></div>
      <div><span>已验证财报邮件订阅</span><strong>{status.subscribers.verified||0}</strong></div>
      <div><span>邮件订阅待验证</span><strong>{status.subscribers.pending||0}</strong></div>
      <div><span>月报邮件已发送</span><strong>{status.deliveries?.sent||0}</strong></div>
      <div><span>月报邮件发送失败</span><strong>{status.deliveries?.failed||0}</strong></div>
     </div>
     <section className="hhba-fin-admin-cost-source" aria-labelledby="finance-cost-source-title">
      <div className="hhba-fin-admin-cost-source-heading">
       <div>
        <span className="hhba-fin-admin-overview-eyebrow">ADMIN.HHBA.WORK / EVIDENCE REGISTER</span>
        <h2 id="finance-cost-source-title">旧后台成本登记簿 · 只读核对</h2>
       </div>
       <a href="https://admin.hhba.work/" target="_blank" rel="noopener noreferrer">打开原登记后台</a>
      </div>
      <p className="hhba-fin-admin-help">读取 admin.hhba.work 已有的 Cloudflare KV 凭证记录，自动识别冲销；不另存一份、不修改源账簿。该登记簿尚未自动完成银行、发票或供应商账单对账，不能直接作为正式月报发布依据。</p>
      <div className="hhba-fin-admin-cost-controls">
       <label>登记月份 <input type="month" value={costMonth} onChange={e=>{setCostMonth(e.target.value);setCostSnapshot(null);setCostError('');}}/></label>
       <button type="button" disabled={costBusy||!costMonth} onClick={()=>void loadCostRegister()}>{costBusy?'读取中…':'读取原有成本登记簿'}</button>
      </div>
      {costError&&<p className="hhba-fin-admin-cost-error" role="alert">{costError}</p>}
      {costSnapshot&&<div className="hhba-fin-admin-cost-result">
       {costSnapshot.totals?<div className="hhba-fin-admin-cost-totals">
        <div><span>本月登记收入</span><strong>{money(costSnapshot.totals.incomeFen)}</strong></div>
        <div><span>本月登记支出</span><strong>{money(costSnapshot.totals.expenseFen)}</strong></div>
        <div><span>登记差额（非净利润）</span><strong>{money(costSnapshot.totals.netFen)}</strong></div>
       </div>:<p className="hhba-fin-admin-cost-empty">该月未发现已保存的凭证登记，不能据此推断营业收入或成本为零。</p>}
       <p className="hhba-fin-admin-help">登记事件 {costSnapshot.eventsCount} 条，其中冲销 {costSnapshot.voidedCount} 条。以下均为待核对来源数据，草稿及公开月报不会被自动修改。</p>
       {costSnapshot.entries.length>0&&<div className="hhba-fin-admin-cost-table-wrap"><table className="hhba-fin-admin-cost-table">
        <thead><tr><th>日期</th><th>方向</th><th>类别</th><th>金额</th><th>凭证引用</th><th>状态</th></tr></thead>
        <tbody>{costSnapshot.entries.map(entry=><tr key={entry.id}>
         <td>{entry.day}</td><td>{entry.direction==='income'?'收入':'支出'}</td>
         <td>{costCategoryLabels[entry.category]||'未知'}</td><td>{money(entry.amountFen)}</td>
         <td>{entry.evidenceRef}</td><td>{entry.voided?'已冲销':'待对账'}</td>
        </tr>)}</tbody>
       </table></div>}
       <div className="hhba-fin-admin-actions">
        <button type="button" disabled={!costSnapshot.totals||period!==costSnapshot.month||currentRow?.status==='published'} onClick={prefillExpenseReferences}>把已登记费用作为草稿参考填入空白字段</button>
       </div>
       <p className="hhba-fin-admin-overview-note">只对 DeepSeek/AI、Cloudflare/域名/基础设施、邮件/运营等明确类别提出费用参考，不覆盖已填金额；客户收入、其他费用、退款、税费和利润必须人工核定。此操作不保存财务 D1，也不执行审核或发布。</p>
       <p className="hhba-fin-admin-overview-note">只读来源：旧管理站「财务成本」模块。请用实际凭证与财务账簿核对后再录入、审核、发布正式月报。原后台成本分类与新月报会计科目不完全相同，不能机械自动换算。</p>
      </div>}
     </section>
     <section className="hhba-fin-admin-review" aria-labelledby="finance-mail-smoke-title" style={{marginBottom:24}}>
      <h2 id="finance-mail-smoke-title">邮件通道验收</h2>
      <p className="hhba-fin-admin-help">仅向当前财务管理员本人发送一封测试邮件，不会公开财报、收集订阅或启动群发。每个管理员每 6 小时最多发起一次；真实到达情况需要在收件箱确认。</p>
      <p className="hhba-fin-admin-help">订阅：{status.subscriptionsEnabled?'已开放':'未开放'} · 月报批量发送：{status.sendEnabled?'已开启':'未开启'} · 上次测试：{status.lastTestEmailSentAt?new Date(status.lastTestEmailSentAt).toLocaleString('zh-CN'):'尚未发送'}</p>
      <div className="hhba-fin-admin-actions">
       <button type="button" disabled={busy} onClick={()=>void testFinanceEmail()}>向本人邮箱发送一封测试邮件</button>
      </div>
     </section>
     <div className="hhba-fin-admin-workspace">
      <aside>
       <div className="hhba-fin-admin-panel-title"><h2>财务报告记录</h2><button type="button" onClick={()=>{void refresh();}} aria-label="刷新报告"><RefreshCw size={16}/></button></div>
       {status.reports.length?status.reports.map(row=><button type="button" className={'hhba-fin-admin-history'+(currentRow?.period===row.period?' active':'')} key={row.period} onClick={()=>load(row)}>
        <strong>{row.period}</strong><span>{row.status==='published'?'已公开':row.status==='reviewed'?'已审核，待发布':'草稿'} · 第{row.revision}版</span>
       </button>):<p className="hhba-fin-admin-empty">尚无任何真实财务记录。</p>}
       <button className="hhba-fin-admin-create" type="button" onClick={()=>{setCurrentRow(null);setPeriod('');setAmounts(init());setBeneficiaries('');setNotes({basisNote:'',methodNote:'',poolNote:'',privacyReviewNote:''});setMessage('新建空白草稿，请全部按真实账目填写。');}}>＋ 新建月度报告</button>
      </aside>
      <section>
       <h2>真实月报录入与核验</h2>
       <p className="hhba-fin-admin-help">金额单位：人民币元。公开系统内部按分保存整数，禁止填入演示数据。即使金额为零，也须根据真实账目主动填写0。</p>
       <label>报告所属月份（YYYY-MM）<input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="YYYY-MM" maxLength={7}/></label>
       <div className="hhba-fin-admin-fields">
        {fields.map(([title,key])=><label key={key}>{title}<input inputMode="decimal" placeholder="按实际账目填写" value={amounts[key]||''} onChange={e=>setAmounts(v=>({...v,[key]:e.target.value}))}/></label>)}
       </div>
       <label>本月帮扶事项数量<input inputMode="numeric" placeholder="按照实际记录填写" value={beneficiaries} onChange={e=>setBeneficiaries(e.target.value)}/></label>
       {([['basisNote','依法可分配利润的认定及前期亏损、法定公积金等说明'],['methodNote','收入、成本、退款、费用与账务调整的计算口径'],['poolNote','权益帮扶池的资金流动、支出类别和期末余额说明'],['privacyReviewNote','公开前隐私、敏感案件资料和商业秘密复核结论']] as const).map(([key,title])=>
        <label key={key}>{title}<textarea rows={3} minLength={12} maxLength={3000} value={notes[key]} onChange={e=>setNotes(n=>({...n,[key]:e.target.value}))}/></label>)}
       <p className="hhba-fin-admin-help">独立财务审计证明上传和核验模块尚未启用，因此报告统一标记「未经独立审计」。本后台不能自行将报告标为已审计。</p>
       <label>已发布报告的更正理由（至少20字）<textarea rows={2} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label>
       <div className="hhba-fin-admin-actions">
        <button disabled={busy} onClick={()=>void act(currentRow?.status==='published'?'correction':'draft')}>保存{currentRow?.status==='published'?'更正':'草稿'}</button>
       </div>
       <div className="hhba-fin-admin-review">
        <h3>审核确认 · 不代表外部独立审计</h3>
        {([['ledgerReconciled','已与真实账目和付款/退款凭证核对'],['privacyReviewed','已逐项审查不泄露用户及员工隐私'],['legalDistributionBasisChecked','已核验公司法与可分配利润口径'],['noFabricationAttested','确认无模拟、推测或编造财务数字'],['auditEvidenceConfirmed','如标记已审计，确认具有真实审计证据']] as const).map(([key,title])=>
         <label key={key} className="hhba-fin-admin-checkbox"><input type="checkbox" checked={confirmations[key]} onChange={e=>setConfirmations(v=>({...v,[key]:e.target.checked}))}/>{title}</label>)}
        <label>审核理由与事实依据（至少30字）<textarea rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={1500}/></label>
        <div className="hhba-fin-admin-actions">
         <button disabled={busy||!currentRow} type="button" onClick={()=>void act('review')}><CheckCheck size={16}/>完成审核但不公开</button>
         <button disabled={busy||!currentRow} type="button" className="publish" onClick={()=>void act('publish')}>确认正式公开</button>
        </div>
       </div>
       {message&&<p className="hhba-fin-admin-message" role="status">{message}</p>}
      </section>
     </div>
    </>}
  </div>
 </Shell>;
}
