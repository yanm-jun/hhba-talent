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
type PublicArchiveState='loading'|'ready'|'not_ready'|'error';
type PublicCase={id:string;title:string;category:string;stage:string;summary:string;processSummary:string;outcomeSummary:string;publishedAt:string;revisedAt:string|null};
type PublicLedgerEntry={id:string;period:string;date:string;kind:'inflow'|'outflow';amountFen:number;purpose:string;caseId:string|null};
const officialCategories=['全部类型','工资与薪酬','劳动合同与用工','工时休假','离职与补偿','社保与工伤','争议处理与证据'];

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
 const [publicCases,setPublicCases]=useState<PublicCase[]>([]);
 const [casesState,setCasesState]=useState<PublicArchiveState>('loading');
 const [caseCategory,setCaseCategory]=useState('全部类型');
 const [expandedCaseId,setExpandedCaseId]=useState<string|null>(null);
 const [publishedLedger,setPublishedLedger]=useState<PublicLedgerEntry[]>([]);
 const [ledgerState,setLedgerState]=useState<PublicArchiveState>('loading');
 const [ledgerCaseId,setLedgerCaseId]=useState<string|null>(null);
 const filteredCases=publicCases.filter(item=>caseCategory==='全部类型'||item.category===caseCategory);
 const visibleEntries=publishedLedger.filter(item=>!ledgerCaseId||item.caseId===ledgerCaseId);

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
  let active=true;
  const loadCases=async()=>{
   try{
    const response=await fetch(endpoint('/cases'),{cache:'no-store'});
    if(!response.ok)throw new Error('CASES_READ_FAILED');
    const data=await response.json() as {ok?:boolean;state?:string;cases?:PublicCase[]};
    if(!active)return;
    if(data.ok!==true)throw new Error('CASES_INVALID');
    setPublicCases(data.state==='ready'&&Array.isArray(data.cases)?data.cases:[]);
    setCasesState(data.state==='ready'?'ready':'not_ready');
   }catch{if(active)setCasesState('error');}
  };
  const loadLedger=async()=>{
   try{
    const response=await fetch(endpoint('/ledger'),{cache:'no-store'});
    if(!response.ok)throw new Error('LEDGER_READ_FAILED');
    const data=await response.json() as {ok?:boolean;state?:string;entries?:PublicLedgerEntry[]};
    if(!active)return;
    if(data.ok!==true)throw new Error('LEDGER_INVALID');
    setPublishedLedger(data.state==='ready'&&Array.isArray(data.entries)?data.entries:[]);
    setLedgerState(data.state==='ready'?'ready':'not_ready');
   }catch{if(active)setLedgerState('error');}
  };
  void loadCases();
  void loadLedger();
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


 const jumpToPublicCase=(id:string)=>{
  setCaseCategory('全部类型');
  setExpandedCaseId(id);
  document.getElementById('public-case-register')?.scrollIntoView({behavior:'smooth',block:'start'});
 };

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
    <p>资金收支、帮扶案例、月度报告与公开制度，进入同一个公开中心查阅。</p>
    <div className="hhba-resp-hero-meta">
     <span><ShieldCheck size={14} aria-hidden="true"/> 企业自愿公开</span>
     <span><CalendarDays size={14} aria-hidden="true"/> 月度报告计划每月21日披露</span>
    </div>
   </header>
   <nav className="hhba-resp-open-index" aria-label="公开信息中心四大目录">
    <div className="hhba-resp-open-index-heading"><span className="hhba-fin-section-index">PUBLIC RECORDS / 公开中心</span><strong>从这里找到需要查阅的记录</strong><p>正式公开资料与功能演示分开管理；尚未发布的信息不展示模拟数值。</p></div>
    <div className="hhba-resp-open-index-list">
     <a href="#public-case-register"><span className="hhba-resp-index-number">01</span><span><strong>帮扶案例公开档案</strong><small>授权公开、隐私审核、个案进展</small></span><span className="hhba-resp-index-state">{casesState==='loading'?'读取中':casesState==='error'?'暂不可用':casesState==='not_ready'?'待开放':publicCases.length?publicCases.length+' 份已公开':'暂无正式案例'}</span><ArrowRight size={18} aria-hidden="true"/></a>
     <a href="#public-fund-register"><span className="hhba-resp-index-number">02</span><span><strong>资金收支档案</strong><small>按已发布报告查询入池与支出</small></span><span className="hhba-resp-index-state">{loading?'读取中':error?'暂不可用':reports.length?reports.length+' 期报告':'尚无报告'}</span><ArrowRight size={18} aria-hidden="true"/></a>
     <a href="#fin-latest-title"><span className="hhba-resp-index-number">03</span><span><strong>月度财务报告</strong><small>经营收支、可分配利润和报告修订</small></span><span className="hhba-resp-index-state">{loading?'读取中':error?'暂不可用':reports.length?reports.length+' 期公开':'待发布'}</span><ArrowRight size={18} aria-hidden="true"/></a>
     <a href="#public-policy-monitor"><span className="hhba-resp-index-number">04</span><span><strong>公开制度与监督</strong><small>60/40 分配原则、信息保护与更正</small></span><span className="hhba-resp-index-state">公开说明</span><ArrowRight size={18} aria-hidden="true"/></a>
    </div>
   </nav>

   <section id="public-case-register" className="hhba-resp-public-register" aria-labelledby="public-case-register-title">
    <div className="hhba-resp-public-register-heading"><span className="hhba-fin-section-index">01 / VERIFIED CASE RECORDS</span><h2 id="public-case-register-title">帮扶案例公开档案</h2><p>这里只收录经事实核对、必要授权和脱敏审核后可对外公开的真实案例，不能用演示情景填充。</p></div>
    {casesState==='ready'&&publicCases.length>0?
     <div className="hhba-resp-published-cases">
      <div className="hhba-resp-case-filter" role="group" aria-label="筛选真实已公开案例">{officialCategories.map(name=><button key={name} type="button" onClick={()=>setCaseCategory(name)} className={caseCategory===name?'active':''}>{name}{name==='全部类型'?' · '+publicCases.length:''}</button>)}</div>
      <p className="hhba-resp-published-count">已公开并审核的案例 {filteredCases.length} 件。每份仅展示经确认可公开的脱敏摘要。</p>
      {filteredCases.map(record=><details key={record.id} id={'public-case-'+record.id} className="hhba-resp-public-case-item" open={expandedCaseId===record.id}>
       <summary onClick={event=>{event.preventDefault();setExpandedCaseId(current=>current===record.id?null:record.id);}}>
        <span className="hhba-resp-public-case-id">{record.id}</span>
        <span className="hhba-resp-public-case-title"><strong>{record.title}</strong><small>{record.category} · {record.stage} · 公开于 {record.publishedAt.slice(0,10)}</small></span>
        <ArrowRight size={17} aria-hidden="true"/>
       </summary>
       <div className="hhba-resp-public-case-body">
        <h3>案件事实摘要</h3><p>{record.summary}</p>
        <h3>处理经过与支持事项</h3><p>{record.processSummary}</p>
        <h3>阶段结果及公开边界</h3><p>{record.outcomeSummary}</p>
        <div className="hhba-resp-case-ops"><span>{record.revisedAt?'最近修订：'+record.revisedAt.slice(0,10):'原始公开版本'}</span>
         <button type="button" onClick={()=>{setLedgerCaseId(record.id);document.getElementById('public-fund-register')?.scrollIntoView({behavior:'smooth',block:'start'});}}>核对关联的已公开支出 <ArrowRight size={14}/></button>
        </div>
       </div>
      </details>)}
      {!filteredCases.length&&<p className="hhba-resp-case-no-match">当前分类没有已公开案例，请选择其他类别。</p>}
     </div>:
     <div className="hhba-resp-case-empty">
      <div className="hhba-resp-case-empty-icon"><FileClock size={22} aria-hidden="true"/></div>
      <div><strong>{casesState==='ready'?'暂无通过公开审核的案例档案':casesState==='loading'?'正在读取公开案例…':casesState==='not_ready'?'真实案例公开数据库尚未开通':'暂时无法核验公开案例'}</strong>
       <p>{casesState==='ready'?'本中心目前没有可公开查阅的真实个案。未来开放后，将按案件编号、权益类别和处理状态检索。':casesState==='not_ready'?'该公开数据表尚未完成独立核验与启用，目前不对外展示任何假定数量或案例。':casesState==='error'?'案件目录暂时不可读取。请稍后重试，不能把接口故障解释为零案件。':'仅显示经过授权、事实复核与脱敏审查的真实档案。'}</p>
       <small>暂无公开记录不代表企业未接到申请，也不代表已完成任何实际帮扶。</small>
      </div><span>{casesState==='ready'?'待公开':casesState==='loading'?'读取中':'未开放'}</span>
     </div>}
    <div className="hhba-resp-case-taxonomy"><strong>计划使用的案件分类</strong><div><span>工资与薪酬</span><span>劳动合同与用工</span><span>工时休假</span><span>离职与补偿</span><span>社保与工伤</span><span>争议处理与证据</span></div></div>
    <div className="hhba-resp-demo-direction"><div><span>PRODUCT DEMONSTRATION / 单独演示环境</span><strong>想了解将来正式档案会怎样查阅？</strong><p>可体验 28 份明确标注为虚构的模拟案例，测试分类、搜索、九章节档案及资金关联。所有人员、争议、金额和结果均非真实业务。</p></div><Link to="/transparency/archive-preview?view=cases">查看模拟档案体验 <ArrowRight size={16} aria-hidden="true"/></Link></div>
   </section>

   <section id="public-fund-register" className="hhba-resp-public-register" aria-labelledby="public-fund-register-title">
    <div className="hhba-resp-public-register-heading"><span className="hhba-fin-section-index">02 / PUBLISHED FUND RECORDS</span><h2 id="public-fund-register-title">资金收支公开档案</h2><p>按已正式发布的月报追踪权益帮扶池的计提、实际入池、实际支出与期末结余。当前仅披露月报能够支持的数据，不虚构逐笔银行交易。</p></div>
    {loading?<div className="hhba-fin-empty" role="status">正在读取已公开的资金记录…</div>:error?<div className="hhba-fin-empty" role="alert">目前无法核验资金公开记录，请稍后再试。此处不显示推测金额。</div>:!reports.length?
     <div className="hhba-resp-case-empty hhba-resp-case-empty-fund"><div className="hhba-resp-case-empty-icon"><FileClock size={22} aria-hidden="true"/></div><div><strong>暂无已发布的资金收支报告</strong><p>首期报告完成真实账目核对、授权审核及发布程序后，此处才会出现对应的资金收支摘要。</p><small>未发布不等于资金池余额为零；演示页面中的模拟金额不会出现在这里。</small></div><span>待发布</span></div>:
     <div className="hhba-resp-fund-ledger"><table aria-label="正式发布报告中的资金收支摘要"><thead><tr><th>披露月份</th><th>实际入池</th><th>实际支出</th><th>期末结余</th><th>操作</th></tr></thead><tbody>{reports.map(item=><tr key={item.period}><th scope="row">{dateLabel(item.period)}</th><td>{yuan(item.poolReceivedFen)}</td><td>{yuan(item.poolSpentFen)}</td><td>{yuan(item.closingPoolFen)}</td><td><button type="button" onClick={()=>openReport(item.period)}>查看报告 <ArrowRight size={14} aria-hidden="true"/></button></td></tr>)}</tbody></table><p>以上为月度汇总，不是逐笔银行交易清单。每笔正式支出只有经过凭据核对、个人信息保护和公开审批后，才能另行发布可公开的明细。</p></div>}
    <div className="hhba-resp-line-item-public">
     <div className="hhba-resp-public-register-heading"><h3>逐笔可公开收支明细</h3><p>仅列出另外通过付款核对、个人信息保护及审批的项目；可能只是月度收支的一部分，完整资金汇总始终以已发布月报为准。</p></div>
     {ledgerCaseId&&<div className="hhba-resp-ledger-active-filter"><span>正在查看关联案件：{ledgerCaseId}</span><button type="button" onClick={()=>setLedgerCaseId(null)}>清除筛选</button></div>}
     {ledgerState==='ready'&&visibleEntries.length?
      <div className="hhba-resp-fund-ledger"><table aria-label="经审查允许公开的个别资金记录"><thead><tr><th>记录日期 / 编号</th><th>公开用途</th><th>收支</th><th>金额</th><th>相关案例</th></tr></thead><tbody>{visibleEntries.map(item=><tr key={item.id}>
       <td>{item.date}<small className="hhba-resp-ledger-entry-id">{item.id}</small></td>
       <td>{item.purpose}</td><td>{item.kind==='inflow'?'实际入池':'实际支出'}</td>
       <td>{yuan(item.amountFen)}</td>
       <td>{item.caseId?<button type="button" onClick={()=>jumpToPublicCase(item.caseId!)}>{item.caseId} <ArrowRight size={13}/></button>:'—'}</td>
      </tr>)}</tbody></table>
       <p>逐笔公开为经审查后自愿披露的摘要，不等同于完整银行流水，不能直接将此表求和代替月报。</p>
      </div>:
      <div className="hhba-resp-case-empty hhba-resp-ledger-empty">
       <div className="hhba-resp-case-empty-icon"><FileClock size={19} aria-hidden="true"/></div>
       <div><strong>{ledgerState==='loading'?'正在核对逐笔公开数据…':ledgerState==='not_ready'?'逐笔资金公开数据库尚未开通':ledgerState==='error'?'逐笔公开数据暂时无法读取':ledgerCaseId?'未找到该案件关联的已公开支出':'暂无通过审核的逐笔公开记录'}</strong><p>该区不展示模拟资金，也不推断尚未公开或未审核的付款记录。</p></div>
      </div>}
    </div>
    <a className="hhba-resp-fund-textlink" href="#fin-latest-title">查看财务报告中的完整核算依据 <ArrowRight size={15} aria-hidden="true"/></a>
   </section>

   <nav className="hhba-resp-jump hhba-resp-detail-nav" aria-label="补充公开资料目录">
    <a href="#responsibility-support">个人资金支持</a>
    <a href="#financial-allocation">利润分配规则</a>
    <a href="#fin-latest-title">最新月报</a>
    <a href="#public-policy-monitor">监督与更正</a>
   </nav>

   <section className="hhba-resp-support" aria-labelledby="responsibility-support">
    <div className="hhba-resp-section-heading">
     <span className="hhba-fin-section-index">01 / INDIVIDUAL INVESTMENT</span>
     <div className="hhba-resp-heading-row"><h2 id="responsibility-support">个人投资支持</h2><span className="hhba-resp-statement-tag">企业自主披露</span></div>
    </div>
    <div className="hhba-resp-capital">
     <div className="hhba-resp-capital-number">
      <span>HHBA 经营方披露的个人资金支持</span>
      <strong aria-label="人民币六十万元">¥600,000</strong>
      <small>人民币陆拾万元整</small>
     </div>
     <div className="hhba-resp-capital-detail">
      <span className="hhba-resp-theme-mark">INDIVIDUAL BACKING</span>
      <h3>一份来自个人投资者的支持</h3>
      <p>HHBA 经营方披露：已获得个人投资者提供的人民币 60 万元资金支持，用于推动职业服务平台的持续建设。</p>
      <p className="hhba-resp-capital-disclosure">该笔资金由个人提供，不属于投资人任职机构或任何 ESG 基金的机构投资，不代表相关机构与 HHBA 存在投资、认证或背书关系。投资人身份与协议细节未经双方同意不对外公开。</p>
     </div>
    </div>
    <p className="hhba-resp-legal-note">说明：以上金额及性质为 HHBA 经营方自主披露，尚未经独立第三方鉴证。个人投资资金与营业收入、可分配利润分别核算，不直接参与下方 60/40 利润分配。劳动者权益帮扶是 HHBA 自身的经营承诺，不代表任何基金或 ESG 机构的官方认证。</p>
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

   <section id="public-policy-monitor" className="hhba-resp-public-register hhba-resp-policy-section" aria-labelledby="public-policy-monitor-title">
    <div className="hhba-resp-public-register-heading"><span className="hhba-fin-section-index">04 / DISCLOSURE & SUPERVISION</span><h2 id="public-policy-monitor-title">公开制度与监督</h2><p>公开必须可核验、可解释、可更正；涉及劳动者个人信息时以必要、适度和充分脱敏为前提。</p></div>
    <div className="hhba-resp-policy-rows">
     <div><span>01</span><div><strong>资金分配与核算口径</strong><p>企业 60%、权益帮扶池 40% 的分配基础是依法核算后确认的可分配利润，而非订单金额或营业收入。月报分别记录应计提、实际划拨与支出。</p><a href="#financial-allocation">查看利润分配规则 <ArrowRight size={14} aria-hidden="true"/></a></div></div>
     <div><span>02</span><div><strong>案例公开审核与隐私保护</strong><p>真实案例须经过授权、事实核验和脱敏审核，优先公开问题类别、处理阶段及可核验的支持内容。身份、劳动合同原件、银行账户及律师保密材料不得默认公开。</p></div></div>
     <div><span>03</span><div><strong>纠错、修订与历史留存</strong><p>公开信息有变化时应标记修改日期、说明更正原因，并保留可追溯的版本信息。尚未完成审核的资料不显示为已发布成果。</p><a href="#fin-latest-title">查看已发布报告与修订信息 <ArrowRight size={14} aria-hidden="true"/></a></div></div>
    </div>
    <Link className="hhba-resp-policy-rules-link" to="/membership/rules">查看会员与劳动权益服务规则 <ArrowRight size={16} aria-hidden="true"/></Link>
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
