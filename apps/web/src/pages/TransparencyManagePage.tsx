import {useEffect,useState} from 'react';
import {ArrowLeft,CheckCheck,FileLock2,RefreshCw,ShieldAlert} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/transparency-admin.css';

type Row={period:string;status:string;revision:number;reviewedAt?:string|null;publishedAt?:string|null;
 correctionReason?:string|null;draft?:Record<string,string|number|boolean>};
type Status={ok:boolean;admin:string;reports:Row[];subscribers:Record<string,number>;deliveries:Record<string,number>;lastTestEmailSentAt:string|null;sendEnabled:boolean;subscriptionsEnabled:boolean};
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

 return <Shell user={user}>
  <div className="hhba-fin-admin">
   <div className="hhba-fin-admin-crumb"><Link to="/transparency"><ArrowLeft size={14}/>返回公开财务中心</Link></div>
   <header><span className="hhba-fin-admin-eyebrow"><FileLock2 size={17}/> HHBA · PRIVATE FINANCE WORKSPACE</span>
    <h1>财务公开管理</h1><p>独立审阅、真实录入、修订留痕、审核后发布。未经认证不能读取或修改财务记录。</p>
   </header>
   {authError?<div className="hhba-fin-admin-locked" role="alert"><ShieldAlert size={20}/><p>{authError}<br/>本页不会提供绕过管理员身份验证的账号密码表单。</p></div>:
    !status?<div className="hhba-fin-admin-locked">正在验证财务后台身份和权限…</div>:
    <>
     <div className="hhba-fin-admin-cards">
      <div><span>已登录财务管理员</span><strong>{status.admin}</strong></div>
      <div><span>已发布报告</span><strong>{status.reports.filter(r=>r.status==='published').length}</strong></div>
      <div><span>已验证财报邮件订阅</span><strong>{status.subscribers.verified||0}</strong></div>
      <div><span>邮件订阅待验证</span><strong>{status.subscribers.pending||0}</strong></div>
      <div><span>月报邮件已发送</span><strong>{status.deliveries?.sent||0}</strong></div>
      <div><span>月报邮件发送失败</span><strong>{status.deliveries?.failed||0}</strong></div>
     </div>
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
