import {useEffect,useState} from 'react';
import {ArrowRight,FileClock,WalletCards} from 'lucide-react';
import {TransparencyFrame} from './TransparencyFrame';
import {Link} from '../router';
import type {User} from '../services/api';

type MonthlyReport={period:string;poolReceivedFen:number;poolSpentFen:number;closingPoolFen:number;publishedAt:string};
type LedgerEntry={id:string;period:string;date:string;kind:'inflow'|'outflow';amountFen:number;purpose:string;caseId:string|null};
type State='loading'|'ready'|'not_ready'|'error';
const endpoint=(path:string)=>import.meta.env.BASE_URL+'api/transparency'+path;
const yuan=(fen:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',minimumFractionDigits:2}).format(fen/100);
const periodLabel=(period:string)=>period.replace('-','年')+'月';

export function TransparencyFundsPage({user}:{user:User|null}){
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