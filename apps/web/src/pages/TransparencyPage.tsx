import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,Download,FileClock,FileText,Mail,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/transparency.css';

type Report={
 period:string;revision:number;publishedAt:string;correctedAt:string|null;
 revenueFen:number;refundFen:number;aiCostFen:number;infrastructureFen:number;
 personnelFen:number;operationsFen:number;taxesFen:number;otherCostFen:number;
 adjustmentsFen:number;netResultFen:number;distributableProfitFen:number;
 companyAllocationFen:number;poolAccrualFen:number;openingPoolFen:number;
 poolReceivedFen:number;poolSpentFen:number;closingPoolFen:number;beneficiaries:number;
 basisNote:string;methodNote:string;poolNote:string;privacyReviewNote:string;isAudited:boolean;
};
type PublicSettings={ok:boolean;subscriptionEnabled:boolean;siteKey:string|null;configured:boolean};
const yuan=(value:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2}).format(value/100);
const endpoint=(path:string)=>import.meta.env.BASE_URL+'api/transparency'+path;
const dateLabel=(period:string)=>period.replace('-', '年')+'月';
const publicDate=(raw:string)=>new Date(raw).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
const labelStatus=(report:Report)=>report.isAudited?'已标识审计，需核对证明':'内部编制，未经独立审计';
const operations=[
 ['营业收入','revenueFen'],['退款及冲减','refundFen'],
 ['AI模型及调用成本','aiCostFen'],['服务器与存储','infrastructureFen'],
 ['人员成本','personnelFen'],['经营管理费用','operationsFen'],
 ['相关税费','taxesFen'],['其他成本费用','otherCostFen'],
 ['账务调整（可正负）','adjustmentsFen'],['本期经营结果','netResultFen']
] as const;
const poolOperations=[
 ['期初结余','openingPoolFen'],['本期计提','poolAccrualFen'],
 ['实际入池','poolReceivedFen'],['实际帮扶支出','poolSpentFen'],['期末结余','closingPoolFen']
] as const;

export function TransparencyPage({user}:{user:User|null}){
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

 const available=useMemo(()=>selected?reports.find(r=>r.period===selected)||null:reports[0]||null,[reports,selected]);

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

 return <Shell user={user}>
  <div className="hhba-transparency hhba-responsibility" id="financial-disclosure-content">
   <div className="hhba-transparency-crumb">
    <Link to="/"><ArrowLeft size={14} aria-hidden="true"/>返回 HHBA 首页</Link>
    <span>公开信息 / 责任与透明</span>
   </div>
   <header className="hhba-resp-hero">
    <span className="hhba-fin-eyebrow">HHBA <span aria-hidden="true">/</span> RESPONSIBILITY & TRANSPARENCY</span>
    <h1>责任与透明</h1>
    <p>公开我们的承诺，也公开承诺如何兑现。</p>
    <div className="hhba-resp-hero-meta">
     <span><ShieldCheck size={14} aria-hidden="true"/> 企业自愿公开</span>
     <span><CalendarDays size={14} aria-hidden="true"/> 月度报告计划每月21日披露</span>
    </div>
   </header>
   <nav className="hhba-resp-jump" aria-label="责任与透明目录">
    <a href="#responsibility-support">资金支持</a>
    <a href="#financial-allocation">利润分配</a>
    <a href="#fin-latest-title">公开报告</a>
   </nav>

   <section className="hhba-resp-support" aria-labelledby="responsibility-support">
    <div className="hhba-resp-section-heading">
     <span className="hhba-fin-section-index">01 / RESPONSIBLE CAPITAL</span>
     <div className="hhba-resp-heading-row"><h2 id="responsibility-support">责任投资支持</h2><span className="hhba-resp-statement-tag">企业自主披露</span></div>
    </div>
    <div className="hhba-resp-capital">
     <div className="hhba-resp-capital-number">
      <span>HHBA 声明已获得的责任投资支持资金</span>
      <strong aria-label="人民币六十万元">¥600,000</strong>
      <small>人民币陆拾万元整</small>
     </div>
     <div className="hhba-resp-capital-detail">
      <span className="hhba-resp-theme-mark">ESG <i aria-hidden="true">/</i> LABOR RIGHTS</span>
      <h3>聚焦劳动者权益的责任投资合作</h3>
      <p>HHBA 经营方披露：已与聚焦 ESG、劳工权益方向的责任投资方建立合作关系，并获得人民币 60 万元资金支持。</p>
      <p className="hhba-resp-capital-disclosure">合作机构名称、相关协议及品牌标识目前未对外公开。此处是 HHBA 自有主题文字标识，不是外部机构官方 Logo。</p>
     </div>
    </div>
    <p className="hhba-resp-legal-note">说明：该支持信息为 HHBA 企业自述，尚未经独立第三方鉴证，不代表获得 ESG 官方认证或机构公开背书。投资资金与营业收入、可分配利润分别核算，不直接参与以下 60/40 分配。</p>
   </section>

   <section className="hhba-fin-split hhba-resp-allocation" aria-labelledby="financial-allocation">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">02 / OUR COMMITMENT</span>
      <h2 id="financial-allocation">我们的利润分配承诺</h2>
      <p>让企业发展与劳动者权益支持拥有清晰、可追溯的规则。</p>
     </div>
    </div>
    <div className="hhba-fin-allocation-body">
     <div className="hhba-fin-allocation-table" role="group" aria-label="依法核算后可分配利润的60/40分配原则">
      <div><span>企业发展部分</span><strong>60%</strong><small>经营发展、团队激励及依法合规的经营者收益</small></div>
      <div><span>劳动者权益帮扶池</span><strong>40%</strong><small>按照另行公开的规则，专款用于劳动者权益帮扶</small></div>
     </div>
     <div className="hhba-fin-allocation-notes">
      <h3>计算及适用口径</h3>
      <p>上述比例以依法核算、履行必要程序后的<strong>可分配利润</strong>为基础，不以营业收入、订单金额或月度流水直接计算。</p>
      <p>月报会区分「应计提金额」「实际入池金额」「已发生支出」「期末结余」。没有依法确定的可分配利润时，不虚构当期计提。</p>
      <p>该制度不构成保险赔付承诺，也不是消费者的个人可提现资金账户。</p>
     </div>
    </div>
   </section>

   <section className="hhba-fin-report-section" aria-labelledby="fin-latest-title">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">03 / PUBLIC REPORT</span>
      <h2 id="fin-latest-title">最新财务报告</h2>
      <p>月度经营情况及劳动者权益帮扶资金收支。</p>
     </div>
     {available&&<button type="button" className="hhba-fin-print" onClick={()=>window.print()}><Download size={15} aria-hidden="true"/>打印或保存 PDF</button>}
    </div>

    {loading?<div className="hhba-fin-empty" role="status">正在读取公开财务报告…</div>:
     error?<div className="hhba-fin-empty" role="alert">财务公开数据暂时不可读取，请稍后重试。此时不展示未经核实的金额或报告状态。</div>:
     !available?<div className="hhba-resp-empty-report" role="status">
      <div className="hhba-resp-empty-icon"><FileClock size={21} aria-hidden="true"/></div>
      <div><strong>首期财务报告尚未发布</strong>
       <p>完成真实账目核对、必要审批和隐私检查后，将在这里发布月度经营与劳动者权益帮扶收支。</p>
       <small>未披露的数据不代表零收入、零支出或零帮扶。</small>
      </div>
      <span className="hhba-resp-awaiting">待发布</span>
     </div>:
          <div className="hhba-fin-report">
      <header className="hhba-fin-report-header">
       <div>
        <span className="hhba-fin-report-type">HHBA MONTHLY OPERATING REPORT</span>
        <h3>{dateLabel(available.period)}经营与劳动者权益帮扶报告</h3>
        <p>公开日期：{publicDate(available.publishedAt)}　版本：V{available.revision}　审核属性：{labelStatus(available)}</p>
       </div>
       <span className="hhba-fin-report-state">已发布</span>
      </header>
      <section className="hhba-fin-report-summary" aria-label="本期关键财务指标">
       <h4>报告摘要</h4>
       <dl className="hhba-fin-kpis">
        <div><dt>营业收入</dt><dd>{yuan(available.revenueFen)}</dd></div>
        <div><dt>本期经营结果</dt><dd>{yuan(available.netResultFen)}</dd></div>
        <div><dt>经确认的可分配利润</dt><dd>{yuan(available.distributableProfitFen)}</dd></div>
        <div><dt>本期帮扶池计提</dt><dd>{yuan(available.poolAccrualFen)}</dd></div>
       </dl>
      </section>
      <div className="hhba-fin-panels">
       <section>
        <h4>一、经营收支明细</h4>
        <table><tbody>{operations.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{yuan(available[key])}</td></tr>)}</tbody></table>
        <p>{available.methodNote}</p>
       </section>
       <section>
        <h4>二、劳动者权益帮扶池</h4>
        <table><tbody>{poolOperations.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{yuan(available[key])}</td></tr>)}
         <tr><th scope="row">本期帮扶事项</th><td>{available.beneficiaries} 项</td></tr>
        </tbody></table>
        <p>{available.poolNote}</p>
       </section>
      </div>
      <section className="hhba-fin-report-notes">
       <h4>三、核算依据与披露说明</h4>
       <p>{available.basisNote}</p>
       <p>{available.privacyReviewNote}</p>
       <p>企业分配部分：{yuan(available.companyAllocationFen)}；权益帮扶池计提：{yuan(available.poolAccrualFen)}。实际划拨与计提金额分别披露，不能混同。</p>
       <p>{available.isAudited?'本报告标记具有审计确认，相关审计证明仍须单独核实。':'本报告由经营方编制、审核，未经独立财务审计。'}</p>
       {available.correctedAt&&<p>本报告已有修订版本，原版本保留在历史披露记录中。</p>}
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
     <summary><span><Mail size={18} aria-hidden="true"/>财务报告邮件订阅</span><span className="hhba-resp-detail-label">{settings?.subscriptionEnabled?'自愿订阅':'尚未开放'} <ArrowRight size={16} aria-hidden="true"/></span></summary>
   <section className="hhba-fin-subscribe" aria-labelledby="fin-subscribe-title">
    <div className="hhba-fin-section-heading">
     <div>
      <span className="hhba-fin-section-index">04 / EMAIL UPDATES</span>
      <h2 id="fin-subscribe-title">财务报告邮件订阅</h2>
      <p>自愿、免费订阅每月财务公开信息。</p>
     </div>
    </div>
    <div className="hhba-fin-subscribe-body">
     <div className="hhba-fin-subscribe-description">
      <Mail size={22} aria-hidden="true"/>
      <h3>每月21日 · 财务公开信</h3>
      <p>完成邮箱验证后，如有审核通过并正式发布的上月经营报告，将向订阅者发送摘要与公开报告链接。</p>
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
    <p>披露说明：本中心提供企业自愿公开的经营及帮扶汇总资料，不代表独立财务审计或证券市场法定披露。为保护员工、消费者及受助劳动者隐私，原始银行流水、个人付款凭据和个案资料不对外公开。报告如有更正，将保留修订记录。</p>
    <Link to="/membership/rules">会员与劳动权益服务规则 <ArrowRight size={14} aria-hidden="true"/></Link>
   </footer>
  </div>
 </Shell>;
}
