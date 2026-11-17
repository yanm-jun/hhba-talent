import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Landmark,LockKeyhole,Search,ShieldCheck,X} from 'lucide-react';
import {Shell} from '../components/Shell';
import {aidArchiveProfiles,type DemoCaseProfile} from './aidArchiveProfiles';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/aidArchiveDemo.css';

type AidCase=DemoCaseProfile & {id:string;title:string;date:string;status:'已完成'|'处理中';expense:number};
const expenseSamples=[1200,800,930,600,540,450,430,400,380,360,350,330,320,300,280,260,250,240,230];
const caseTitles=[
 "离职后工资未结清",
 "未签订书面劳动合同",
 "节假日加班工资争议",
 "试用期工资差额",
 "绩效工资扣减争议",
 "离职工资结算延期",
 "解除劳动合同补偿争议",
 "劳动关系证明不足",
 "工时记录不完整",
 "年休假待遇争议",
 "报酬支付周期争议",
 "加班审批与工资核算",
 "外包岗位劳动关系咨询",
 "企业扣款规则争议",
 "调岗降薪协商问题",
 "社会保险缴纳咨询",
 "离职交接与结算争议",
 "口头工资约定差额",
 "劳动合同到期续签",
 "工伤相关材料准备",
 "销售提成核算争议",
 "试用期解除争议",
 "社保缴费基数咨询",
 "排班与休息日争议",
 "竞业限制条款咨询",
 "劳动合同变更争议",
 "项目奖金发放争议",
 "劳动仲裁证据整理"
];
if(aidArchiveProfiles.length!==28||caseTitles.length!==28){
 throw new Error('Archive demo cases must contain exactly 28 matched profiles');
}
const records:AidCase[]=aidArchiveProfiles.map((profile,index)=>({
 ...profile,
 id:'HHBA-DEMO-'+String(index+1).padStart(3,'0'),
 title:caseTitles[index],
 date:new Date(Date.UTC(2026,10,3-index*2)).toISOString().slice(0,10),
 status:index<19?'已完成':'处理中',
 expense:expenseSamples[index]||0
}));
const money=(n:number)=>'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const initialCapital=100000,profitReceived=20000;
const totalSpent=records.reduce((sum,item)=>sum+item.expense,0);
const availableFund=initialCapital+profitReceived-totalSpent;
const types=['全部类型',...Array.from(new Set(records.map(item=>item.category)))];
const dateText=(date:string)=>date.replace(/-/g,'.');
const setArchiveUrl=(layer:Layer|null,id:string|null=null)=>{
 const url=new URL(window.location.href);
 if(layer)url.searchParams.set('view',layer);else url.searchParams.delete('view');
 if(id)url.searchParams.set('case',id);else url.searchParams.delete('case');
 if(!layer)url.searchParams.delete('category');
 window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
};

type Layer='cases'|'funds'|'reports'|'rules';
type Ledger={id:string;date:string;name:string;amount:number;caseId?:string};
const exampleRevenue=80000,exampleCosts=30000,exampleProfit=50000;
const datePlus=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const ledger:Ledger[]=[
 {id:'HHBA-DEMO-IN-001',date:'2026-09-01',name:'创始人专项支持（假设）',amount:initialCapital},
 {id:'HHBA-DEMO-IN-002',date:'2026-10-01',name:'依法核算后利润划入（假设）',amount:profitReceived},
 ...records.filter(r=>r.expense>0).map(r=>({id:'HHBA-DEMO-OUT-'+r.id.slice(-3),date:datePlus(r.date,8),name:r.title+' · 模拟帮扶费用',amount:-r.expense,caseId:r.id}))
].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
function CaseDocument({record,onOpenFunds}:{record:AidCase;onOpenFunds:()=>void}){
 const workflowTitles=['模拟申请登记','资料和证据线索核对','争议焦点分析','支持方案与沟通准备',record.status==='已完成'?'模拟服务结案':'模拟阶段性进度'];
 const days=[0,1,3,5,8];
 const sections=[['sec0','案件基本信息'],['sec1','事件背景及争议焦点'],['sec2','申请诉求与材料'],['sec3','受理审核与事实核验'],['sec4','完整模拟处理时间轴'],['sec5','帮扶支持事项'],['sec6','处理结果与待办'],['sec7','资金支出明细'],['sec8','档案公开与监督']];
 const serviceCost=Math.round(record.expense*.7);
 const hasExpense=record.expense>0;
 return <div className="hhba-a2-paper">
  <aside className="hhba-a2-chapters"><small>档案阅读目录</small>{sections.map(([id,name],i)=><button type="button" key={id} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}>{String(i+1).padStart(2,'0')} / {name}</button>)}</aside>
  <article className="hhba-a2-article">
   <header className="hhba-a2-paper-hero">
    <span>HHBA DEMO / CASE ARCHIVE / {record.id}</span>
    <h2>{record.title}</h2>
    <div className="hhba-a2-case-tags"><span>{record.category}</span><span>{record.industry}</span><span>{record.status==='已完成'?'模拟服务已完成':'模拟处理中'}</span></div>
    <div className="hhba-a2-hint"><b>情景模拟，非真实案例。</b> 本档案全部人物、单位、工作经历、时间、争议、处理过程、结果和金额均为虚构，用于演示 HHBA 将来如何规范记录及公示。不存在真实申请人、真实付款或真实法律文书。</div>
   </header>
   <section id="sec0" className="hhba-a2-doc-section">
    <h3><span>01</span> 案件基本信息</h3>
    <dl className="hhba-a2-details">
     <div><dt>演示档案编号</dt><dd>{record.id}</dd></div><div><dt>权益问题分类</dt><dd>{record.category}</dd></div>
     <div><dt>行业 / 场景</dt><dd>{record.industry}</dd></div><div><dt>岗位</dt><dd>{record.position}</dd></div>
     <div><dt>模拟任职情况</dt><dd>{record.tenure}</dd></div><div><dt>争议金额或主要事项</dt><dd>{record.claim}</dd></div>
     <div><dt>模拟申请日期</dt><dd>{record.date}</dd></div><div><dt>模拟结案或更新日期</dt><dd>{datePlus(record.date,8)}</dd></div>
     <div><dt>服务流程状态</dt><dd>{record.status==='已完成'?'模拟已完成':'模拟处理中'}</dd></div><div><dt>模拟帮扶专项支出</dt><dd>{money(record.expense)}</dd></div>
    </dl>
    <p className="hhba-a2-muted">上述职业、行业、工作时间及金额只为提高产品原型的案例阅读完整性，不指向任何现实个人或雇主。</p>
   </section>
   <section id="sec1" className="hhba-a2-doc-section">
    <h3><span>02</span> 事件背景与争议焦点</h3><p>{record.background}</p>
    <h4>需要回答的核心问题</h4><ol className="hhba-a2-issue-list">{record.issues.map((issue,i)=><li key={issue}><span>{String(i+1).padStart(2,'0')}</span>{issue}</li>)}</ol>
    <p className="hhba-a2-muted">档案仅呈现假设情景中的不同主张，不对任何真实企业或劳动者作事实指控。</p>
   </section>
   <section id="sec2" className="hhba-a2-doc-section">
    <h3><span>03</span> 申请事项与材料目录</h3>
    <h4>假设申请人的诉求</h4><p>{record.request}</p>
    <h4>模拟需核验的材料类别</h4>
    <ul className="hhba-a2-doc-list">{record.documents.map((doc,i)=><li key={doc}><span>材料 {String(i+1).padStart(2,'0')}</span><strong>{doc}</strong><small>仅为分类目录 · 未取得或上传真实材料</small></li>)}</ul>
    <p>材料范围会随案件类型变化。将来真实公示只展示经适当授权与脱敏审核的摘要、索引和可披露核验说明，不直接公开合同原件、个人工资流水及通信内容。</p>
   </section>
   <section id="sec3" className="hhba-a2-doc-section">
    <h3><span>04</span> 受理审核与事实核验</h3>
    <p>{record.review}</p>
    <div className="hhba-a2-reviewgrid"><span><CheckCircle2 size={15}/> 模拟问题归类</span><span><CheckCircle2 size={15}/> 模拟证据目录建立</span><span><CheckCircle2 size={15}/> 待核事实已标注</span></div>
    <h4>审核边界</h4><p>“模拟审核”只是产品交互及字段示例，不代表 HHBA 员工或律师已经审阅相关材料。存在争议的事实，在获得独立证明前不得写成确定结论。</p>
   </section>
   <section id="sec4" className="hhba-a2-doc-section">
    <h3><span>05</span> 完整模拟处理时间轴</h3>
    <div className="hhba-a2-timeline">{record.timeline.map((detail,i)=><div key={i}><time>{datePlus(record.date,days[i])} · 模拟节点 {String(i+1).padStart(2,'0')}</time><strong>{workflowTitles[i]}</strong><p>{detail}</p></div>)}</div>
    <p className="hhba-a2-muted">为演示页面交互而构造的五阶段流程，并非已发生的联系、调解、仲裁、付款或律师服务记录。</p>
   </section>
   <section id="sec5" className="hhba-a2-doc-section">
    <h3><span>06</span> 帮扶支持事项及边界</h3>
    <div className="hhba-a2-work"><div><b>01 · 专项材料整理</b><p>{record.service}</p></div><div><b>02 · 问题分析与沟通准备</b><p>针对「{record.category}」这一类别的事实争议，将证据、待确认事项、可能涉及的不同处理路径分开列示，以便当事人进一步咨询适格专业人员或相关主管机构。</p></div><div><b>03 · 阶段总结与归档</b><p>模拟服务过程按案件编号汇总，分别记录已完成的资料整理事项、仍有分歧的事实、尚未核实的金额或处理结果，并保留后续更新所需的字段；不把阶段性咨询写成最终维权成功。</p></div></div>
    <p className="hhba-a2-muted">演示内容不构成具体法律意见、代理授权或胜诉保证；正式法律服务如需提供，应由依法有资质的人员审核履行。</p>
   </section>
   <section id="sec6" className="hhba-a2-doc-section">
    <h3><span>07</span> 处理结果及后续核查</h3>
    <div className="hhba-a2-outcome"><strong>{record.status==='已完成'?'情景设定：基础支持流程已结束':'情景设定：材料整理中，尚未结案'}</strong><p>{record.outcome}</p></div>
    <h4>仍需说明或跟进的事项</h4><p>{record.followup}</p>
    <p>正式报告必须分别标明服务是否结束、争议是否解决、款项是否实际到账。模拟“已完成”仅表示此演示情景中的支持流程结束，不等同于仲裁胜诉、法律责任成立或劳动者实际获得赔付。</p>
   </section>
   <section id="sec7" className="hhba-a2-doc-section">
    <h3><span>08</span> 专项资金模拟支出明细</h3>
    <div className="hhba-a2-case-money"><small>本案例假设累计帮扶支出</small><strong>{money(record.expense)}</strong></div>
    {hasExpense?<><table><thead><tr><th>假设支出项目</th><th>模拟金额</th></tr></thead><tbody><tr><td>{record.feeLabels[0]}</td><td>{money(serviceCost)}</td></tr><tr><td>{record.feeLabels[1]}</td><td>{money(record.expense-serviceCost)}</td></tr><tr><td><strong>假设支出合计</strong></td><td><strong>{money(record.expense)}</strong></td></tr></tbody></table><p>模拟支出索引：HHBA-DEMO-OUT-{record.id.slice(-3)}；对应账目可在「资金收支档案」检索。争议金额、员工主张的工资或补偿与本表的帮扶费用属于不同口径，不得混淆。</p><button type="button" className="hhba-a2-linkbutton" onClick={onOpenFunds}>查看对应模拟资金流水 <ArrowRight size={15} aria-hidden="true"/></button></>:<div className="hhba-a2-zero-expense"><strong>暂无模拟支出</strong><p>此情景仍处于资料梳理阶段，未设置付款记录，也不生成不存在的资金流水编号。</p></div>}
    <p className="hhba-a2-muted">以上费用和项目是为了演示规范记账字段而构造，并非实际付款。没有真实发票、律师函、银行回单或审批凭证。</p>
   </section>
   <section id="sec8" className="hhba-a2-doc-section">
    <h3><span>09</span> 公开声明、监督及修订</h3>
    <dl className="hhba-a2-details"><div><dt>案例属性</dt><dd>虚构情景 · 产品演示</dd></div><div><dt>档案编号</dt><dd>{record.id}</dd></div><div><dt>版本</dt><dd>V2.0 · 演示稿</dd></div><div><dt>真实申请人</dt><dd>无</dd></div><div><dt>真实材料与付款凭证</dt><dd>无</dd></div><div><dt>审查状态</dt><dd>演示数据，不构成法务结论</dd></div></dl>
    <p>将来真实案例应在申请人授权、个人信息保护、事实核验、资金对账和必要法律审查完成后公开；支持记录应保留修改历史和纠错渠道。原始合同、身份信息、医疗资料、工资明细、客户数据及律师保密通信不得自动对外开放。</p>
   </section>
  </article>
 </div>;
}
export function AidArchiveDemoPage({user}:{user:User|null}){
 const [layer,setLayer]=useState<Layer|null>(()=>{
  const params=new URLSearchParams(window.location.search);
  const view=params.get('view');
  return params.has('case')?'cases':view==='cases'||view==='funds'||view==='reports'||view==='rules'?view:null;
 });
 const [chosenId,setChosenId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 const [caseOrigin,setCaseOrigin]=useState<'cases'|'funds'>('cases');
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState(()=>{
  const requested=new URLSearchParams(window.location.search).get('category');
  return requested&&types.includes(requested)?requested:'全部类型';
 });
 const [status,setStatus]=useState<'全部'|'已完成'|'处理中'>('全部');
 const [page,setPage]=useState(1);
 const [ledgerQuery,setLedgerQuery]=useState('');
 const [trendRange,setTrendRange]=useState<'全部'|'近30天'>('全部');
 const [hovered,setHovered]=useState<number|null>(null);
 const chosen=records.find(r=>r.id===chosenId)||null;
 const finishedCount=records.filter(r=>r.status==='已完成').length;
 const categoryCounts=types.map(t=>({name:t,count:t==='全部类型'?records.length:records.filter(r=>r.category===t).length}));
 const results=useMemo(()=>records.filter(r=>(status==='全部'||r.status===status)&&(category==='全部类型'||r.category===category)&&(!query.trim()||[r.id,r.title,r.category,r.industry,r.position,r.claim,r.background,...r.issues].some(s=>s.toLowerCase().includes(query.trim().toLowerCase())))),[status,category,query]);
 const maxPage=Math.max(1,Math.ceil(results.length/6));
 const displayPage=Math.min(page,maxPage);
 const open=(next:Layer)=>{if(next==='funds')setLedgerQuery('');setLayer(next);setChosenId(null);setArchiveUrl(next);};
 const openCase=(id:string)=>{setCaseOrigin(layer==='funds'?'funds':'cases');setLayer('cases');setChosenId(id);setArchiveUrl('cases',id);};
 const backToList=()=>{setChosenId(null);setLayer(caseOrigin);setArchiveUrl(caseOrigin);};
 const close=()=>{setLayer(null);setChosenId(null);setArchiveUrl(null);};
 useEffect(()=>{
  if(!layer)return;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(chosenId)backToList();else close();}};
  window.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=oldOverflow;window.removeEventListener('keydown',onKey);};
 },[layer,chosenId]);
 const cards=[
  {key:'cases' as const,title:'帮扶案例公开档案',sub:'受理 · 处理 · 结果',note:'28 份模拟案卷，每份都能深入查阅',count:'28 份'},
  {key:'funds' as const,title:'资金收支档案',sub:'资金来源 · 逐笔流水 · 支出记录',note:'模拟出入池与案件支出相互关联',count:'21 笔'},
  {key:'reports' as const,title:'月度财务报告',sub:'用户付费收入 · 成本核算 · 入池',note:'营业收入与可分配利润分别核算',count:'1 期'},
  {key:'rules' as const,title:'公开制度与监督',sub:'申请规则 · 审核标准 · 更正记录',note:'公开流程与隐私保护制度',count:'制度'}
 ];
 let balance=0;
 const trendData=ledger.map(t=>({date:t.date,label:t.name,balance:balance+=t.amount}));
 trendData.push({date:'2026-11-17',label:'演示期末余额',balance});
 const visibleTrend=trendRange==='近30天'?trendData.filter(t=>t.date>='2026-10-18'):trendData;
 const maxBal=Math.max(...visibleTrend.map(t=>t.balance)),minBal=Math.min(...visibleTrend.map(t=>t.balance));
 const pts=visibleTrend.map((t,i)=>({x:20+680*i/Math.max(1,visibleTrend.length-1),y:173-(t.balance-minBal)*145/Math.max(1,maxBal-minBal),data:t}));
 const d=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 return <Shell user={user}><main className="hhba-aidarchive hhba-a2">
  <div className="hhba-a2-wrap">
   <div className="hhba-a2-crumb"><Link to="/transparency"><ArrowLeft size={15}/> 返回责任与透明</Link><span>公开信息 / 劳动者权益档案</span></div>
   <div className="hhba-a2-demo" role="note"><ShieldCheck size={16}/><span><b>模拟演示页面</b> · 本页资金、案件、收入和结果均为虚构数据，仅供设计验收，不代表 HHBA 实际业务。</span></div>
   <header className="hhba-a2-hero">
    <div className="hhba-a2-hero-main">
     <span className="hhba-a2-eyebrow">PUBLIC TRANSPARENCY / 责任与透明</span>
     <h1>让每一次帮扶，<em>都有迹可循。</em></h1>
     <p>资金去向、受理记录、处理过程和帮扶结果，公开可查。</p>
    </div>
   </header>
   <div className="hhba-a2-brandline" aria-hidden="true"><span/><span/></div>
   <section className="hhba-a2-fund" aria-label="模拟权益帮扶池资金总览">
    <div className="hhba-a2-fundbalance">
     <div className="hhba-a2-fundheading">劳动者权益帮扶池 <span>演示数据</span></div>
     <p>模拟可用资金余额</p>
     <strong>{money(availableFund)}</strong>
     <small>假设截至 2026年11月17日 · 非真实资金账户余额</small>
    </div>
    <div className="hhba-a2-fundstats">
     <div><small>模拟累计入池</small><strong>{money(initialCapital+profitReceived)}</strong></div>
     <div><small>模拟累计支出</small><strong>{money(totalSpent)}</strong></div>
     <button type="button" onClick={()=>open('funds')}>查看资金来源及流水 <ArrowRight size={16}/></button>
    </div>
   </section>
   <section className="hhba-a2-stats" aria-label="模拟案例工作概况">
    <div><small>累计受理</small><strong>{records.length}<em>件</em></strong><p>模拟案件</p></div>
    <div><small>完成帮扶</small><strong>{finishedCount}<em>件</em></strong><p>模拟已完成</p></div>
    <div><small>正在处理</small><strong>{records.length-finishedCount}<em>件</em></strong><p>模拟处理中</p></div>
   </section>
   <section className="hhba-a2-archives" aria-labelledby="hhba-a2-open-archives">
    <div className="hhba-a2-sectiontitle"><div><span className="hhba-a2-eyebrow">OPEN ARCHIVE / 公开档案</span><h2 id="hhba-a2-open-archives">所有记录，公开可查。</h2><p>从申请到处理，从资金来源到实际支出，每份演示档案都有独立的查询编号。</p></div></div>
    <div className="hhba-a2-cardgrid">
     {cards.map((card,index)=><button type="button" className="hhba-a2-entry" key={card.key} onClick={()=>open(card.key)}>
      <span className="hhba-a2-entry-index">{String(index+1).padStart(2,'0')}</span>
      <span className="hhba-a2-entry-copy"><strong>{card.title}</strong><small>{card.sub}</small></span>
      <span className="hhba-a2-entry-count">{card.count}</span>
      <ArrowUpRight size={20} aria-hidden="true"/>
     </button>)}
    </div>
   </section>
   <section className="hhba-a2-rules"><div><Landmark size={23}/><span><strong>资金管理与 60 / 40 分配制度</strong><p>用户服务收入经过成本、税费及依法核算，确认可分配利润后按企业 60%、帮扶池 40% 的原则分配。</p></span></div><button type="button" onClick={()=>open('rules')}>查看制度 <ArrowRight size={16}/></button></section>
   <section className="hhba-a2-privacy"><LockKeyhole size={21}/><p><strong>公开有边界，透明更要保护劳动者。</strong> 真实案件仅公开授权、审核与脱敏的必要信息，不公开个人隐私及保密法律材料。</p></section>
   <details className="hhba-a2-trend"><summary><span className="hhba-a2-trendicon"><BarChart3 size={21}/></span><span><strong>历史资金流动与趋势分析</strong><small>默认折叠 · 点击查看可交互的模拟资金曲线与明细</small></span><ChevronDown size={20}/></summary><div className="hhba-a2-trendbody"><div className="hhba-a2-trendtop"><span><b>模拟资金余额趋势</b><small>数据由逐笔模拟流水累计生成</small></span><div>{(['全部','近30天'] as const).map(p=><button type="button" key={p} className={p===trendRange?'active':''} onClick={()=>{setTrendRange(p);setHovered(null);}}>{p}</button>)}</div></div><svg viewBox="0 0 720 205" role="img" aria-label="演示资金池余额随日期变化的折线图"><path d="M20 28H700 M20 102H700 M20 173H700" fill="none" stroke="#e3ebf7"/><path d={d} fill="none" stroke="#1474fb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={hovered===i?6:4.4} fill="#ff9625" stroke="#fff" strokeWidth="2" tabIndex={0} onMouseEnter={()=>setHovered(i)} onFocus={()=>setHovered(i)} aria-label={p.data.date+'：'+money(p.data.balance)}><title>{p.data.date} · {money(p.data.balance)} · {p.data.label}</title></circle>)}</svg><div className="hhba-a2-chartcaption"><span>{visibleTrend[0]?.date}</span><b>{hovered===null?'期末模拟结余：'+money(availableFund):pts[hovered]?.data.date+' · '+money(pts[hovered]?.data.balance||0)}</b><span>2026-11-17</span></div><p>此趋势仅为演示数据。正式发布必须按实际资金凭据生成并复核。</p><button type="button" className="hhba-a2-linkbutton" onClick={()=>open('funds')}>打开逐笔资金档案 <ArrowRight size={15}/></button></div></details>
   <footer className="hhba-a2-footer"><ShieldCheck size={20}/><p><strong>演示环境：</strong>资金、财报、受理人数、案例、时间轴与处理结果均为虚构记录，只供验收页面样式和交互，不作为真实财务或帮扶成果。</p></footer>
  </div>
  {layer&&<div className="hhba-a2-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section className="hhba-a2-modal" role="dialog" aria-modal="true" aria-label="HHBA 演示公开档案"><header className="hhba-a2-modalhead"><div>{chosen?<button type="button" onClick={backToList}><ChevronLeft size={16}/>{caseOrigin==='funds'?'返回模拟资金流水':'返回档案目录'}</button>:<small>HHBA / PUBLIC RECORDS</small>}<strong>{chosen?'案件公开档案':layer==='cases'?'帮扶案例公开档案':layer==='funds'?'资金收支公开档案':layer==='reports'?'月度财务公开报告':'公开制度与监督'}</strong></div><div><span>模拟演示</span><button type="button" className="hhba-a2-close" aria-label="关闭弹窗" onClick={close}><X size={20}/></button></div></header><div className="hhba-a2-modalbody" key={chosenId||layer}>
   {layer==='cases'&&(chosen?<CaseDocument record={chosen} onOpenFunds={()=>{open('funds');setLedgerQuery(chosen.id);}}/>:<section className="hhba-a2-directory"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">CASE REGISTER / 001—028</span><h2>全部帮扶案例公开档案</h2><p>28 份独立虚构情景，涵盖欠薪、加班、劳动合同、离职补偿、社保工伤及争议处理。按六大类别检索，每份档案均包含九个完整章节与逐案费用记录。</p></div><div className="hhba-a2-searchbar"><label><Search size={17}/><input placeholder="搜索档案编号、案件名称或背景" value={query} aria-label="搜索公开案例" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label></div><div className="hhba-a2-category-panel"><span>按权益问题分类</span><div>{categoryCounts.map(group=><button type="button" key={group.name} className={category===group.name?'active':''} onClick={()=>{setCategory(group.name);setPage(1);}}>{group.name}<small>{group.count}</small></button>)}</div></div><div className="hhba-a2-filters">{(['全部','已完成','处理中'] as const).map(s=><button key={s} type="button" className={status===s?'active':''} onClick={()=>{setStatus(s);setPage(1);}}>{s}{s==='全部'?' · '+records.length:s==='已完成'?' · '+finishedCount:' · '+(records.length-finishedCount)}</button>)}</div><div className="hhba-a2-count">查询结果 {results.length} 条 · 所有内容均为虚构演示</div><div className="hhba-a2-casegrid">{results.slice((displayPage-1)*6,displayPage*6).map(r=><button type="button" className="hhba-a2-case" key={r.id} onClick={()=>openCase(r.id)}><span>{r.id}</span><small>{r.status}</small><strong>{r.title}</strong><p>{r.background}</p><div>{r.category} · {money(r.expense)} <ArrowUpRight size={17}/></div></button>)}</div>{!results.length&&<p className="hhba-a2-empty">没有匹配的模拟档案，请调整查询条件。</p>}<div className="hhba-a2-pages"><span>第 {displayPage} / {maxPage} 页，每页 6 条</span><div><button disabled={displayPage===1} type="button" onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={16}/>上一页</button><button disabled={displayPage===maxPage} type="button" onClick={()=>setPage(p=>Math.min(maxPage,p+1))}>下一页<ChevronRight size={16}/></button></div></div></section>)}
   {layer==='funds'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">FUNDING LEDGER / 模拟流水</span><h2>资金来源与支出公开档案</h2><p>资金池余额由假设入账及关联案件的每笔模拟支出计算，不使用独立编造的合计数字。</p></div><div className="hhba-a2-documentmetrics"><div><small>模拟累计入池</small><strong>{money(initialCapital+profitReceived)}</strong></div><div><small>模拟累计支出</small><strong>{money(totalSpent)}</strong></div><div><small>模拟资金结余</small><strong>{money(availableFund)}</strong></div></div><div className="hhba-a2-hint">假设创始人专项支持 {money(initialCapital)}，假设经营利润已依法核算并划入 {money(profitReceived)}。两类资金分别登记，不等同于实际账户余额。</div><label className="hhba-a2-ledgersearch"><Search size={16}/><input value={ledgerQuery} onChange={e=>setLedgerQuery(e.target.value)} placeholder="按流水编号、项目或关联案件查询" aria-label="搜索资金流水"/></label><div className="hhba-a2-ledgerlist">{ledger.filter(item=>[item.id,item.name,item.caseId||''].some(s=>s.toLowerCase().includes(ledgerQuery.trim().toLowerCase()))).slice().reverse().map(item=><div key={item.id}><span><small>{item.date}　{item.id}</small><strong>{item.name}</strong></span><span><b className={item.amount>0?'credit':'debit'}>{item.amount>0?'+':'−'}{money(Math.abs(item.amount))}</b>{item.caseId&&<button type="button" onClick={()=>openCase(item.caseId!)}>查看关联案件 <ArrowRight size={14}/></button>}</span></div>)}</div></section>}
   {layer==='reports'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">MONTHLY REPORT / 演示</span><h2>2026年10月 · 经营与权益帮扶月报</h2><p>这不是一份真实财务报表。全部金额仅演示如何公开用户收款、经营成本、可分配利润和帮扶池入账。</p></div><div className="hhba-a2-documentmetrics"><div><small>用户服务收入（模拟）</small><strong>{money(exampleRevenue)}</strong></div><div><small>成本及税费等（模拟）</small><strong>{money(exampleCosts)}</strong></div><div><small>可分配利润（假设核准）</small><strong>{money(exampleProfit)}</strong></div></div><div className="hhba-a2-doc-section"><h3>01 / 用户付费及经营核算</h3><p>假设用户通过购买求职及职业支持服务形成服务收入。退款、成本和税费等先行核算；依法确认可分配利润前，不能直接按每笔订单流水分配。</p><table><tbody><tr><td>模拟用户服务收入</td><td>{money(exampleRevenue)}</td></tr><tr><td>模拟经营成本和税费</td><td>− {money(exampleCosts)}</td></tr><tr><td>模拟当期经营结果</td><td>{money(exampleRevenue-exampleCosts)}</td></tr><tr><td>另行假设核准的可分配利润</td><td>{money(exampleProfit)}</td></tr></tbody></table></div><div className="hhba-a2-doc-section"><h3>02 / 60/40 利润分配制度</h3><p>企业 60%：{money(exampleProfit*.6)}。劳动者权益帮扶池 40%：{money(exampleProfit*.4)}。这是对假设的依法确认后利润的演示分配，不是对营业收入或每笔付费的直接抽成。</p></div><div className="hhba-a2-doc-section"><h3>03 / 资金池结余追溯</h3><p>创始人假设专项支持 {money(initialCapital)}，再加上假设实际划入的利润 {money(profitReceived)}，扣除模拟案例合计支出 {money(totalSpent)}，计算得模拟余额 {money(availableFund)}。</p><button type="button" className="hhba-a2-linkbutton" onClick={()=>open('funds')}>核对全部模拟资金流水 <ArrowRight size={16}/></button></div><p className="hhba-a2-hint">真实月报须由真实交易、凭证、审批记录和合法财务核算形成，不得把此演示报告发布成正式财报。</p></section>}
   {layer==='rules'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">POLICY & OVERSIGHT</span><h2>资金管理、公开与监督制度</h2><p>制度是档案可核验的基础。受理流程、费用审核、隐私授权、报告更正都应有可追溯的规则。</p></div>{[['资金与利润分配','依法核算并完成必要程序后的可分配利润，按企业发展 60% 与劳动者权益帮扶池 40% 的制度分配；创始人自愿专项支持另行记账。'],['受理与资格审核','真实开放前须明确申请资格、材料要求、审核标准、异议处理和服务范围。记录申请时间、审核结果和执行主体。'],['支出审批与核验','每笔实际支出记录审批、用途、支付日期、金额和凭据，公开的支出摘要可以回溯到内部账目。'],['隐私保护与信息公开','仅公开经合法授权及脱敏的摘要。姓名、个人联系方式、证件、完整工资流水和律师保密沟通等不直接对外发布。'],['版本修订与错误更正','公开记录的修改应保存旧版本、修改时间与原因，提供反馈或纠错渠道。'],['演示与正式数据隔离','全部虚构案例与模拟余额只在演示环境存在，正式环境必须读取真实账本和实际受理记录。']].map(([t,body],i)=><div key={t} className="hhba-a2-doc-section"><h3>{String(i+1).padStart(2,'0')} / {t}</h3><p>{body}</p></div>)}</section>}
   </div><footer className="hhba-a2-modalfoot"><span><ShieldCheck size={15}/> 演示环境 · 不代表真实案件或资金</span><button type="button" onClick={close}>关闭档案 <X size={15}/></button></footer></section></div>}
 </main></Shell>;
}
