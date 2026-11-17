import {useEffect,useState} from 'react';
import {ArrowRight,FileClock,WalletCards,Search} from 'lucide-react';
import {WORKER_ARCHIVE_DEMO_MODE,workerDemoLedger,workerDemoTotals,workerDemoMonths,workerDemoCurrency} from './transparencyDemoData';
import {TransparencyFrame} from './TransparencyFrame';
import {Link} from '../router';
import type {User} from '../services/api';

type MonthlyReport={period:string;poolReceivedFen:number;poolSpentFen:number;closingPoolFen:number;publishedAt:string};
type LedgerEntry={id:string;period:string;date:string;kind:'inflow'|'outflow';amountFen:number;purpose:string;caseId:string|null};
type State='loading'|'ready'|'not_ready'|'error';
const endpoint=(path:string)=>import.meta.env.BASE_URL+'api/transparency'+path;
const yuan=(fen:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2}).format(fen/100);
const periodLabel=(period:string)=>period.replace('-','年')+'月';

function OfficialTransparencyFundsPage({user}:{user:User|null}){
 const [reports,setReports]=useState<MonthlyReport[]>([]);
 const [reportState,setReportState]=useState<'loading'|'ready'|'error'>('loading');
 const [entries,setEntries]=useState<LedgerEntry[]>([]);
 const [ledgerState,setLedgerState]=useState<State>('loading');
 const [caseId,setCaseId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 useEffect(()=>{
  let active=true;
  fetch(endpoint('/reports'),{cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('REPORTS_FAILED');return res.json() as Promise<{ok:boolean;reports:MonthlyReport[]}>;})
   .then(data=>{if(!active)return;if(data.ok!==true||!Array.isArray(data.reports))throw Error('INVALID_REPORTS');
     setReports(data.reports);setReportState('ready');})
   .catch(()=>{if(active)setReportState('error');});
  fetch(endpoint('/ledger'),{cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('LEDGER_FAILED');return res.json() as Promise<{ok:boolean;state:string;entries:LedgerEntry[]}>;})
   .then(data=>{if(!active)return;
    if(data.ok!==true||(data.state!=='ready'&&data.state!=='not_ready')||(data.state==='ready'&&!Array.isArray(data.entries)))throw Error('INVALID_LEDGER');
    setEntries(data.state==='ready'?data.entries:[]);setLedgerState(data.state as State);})
   .catch(()=>{if(active)setLedgerState('error');});
  return()=>{active=false;};
 },[]);
 const displayed=caseId?entries.filter(item=>item.caseId===caseId):entries;
 const clearFilter=()=>{
  setCaseId(null);
  const url=new URL(window.location.href);url.searchParams.delete('case');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 };
 return <TransparencyFrame user={user} section="资金收支档案" title="资金收支档案" description="把月度资金汇总与经单独审核可公开的逐笔记录分开呈现，不把部分公开明细当作完整流水。">
  <section className="hhba-v5-content-section" aria-labelledby="v5-fund-summary-title">
   <div className="hhba-v5-section-label"><span>01 / MONTHLY FUND SUMMARY</span><h2 id="v5-fund-summary-title">月度帮扶池收支汇总</h2><p>官方金额只来自已发布月报，区分实际入池、已发生支出和期末余额。</p></div>
   {reportState==='loading'?<div className="hhba-v5-empty" role="status"><FileClock size={22}/><strong>正在读取已发布报告…</strong></div>:
    reportState==='error'?<div className="hhba-v5-empty" role="alert"><FileClock size={22}/><strong>月度资金汇总暂时无法核验</strong><p>读取失败时不展示推测金额。</p></div>:
    !reports.length?<div className="hhba-v5-empty"><WalletCards size={22}/><strong>暂无已发布的月度资金报告</strong><p>未发布不代表零收入、零支出或零帮扶。真实账目经核验发布后才会显示在这里。</p></div>:
    <div className="hhba-v5-table-scroll"><table className="hhba-v5-table" aria-label="已发布月报的权益帮扶池收支"><thead><tr><th>月份</th><th>实际入池</th><th>实际支出</th><th>期末结余</th><th>完整月报</th></tr></thead><tbody>{reports.map(item=><tr key={item.period}><th scope="row">{periodLabel(item.period)}</th><td>{yuan(item.poolReceivedFen)}</td><td>{yuan(item.poolSpentFen)}</td><td>{yuan(item.closingPoolFen)}</td><td><Link to={'/transparency/reports?period='+encodeURIComponent(item.period)+'#fin-latest-title'}>查看月报 <ArrowRight size={14}/></Link></td></tr>)}</tbody></table></div>}
  </section>
  <section className="hhba-v5-content-section" aria-labelledby="v5-fund-entries-title">
   <div className="hhba-v5-section-label"><span>02 / REVIEWED INDIVIDUAL ENTRIES</span><h2 id="v5-fund-entries-title">逐笔可公开收支明细</h2><p>仅展示已核验付款、隐私审查和发布审批的事项；这可能只是实际收支的一部分。</p></div>
   {caseId&&<div className="hhba-v5-active-filter"><span>正在查找与案件 {caseId} 关联的公开记录</span><button type="button" onClick={clearFilter}>清除筛选</button></div>}
   {ledgerState==='loading'?<div className="hhba-v5-empty" role="status"><FileClock size={22}/><strong>正在读取逐笔公开记录…</strong></div>:
    ledgerState==='error'?<div className="hhba-v5-empty" role="alert"><FileClock size={22}/><strong>逐笔公开记录暂时无法核验</strong><p>请稍后重试。接口故障不能解释为没有发生过支出。</p></div>:
    ledgerState==='not_ready'?<div className="hhba-v5-empty"><WalletCards size={22}/><strong>逐笔资金公开数据库尚未启用</strong><p>尚未完成独立迁移和发布核验，当前没有可对外披露的逐笔数据。</p></div>:
    !displayed.length?<div className="hhba-v5-empty"><WalletCards size={22}/><strong>{caseId?'没有该案件关联的已公开支出':'暂无经审核允许公开的逐笔记录'}</strong><p>这不代表实际没有支出；不能据此推算资金池余额或帮扶结果。</p></div>:
    <div className="hhba-v5-table-scroll"><table className="hhba-v5-table" aria-label="经审核允许公开的资金明细"><thead><tr><th>日期 / 编号</th><th>公开用途</th><th>类型</th><th>金额</th><th>关联案例</th></tr></thead><tbody>{displayed.map(item=><tr key={item.id}><td>{item.date}<small className="hhba-v5-table-id">{item.id}</small></td><td>{item.purpose}</td><td>{item.kind==='inflow'?'实际入池':'实际支出'}</td><td>{yuan(item.amountFen)}</td><td>{item.caseId?<Link to={'/transparency/cases?case='+encodeURIComponent(item.caseId)}>查看案例 <ArrowRight size={14}/></Link>:'—'}</td></tr>)}</tbody></table></div>}
   <p className="hhba-v5-slim-note">完整资金汇总以月报为准。本页不发布原始银行流水或未经授权的个人资料；公开交易明细不能替代正式财务账本。</p>
  </section>
 </TransparencyFrame>;
}
export function TransparencyFundsPage({user}:{user:User|null}){
 return WORKER_ARCHIVE_DEMO_MODE?<DemoTransparencyFundsPage user={user}/>:<OfficialTransparencyFundsPage user={user}/>;
}
function DemoTransparencyFundsPage({user}:{user:User|null}){
 const [kind,setKind]=useState<'全部'|'入池'|'支出'>('全部');
 const [query,setQuery]=useState('');
 const [period,setPeriod]=useState('全部月份');
 const [caseId,setCaseId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 const filtered=workerDemoLedger.filter(item=>(kind==='全部'||(kind==='入池'?item.amount>0:item.amount<0))&&
  (period==='全部月份'||item.date.startsWith(period))&&(!caseId||item.caseId===caseId)&&
  [item.id,item.date,item.name,item.caseId||''].some(v=>v.toLowerCase().includes(query.toLowerCase().trim()))).slice().reverse();
 const clearCase=()=>{setCaseId(null);const url=new URL(window.location.href);url.searchParams.delete('case');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);};
 return <TransparencyFrame user={user} section="帮扶资金收支档案" title="帮扶资金收支档案" description="公开资金入池、实际支出、结余变化与对应的权益支持项目，支持按月份和案件编号追溯。">
  <div className="hhba-v6-kpi-row">
   <div><small>累计入池</small><strong>{workerDemoCurrency(workerDemoTotals.received)}</strong></div>
   <div><small>累计支出</small><strong>{workerDemoCurrency(workerDemoTotals.spent)}</strong></div>
   <div><small>资金结余</small><strong>{workerDemoCurrency(workerDemoTotals.balance)}</strong></div>
  </div>
  <section className="hhba-v5-content-section" aria-labelledby="v6-ledger-title">
   <div className="hhba-v5-section-label"><span>FUND LEDGER / 收支台账</span><h2 id="v6-ledger-title">资金明细查询</h2><p>资金进出逐笔列示，带有案件编号的支出可以直接打开对应的案例档案。</p></div>
   <div className="hhba-v5-case-controls">
    <label className="hhba-v5-search"><Search size={17}/><input aria-label="搜索资金记录" value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入用途、编号或关联案件"/></label>
    <div className="hhba-v5-case-filters" role="group" aria-label="按资金类型筛选">{(['全部','入池','支出'] as const).map(k=><button type="button" key={k} onClick={()=>setKind(k)} className={kind===k?'active':''}>{k}</button>)}</div>
    <div className="hhba-v5-case-filters" role="group" aria-label="按月份筛选">{['全部月份',...workerDemoMonths.map(m=>m.period)].map(p=><button type="button" key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p==='全部月份'?p:p.replace('-','年')+'月'}</button>)}</div>
    {caseId&&<div className="hhba-v5-active-filter"><span>当前仅显示案件 {caseId} 的关联收支</span><button type="button" onClick={clearCase}>清除案件筛选</button></div>}
   </div>
   <p className="hhba-v5-result-count">符合条件的资金记录：{filtered.length} 笔</p>
   <div className="hhba-v5-table-scroll"><table className="hhba-v5-table" aria-label="劳动者权益帮扶池收支明细">
    <thead><tr><th>资金日期 / 编号</th><th>资金用途</th><th>类型</th><th>金额</th><th>关联案例</th></tr></thead>
    <tbody>{filtered.map(item=><tr key={item.id}><td>{item.date}<small className="hhba-v5-table-id">{item.id}</small></td><td>{item.name}</td><td>{item.amount>=0?'资金入池':'权益支持支出'}</td><td>{item.amount>0?'+':'−'}{workerDemoCurrency(Math.abs(item.amount))}</td>
     <td>{item.caseId?<Link to={'/transparency/cases?case='+encodeURIComponent(item.caseId)}>查看案例 <ArrowRight size={14}/></Link>:'—'}</td>
    </tr>)}
    {!filtered.length&&<tr><td colSpan={5}>没有符合筛选条件的记录。</td></tr>}</tbody>
   </table></div>
  </section>
  <section className="hhba-v5-content-section" aria-labelledby="v6-funds-monthly-title">
   <div className="hhba-v5-section-label"><span>MONTHLY SUMMARY / 月度核对</span><h2 id="v6-funds-monthly-title">月度资金归档</h2><p>按月份查阅期初、入池、支出与期末结余，更多说明进入月度帮扶资金报告。</p></div>
   <div className="hhba-v5-table-scroll"><table className="hhba-v5-table" aria-label="月度资金收支汇总"><thead><tr><th>月份</th><th>资金入池</th><th>资金支出</th><th>期末结余</th><th>查看报告</th></tr></thead>
    <tbody>{workerDemoMonths.map(m=><tr key={m.period}><th scope="row">{m.period.replace('-','年')+'月'}</th><td>{workerDemoCurrency(m.received)}</td><td>{workerDemoCurrency(m.spent)}</td><td>{workerDemoCurrency(m.closing)}</td><td><Link to={'/transparency/reports?period='+encodeURIComponent(m.period)}>查看明细 <ArrowRight size={14}/></Link></td></tr>)}</tbody></table></div>
  </section>
  <p className="hhba-v5-slim-note">资金池的来源、支出和结余与企业经营收入是不同的统计口径；个人身份与原始付款凭据不直接公开。</p>
 </TransparencyFrame>;
}
