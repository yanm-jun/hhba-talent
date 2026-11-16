import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpenCheck,CalendarDays,Download,FileClock,FileText,HeartHandshake,Mail,ShieldCheck,TrendingUp} from 'lucide-react';
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
const source=(period:string)=>'/transparency?period='+encodeURIComponent(period);
const operations=[
 ['营业收入','revenueFen'],['退款及冲减','refundFen'],
 ['AI及模型调用','aiCostFen'],['服务器与存储','infrastructureFen'],
 ['人员费用','personnelFen'],['运营管理','operationsFen'],
 ['相关税费','taxesFen'],['其他成本费用','otherCostFen'],
 ['账务调整（可正负）','adjustmentsFen'],['本期经营结果','netResultFen']
] as const;
const dateLabel=(period:string)=>period.replace('-', '年')+'月';
const labelStatus=(r:Report)=>r.isAudited?'已提供审计确认':'管理方汇总 · 未经独立审计';

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
  <div className="hhba-transparency">
   <div className="hhba-transparency-crumb"><Link to="/"><ArrowLeft size={14}/>返回汇方职场首页</Link><span>HHBA · 财务公开</span></div>
   <header className="hhba-transparency-hero">
    <div className="hhba-fin-eyebrow"><BookOpenCheck size={17}/> HHBA · FINANCIAL TRANSPARENCY</div>
    <h1>财务透明中心</h1>
    <p>让商业创造的价值，也能回到劳动者身边。</p>
    <div className="hhba-transparency-metadata">
     <span><CalendarDays size={15}/>计划每月21日公开上月经营报告</span>
     <span className="hhba-fin-status">{reports.length?'已有公开报告':'首期报告尚未发布'}</span>
    </div>
    <div className="hhba-fin-hero-disclaimer">仅公开经过审核的真实财务汇总。经营报告不等于审计报告；尚未公布的数据不填充为零，也不会使用模拟经营数字。</div>
   </header>

   <section className="hhba-fin-split" aria-labelledby="financial-allocation">
    <div>
     <span className="hhba-fin-eyebrow">OUR COMMITMENT · 公开分配原则</span>
     <h2 id="financial-allocation">依法核算后，公开透明分配。</h2>
     <p>60/40是依法确认可分配利润后的制度原则，并非营业流水或单笔付款的直接分账。没有依法确认可分配利润时，不虚构帮扶池计提。</p>
    </div>
    <div>
     <div className="hhba-fin-percent-grid">
      <div><strong>60%</strong><span>企业发展</span></div>
      <div><strong>40%</strong><span>劳动者权益帮扶池</span></div>
     </div>
     <div className="hhba-fin-percent-bar" aria-label="企业60%、权益帮扶池40%"><span/><span/></div>
    </div>
   </section>

   <section className="hhba-fin-report-section" aria-labelledby="fin-latest-title">
    <div className="hhba-fin-section-heading">
     <div><span className="hhba-fin-eyebrow">MONTHLY PUBLIC REPORT</span><h2 id="fin-latest-title">月度经营与权益帮扶报告</h2></div>
     {available&&<button type="button" className="hhba-fin-print" onClick={()=>window.print()}><Download size={15}/>打印或保存PDF</button>}
    </div>
    {loading?<div className="hhba-fin-empty" role="status">正在读取公开财务报告…</div>:
     error?<div className="hhba-fin-empty">财务公开数据暂时不可读取，请稍后重试。不会展示猜测金额。</div>:
     !available?<div className="hhba-fin-empty"><FileClock size={29} color="#619371"/>
      <h3>首期财务报告尚未发布</h3>
      <p>我们计划在每月21日公布上月经审核的经营及帮扶情况。只有数据核验与负责人批准后才发布；如报告延迟，将保持「未发布」状态。</p>
      <p className="hhba-fin-subtle">收入、成本、利润、帮扶池收支均未填入假数据。</p>
     </div>:
     <div className="hhba-fin-report">
      <div className="hhba-fin-report-header">
       <div><span>正式公开报告 · {labelStatus(available)}</span><h3>{dateLabel(available.period)}经营与劳动者权益帮扶</h3><p>发布于 {new Date(available.publishedAt).toLocaleDateString('zh-CN')} · 版本 {available.revision}</p></div>
       <strong>数据公开</strong>
      </div>
      <div className="hhba-fin-kpis">
       <div><span>营业收入</span><strong>{yuan(available.revenueFen)}</strong></div>
       <div><span>经营结果</span><strong>{yuan(available.netResultFen)}</strong></div>
       <div><span>依法确认的可分配利润</span><strong>{yuan(available.distributableProfitFen)}</strong></div>
       <div><span>本期帮扶池计提</span><strong>{yuan(available.poolAccrualFen)}</strong></div>
      </div>
      <div className="hhba-fin-panels">
       <div><h4><TrendingUp size={17}/>经营收支明细</h4>
        <table><tbody>
         {operations.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{yuan(available[key])}</td></tr>)}
        </tbody></table>
        <p>{available.methodNote}</p>
       </div>
       <div><h4><HeartHandshake size={17}/>劳动者帮扶池</h4>
        <table><tbody>
         {([['期初结余','openingPoolFen'],['本期计提','poolAccrualFen'],['实际入池','poolReceivedFen'],['本期帮扶支出','poolSpentFen'],['期末结余','closingPoolFen']] as const).map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{yuan(available[key])}</td></tr>)}
         <tr><th scope="row">本期帮扶事项数量</th><td>{available.beneficiaries}项</td></tr>
        </tbody></table>
        <p>{available.poolNote}</p>
       </div>
      </div>
      <div className="hhba-fin-report-notes">
       <h4>核算依据与披露说明</h4>
       <p>{available.basisNote}</p><p>{available.privacyReviewNote}</p>
       <p>本期企业部分：{yuan(available.companyAllocationFen)}；劳动者权益池计提：{yuan(available.poolAccrualFen)}。实际划拨以「实际入池」为准，不与计提混为一谈。</p>
       <p>{available.isAudited?'此报告已标识有外部审计确认，请核对报告所附证据。':'本报告由经营方编制并审核，未经独立财务审计。'}</p>
       {available.correctedAt&&<p>本报告存在已公布的修订版，原版本依旧可通过历史记录查询。</p>}
      </div>
     </div>}
   </section>

   <section className="hhba-fin-history" aria-labelledby="hhba-fin-history-title">
    <div className="hhba-fin-section-heading"><div><span className="hhba-fin-eyebrow">HISTORY ARCHIVE</span><h2 id="hhba-fin-history-title">历史公开报告</h2></div></div>
    {!reports.length?<div className="hhba-fin-no-history"><FileText size={18}/>暂无已发布的月度报告，待首期报告通过审核后开放历史查询。</div>:
     <div className="hhba-fin-history-grid">
      {reports.map(item=><button key={item.period} type="button" onClick={()=>{setSelected(item.period);window.scrollTo({top:document.querySelector('.hhba-fin-report-section')?.getBoundingClientRect().top!+window.scrollY-70,behavior:'smooth'});}}
       className={'hhba-fin-history-item'+(available?.period===item.period?' is-current':'')}>
       <FileText size={18}/><span>{dateLabel(item.period)}报告<small>版本{item.revision} · {labelStatus(item)}</small></span><ArrowRight size={16}/></button>)}
     </div>}
   </section>

   <section className="hhba-fin-subscribe" aria-labelledby="fin-subscribe-title">
    <div><span className="hhba-fin-eyebrow">MONTHLY EMAIL LETTER</span>
     <h2 id="fin-subscribe-title"><Mail size={21}/>每月21日财务公开信</h2>
     <p>免费、自愿订阅。经邮箱验证后，每月21日如有经审核发布的上月报告，将发送摘要和公开链接；没有通过审核的报告不会伪造或提前发送。</p>
     <p className="hhba-fin-subtle">邮箱仅用于本项财务报告订阅，不与求职营销名单捆绑。邮件内提供独立退订入口。</p>
    </div>
    <div className="hhba-fin-subscribe-panel">
     {settings?.subscriptionEnabled?
      <form onSubmit={subscribe}>
       <label htmlFor="hhba-fin-email">接收邮箱</label>
       <input id="hhba-fin-email" type="email" required maxLength={180} autoComplete="email" placeholder="请输入邮箱地址"
        value={email} onChange={event=>setEmail(event.target.value)}/>
       <label className="hhba-fin-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我自愿订阅月度财务公开信，同意HHBA为发送及管理订阅处理该邮箱；可通过邮件随时退订。</span></label>
       <div ref={captchaRef} className="hhba-fin-turnstile"/>
       <button type="submit" disabled={!consent||!captchaToken||submitState==='sending'}>{submitState==='sending'?'正在提交…':'验证邮箱并订阅'}</button>
       {submitState==='sent'&&<p role="status">如符合条件，验证邮件已发送。请查收并点击确认链接后订阅才生效。</p>}
       {submitState==='failed'&&<p role="alert">暂时无法提交，请稍后再试。</p>}
      </form>:
      <div className="hhba-fin-subscribe-disabled"><ShieldCheck size={20}/><strong>邮件订阅系统正在准备</strong><p>验证服务与发送域名未完成配置之前，不会收集您的邮箱。财报公开页面仍可免费查看。</p></div>}
    </div>
   </section>

   <footer className="hhba-fin-foot">
    <p>财务透明不等于公开员工工资、用户支付记录、律师案件证据或商业机密。仅发布经过隐私核验的财务汇总数据；如发现报告错误，应记录修订日期、原因并保留历史版本。</p>
    <Link to="/membership/rules">查看会员与劳动权益服务规则 <ArrowRight size={14}/></Link>
   </footer>
  </div>
 </Shell>;
}
