import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Download,FileClock,FileText,Mail,ShieldCheck} from 'lucide-react';
import {TransparencyFrame} from './TransparencyFrame';
import {WORKER_ARCHIVE_DEMO_MODE,workerDemoMonths,workerDemoTotals,workerDemoCurrency} from './transparencyDemoData';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/transparency.css';
import '../styles/transparency-v5.css';

type Report={
 period:string;revision:number;publishedAt:string;correctedAt:string|null;
 openingPoolFen:number;poolAccrualFen:number;poolReceivedFen:number;poolSpentFen:number;closingPoolFen:number;
 beneficiaries:number;isAudited:boolean;
};
type PublicSettings={ok:boolean;subscriptionEnabled:boolean;siteKey:string|null;configured:boolean};
const yuan=(value:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2}).format(value/100);
const endpoint=(path:string)=>import.meta.env.BASE_URL+'api/transparency'+path;
const dateLabel=(period:string)=>period.replace('-', '年')+'月';
const publicDate=(raw:string)=>new Date(raw).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
const labelStatus=(report:Report)=>report.isAudited?'已标识审计，需核对证明':'内部编制，未经独立审计';

const poolOperations=[
 ['期初结余','openingPoolFen'],['本期计提','poolAccrualFen'],
 ['实际入池','poolReceivedFen'],['实际帮扶支出','poolSpentFen'],['期末结余','closingPoolFen']
] as const;

function OfficialTransparencyReportsPage({user}:{user:User|null}){
 const [settings,setSettings]=useState<PublicSettings|null>(null);
 const [reports,setReports]=useState<Report[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [selected,setSelected]=useState<string|null>(new URLSearchParams(window.location.search).get('period'));
 const [email,setEmail]=useState('');
 const [consent,setConsent]=useState(false);
 const [captchaToken,setCaptchaToken]=useState('');
 const [submitState,setSubmitState]=useState<'idle'|'sending'|'sent'|'failed'>('idle');
 const captchaRef=useRef<HTMLDivElement|null>(null);
 const widgetRef=useRef<string|null>(null);

 useEffect(()=>{
  let active=true;
  Promise.all([
   fetch(endpoint('/status'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('STATUS');return r.json() as Promise<PublicSettings>;}),
   fetch(endpoint('/reports'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('REPORTS');return r.json() as Promise<{ok:boolean;reports:Report[]}>;})
  ]).then(([config,history])=>{
   if(!active)return;
   setSettings(config);setReports(Array.isArray(history.reports)?history.reports:[]);
  }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);

 useEffect(()=>{
  if(!settings?.subscriptionEnabled||!settings.siteKey||!captchaRef.current)return;
  let alive=true;
  const draw=()=>{
   if(!alive||!captchaRef.current||widgetRef.current)return;
   const api=(window as unknown as {turnstile?:{render:(target:HTMLElement,opts:Record<string,unknown>)=>string;remove?:(id:string)=>void}}).turnstile;
   if(api)widgetRef.current=api.render(captchaRef.current,{
    sitekey:settings.siteKey,callback:(token:string)=>{if(alive)setCaptchaToken(token);},
    'expired-callback':()=>{if(alive)setCaptchaToken('');},
    'error-callback':()=>{if(alive)setCaptchaToken('');},
    theme:'light'
   });
  };
  let script=document.querySelector<HTMLScriptElement>('script[data-hhba-turnstile]');
  if(!script){
   script=document.createElement('script');
   script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   script.async=true;script.defer=true;script.dataset.hhbaTurnstile='true';
   document.head.appendChild(script);
  }
  script.addEventListener('load',draw);draw();
  return()=>{
   alive=false;script?.removeEventListener('load',draw);
   const api=(window as unknown as {turnstile?:{remove?:(id:string)=>void}}).turnstile;
   if(widgetRef.current)api?.remove?.(widgetRef.current);
   widgetRef.current=null;
  };
 },[settings?.subscriptionEnabled,settings?.siteKey]);

 const selectedReport=useMemo(()=>selected?reports.find(r=>r.period===selected)||null:null,[reports,selected]);
 const available=selectedReport||reports[0]||null;
 useEffect(()=>{
  if(loading||error||!selected||selectedReport)return;
  // A shared stale/malformed period must not make a non-empty archive look empty.
  setSelected(null);
  const url=new URL(window.location.href);
  url.searchParams.delete('period');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 },[loading,error,selected,selectedReport]);


 const openReport=(period:string)=>{
  setSelected(period);
  const url=new URL(window.location.href);
  url.searchParams.set('period',period);
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  document.getElementById('fin-latest-title')?.scrollIntoView({behavior:'smooth',block:'start'});
 };

 const subscribe=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!settings?.subscriptionEnabled||!consent||!captchaToken||submitState==='sending')return;
  setSubmitState('sending');
  try{
   const response=await fetch(endpoint('/subscribe'),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.trim(),consent,turnstileToken:captchaToken})
   });
   if(!response.ok)throw Error('SUBSCRIBE');
   setSubmitState('sent');setEmail('');setConsent(false);
  }catch{setSubmitState('failed');}
  finally{setCaptchaToken('');}
 };

 useEffect(()=>{
  const hash=decodeURIComponent(window.location.hash.slice(1));
  if(!['fin-latest-title','hhba-fin-history-title','fin-subscribe-title'].includes(hash))return;
  const frame=requestAnimationFrame(()=>{
   const target=document.getElementById(hash);
   const details=target?.closest('details');if(details)details.open=true;
   target?.scrollIntoView({block:'start'});
  });
  return()=>cancelAnimationFrame(frame);
 },[]);
 return <Shell user={user}>
  <div className="hhba-transparency hhba-responsibility hhba-v5-report" id="financial-disclosure-content">
   <div className="hhba-transparency-crumb">
    <Link to="/transparency"><ArrowLeft size={14} aria-hidden="true"/>返回公开中心</Link>
    <span>公开档案 / 月度财务报告</span>
   </div>
   <header className="hhba-v5-report-heading">
    <span className="hhba-fin-eyebrow">HHBA / FINANCIAL REPORTS</span>
    <h1>月度帮扶资金报告</h1>
    <p>只公开劳动者权益帮扶池的月度入池、支出与结余，不披露企业订单、营业收入、成本或内部利润。</p>
   </header>
   <section className="hhba-fin-report-section" aria-labelledby="fin-latest-title">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">03 / PUBLIC REPORT</span>
      <h2 id="fin-latest-title">最新帮扶资金报告</h2>
      <p>月度帮扶池资金变动及其公开依据。</p>
     </div>
     {available&&<button type="button" className="hhba-fin-print" onClick={()=>window.print()}><Download size={15} aria-hidden="true"/>打印或保存 PDF</button>}
    </div>

    {loading?<div className="hhba-fin-empty" role="status">正在读取已发布的帮扶资金报告…</div>:
     error?<div className="hhba-fin-empty" role="alert">帮扶资金公开数据暂时不可读取，请稍后重试。此时不展示未经核实的金额或报告状态。</div>:
     !available?<div className="hhba-resp-empty-report" role="status">
      <div className="hhba-resp-empty-icon"><FileClock size={21} aria-hidden="true"/></div>
      <div><strong>首期帮扶资金报告尚未发布</strong>
       <p>完成真实账目核对、必要审批及隐私检查后，将在这里公开月度帮扶池收支。</p>
       <small>未披露的数据不代表没有实际收支或帮扶。</small>
      </div>
      <span className="hhba-resp-awaiting">待发布</span>
     </div>:
          <div className="hhba-fin-report">
      <header className="hhba-fin-report-header">
       <div>
        <span className="hhba-fin-report-type">HHBA WORKER SUPPORT FUND REPORT</span>
        <h3>{dateLabel(available.period)}劳动者权益帮扶资金报告</h3>
        <p>公开日期：{publicDate(available.publishedAt)}　版本：V{available.revision}　审核属性：{labelStatus(available)}</p>
       </div>
       <span className="hhba-fin-report-state">已发布</span>
      </header>
      <section className="hhba-fin-report-summary" aria-label="本期帮扶池资金指标">
       <h4>资金摘要</h4>
       <dl className="hhba-fin-kpis">
        <div><dt>本期应计提</dt><dd>{yuan(available.poolAccrualFen)}</dd></div>
        <div><dt>实际入池</dt><dd>{yuan(available.poolReceivedFen)}</dd></div>
        <div><dt>本期支出</dt><dd>{yuan(available.poolSpentFen)}</dd></div>
        <div><dt>期末结余</dt><dd>{yuan(available.closingPoolFen)}</dd></div>
       </dl>
      </section>
      <div className="hhba-fin-panels">
       <section>
        <h4>劳动者权益帮扶池月度收支明细</h4>
        <table><tbody>{poolOperations.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{yuan(available[key])}</td></tr>)}
         <tr><th scope="row">本期支持事项</th><td>{available.beneficiaries} 项</td></tr>
        </tbody></table>
       </section>
      </div>
      <section className="hhba-fin-report-notes">
       <h4>披露口径和审核属性</h4>
       <p>“应计提”与“实际入池”分别核算，资金池余额并非企业经营收入。比例计算原则及用途审批规则请参阅公开制度。</p>
       <p>{available.isAudited?'本期标记经审计，相关证明仍须核验。':'由经营方审核发布，未经独立财务审计。'}</p>
       {available.correctedAt&&<p>本期报告存在修订记录，版本号与更正日期应保留可追溯信息。</p>}
      </section>
     </div>}
   </section>

   <div className="hhba-resp-secondary">
    <details className="hhba-resp-disclosure-detail">
     <summary><span><FileText size={18} aria-hidden="true"/>历史披露档案</span><span className="hhba-resp-detail-label">{reports.length?reports.length+' 期报告':'首期待发布'} <ArrowRight size={16} aria-hidden="true"/></span></summary>
   <section className="hhba-fin-history" aria-labelledby="hhba-fin-history-title">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">03 / ARCHIVE</span>
      <h2 id="hhba-fin-history-title">历史披露档案</h2>
      <p>按月份查询已公开的报告及其修订版本。</p>
     </div>
    </div>
    {!reports.length?<div className="hhba-fin-no-history"><FileText size={18} aria-hidden="true"/>暂无正式公开的月度报告。首期报告发布后，将在这里持续保留历史记录。</div>:
     <div className="hhba-fin-history-table">
      <table aria-label="已公开的历史月度财务报告">
       <thead><tr><th scope="col">报告期间</th><th scope="col">公开日期</th><th scope="col">版本 / 审核属性</th><th scope="col">操作</th></tr></thead>
       <tbody>{reports.map(item=><tr key={item.period} className={available?.period===item.period?'is-current':undefined}>
        <th scope="row">{dateLabel(item.period)}</th>
        <td>{publicDate(item.publishedAt)}</td>
        <td>V{item.revision} · {labelStatus(item)}</td>
        <td><button type="button" onClick={()=>openReport(item.period)} aria-label={'查看'+dateLabel(item.period)+'经营报告'}>查看报告 <ArrowRight size={15} aria-hidden="true"/></button></td>
       </tr>)}</tbody>
      </table>
     </div>}
   </section>

    </details>
    <details className="hhba-resp-disclosure-detail">
     <summary><span><Mail size={18} aria-hidden="true"/>帮扶资金报告邮件订阅</span><span className="hhba-resp-detail-label">{settings?.subscriptionEnabled?'自愿订阅':'尚未开放'} <ArrowRight size={16} aria-hidden="true"/></span></summary>
   <section className="hhba-fin-subscribe" aria-labelledby="fin-subscribe-title">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">04 / EMAIL UPDATES</span>
      <h2 id="fin-subscribe-title">财务报告邮件订阅</h2>
      <p>自愿、免费订阅每月帮扶资金公开信息。</p>
     </div>
    </div>
    <div className="hhba-fin-subscribe-body">
     <div className="hhba-fin-subscribe-description">
      <Mail size={22} aria-hidden="true"/>
      <h3>每月21日 · 帮扶资金公开信</h3>
      <p>完成邮箱验证后，如有审核通过并正式发布的上月帮扶资金报告，将向订阅者发送摘要与公开报告链接。</p>
      <p>未发布或未通过审核的报告不会生成邮件，也不会填充模拟经营数字。</p>
      <p className="hhba-fin-subtle">邮箱仅用于财务报告订阅，不与招聘营销邮件捆绑。可以随时通过邮件退订。</p>
     </div>
     <div className="hhba-fin-subscribe-panel">
      {settings?.subscriptionEnabled?
       <form onSubmit={subscribe}>
        <label htmlFor="hhba-fin-email">邮箱地址</label>
        <input id="hhba-fin-email" type="email" required maxLength={180} autoComplete="email" placeholder="请输入接收财务报告的邮箱"
         value={email} onChange={event=>setEmail(event.target.value)}/>
        <label className="hhba-fin-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我自愿订阅月度财务公开信，并同意仅为发送及管理本项订阅处理该邮箱；我可以随时退订。</span></label>
        <div ref={captchaRef} className="hhba-fin-turnstile"/>
        <button type="submit" disabled={!consent||!captchaToken||submitState==='sending'}>{submitState==='sending'?'正在提交…':'发送邮箱验证邮件'}</button>
        {submitState==='sent'&&<p role="status">如符合条件，验证邮件已发送。请查收并点击确认链接后订阅才生效。</p>}
        {submitState==='failed'&&<p role="alert">暂时无法提交，请稍后再试。</p>}
       </form>:
       <div className="hhba-fin-subscribe-disabled"><ShieldCheck size={20} aria-hidden="true"/><strong>邮件订阅功能尚未开放</strong><p>验证邮箱、发送服务及相关配置尚需完成核验。当前不会收集订阅邮箱；财务报告仍可免费公开查阅。</p></div>}
     </div>
    </div>
   </section>

    </details>
   </div>
   <footer className="hhba-fin-foot">
    <p>披露说明：本报告属于经营方自主公开资料，不能等同于独立审计。个人信息及原始银行凭据不直接公开。报告如有更正，将保留修订记录。</p>
    <Link to="/transparency/rules">公开制度与监督 <ArrowRight size={14} aria-hidden="true"/></Link>
   </footer>
  </div>
 </Shell>;
}

export function TransparencyReportsPage({user}:{user:User|null}){
 return WORKER_ARCHIVE_DEMO_MODE?<DemoTransparencyReportsPage user={user}/>:<OfficialTransparencyReportsPage user={user}/>;
}
function DemoTransparencyReportsPage({user}:{user:User|null}){
 const [selected,setSelected]=useState(()=>new URLSearchParams(window.location.search).get('period')||workerDemoMonths[0].period);
 const [hovered,setHovered]=useState<number|null>(null);
 const current=workerDemoMonths.find(m=>m.period===selected)||workerDemoMonths[0];
 const points=workerDemoMonths.slice().reverse().map((m,i)=>({month:m.period,amount:m.closing,x:30+i*310,y:162-m.closing/Math.max(1,workerDemoTotals.received)*130}));
 const path=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const pick=(period:string)=>{setSelected(period);const u=new URL(window.location.href);u.searchParams.set('period',period);window.history.replaceState(window.history.state,'',u.pathname+u.search+u.hash);};
 return <TransparencyFrame user={user} section="月度帮扶资金报告" title="月度帮扶资金报告" description="按月查阅资金池的期初结余、当期入池、权益支持支出和期末结余，不展示公司经营账本。">
  <section className="hhba-v5-content-section" aria-labelledby="fin-latest-title">
   <div className="hhba-v5-section-label"><span>01 / MONTHLY FUND REPORT</span><h2 id="fin-latest-title">月度资金变动</h2><p>选择月份查看公开明细，汇总与资金收支档案来自同一份记录。</p></div>
   <div className="hhba-v6-month-list" role="group" aria-label="选择月度报告">{workerDemoMonths.map(m=><button type="button" key={m.period} aria-pressed={current.period===m.period} onClick={()=>pick(m.period)}><span>{m.period.replace('-','年')+'月'} · 帮扶资金报告</span><ArrowRight size={16}/></button>)}</div>
   <div className="hhba-v6-month-detail">
    <h3>{current.period.replace('-','年')+'月'} · 资金明细</h3>
    <dl>
     <div><dt>期初结余</dt><dd>{workerDemoCurrency(current.opening)}</dd></div>
     <div><dt>当月入池</dt><dd>{workerDemoCurrency(current.received)}</dd></div>
     <div><dt>当月支出</dt><dd>{workerDemoCurrency(current.spent)}</dd></div>
     <div><dt>期末结余</dt><dd>{workerDemoCurrency(current.closing)}</dd></div>
    </dl>
    <Link className="hhba-v5-text-link" to={'/transparency/funds'}>查询对应月份的逐笔资金收支 <ArrowRight size={15}/></Link>
   </div>
  </section>
  <section className="hhba-v5-content-section" aria-labelledby="v6-fund-trend-title">
   <div className="hhba-v5-section-label"><span>02 / FUND TREND</span><h2 id="v6-fund-trend-title">资金结余变化</h2><p>将月度期末结余连成曲线，可悬停查看每个月的余额。</p></div>
   <div className="hhba-v6-chart"><svg viewBox="0 0 720 190" role="img" aria-label="月度资金结余趋势折线图">
    <path d="M30 30H690 M30 96H690 M30 162H690" fill="none" stroke="#e4ebf4" strokeWidth="1"/>
    <path d={path} fill="none" stroke="#176fdc" strokeWidth="3" strokeLinejoin="round"/>
    {points.map((p,i)=><circle key={p.month} cx={p.x} cy={p.y} r={hovered===i?8:6} fill="#ff9b2f" stroke="#fff" strokeWidth="2" tabIndex={0} onMouseEnter={()=>setHovered(i)} onFocus={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}><title>{p.month} · {workerDemoCurrency(p.amount)}</title></circle>)}
   </svg><div className="hhba-v6-chart-caption"><span>2026 年 9 月</span><strong>{hovered===null?'期末结余：'+workerDemoCurrency(workerDemoTotals.balance):points[hovered].month+' · '+workerDemoCurrency(points[hovered].amount)}</strong><span>2026 年 11 月</span></div></div>
  </section>
  <section className="hhba-v5-content-section" aria-labelledby="hhba-fin-history-title">
   <div className="hhba-v5-section-label"><span>03 / FUND HISTORY</span><h2 id="hhba-fin-history-title">历史月份与资金档案</h2><p>每月数据按照同一口径归档。查看具体支出及相应案例，请进入收支档案。</p></div>
   <div className="hhba-v5-table-scroll"><table className="hhba-v5-table" aria-label="月度帮扶资金历史报告">
    <thead><tr><th>月份</th><th>当月入池</th><th>当月支出</th><th>期末结余</th></tr></thead>
    <tbody>{workerDemoMonths.map(m=><tr key={m.period}><th scope="row">{m.period.replace('-','年')+'月'}</th><td>{workerDemoCurrency(m.received)}</td><td>{workerDemoCurrency(m.spent)}</td><td>{workerDemoCurrency(m.closing)}</td></tr>)}</tbody></table></div>
  </section>
  <section id="fin-subscribe-title" className="hhba-v5-content-section" aria-label="月度帮扶资金公开信"><h2>公开信与监督</h2><p>正式发布的资金报告可以通过公开档案持续查询；邮件订阅仍按实际服务启用状态开放。</p><Link className="hhba-v5-text-link" to="/transparency/rules">查看审核与公开制度 <ArrowRight size={15}/></Link></section>
 </TransparencyFrame>;
}
