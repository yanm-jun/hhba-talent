import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Landmark,LockKeyhole,Search,ShieldCheck,X} from 'lucide-react';
import {hhbaLogoUrl} from '../components/BrandMark';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/aidArchiveDemo.css';

type Seed=[title:string,category:string,background:string,request:string,service:string,outcome:string];
type AidCase={id:string;title:string;category:string;background:string;request:string;service:string;outcome:string;date:string;status:'已完成'|'处理中';expense:number};
const expenseSamples=[1200,800,930,600,540,450,430,400,380,360,350,330,320,300,280,260,250,240,230];
const caseSeeds:Seed[]=[
 ['离职后工资未结清','工资报酬','餐饮岗位劳动者离职后，最后一个计薪周期的劳动报酬未按约定结清。','梳理工资计算依据，明确催付步骤。','核对模拟考勤与转账记录，形成工资核算表及沟通清单。','模拟结果：双方核对差额后完成结算，劳动者收到补付工资。'],
 ['未签订书面劳动合同','劳动合同','零售行业劳动者入职数月，企业一直未提供可签署的书面合同。','了解劳动关系证明方式及可行维权路径。','整理入职记录、工作安排和工资凭证，形成初步咨询意见。','模拟结果：帮助申请人准备书面协商材料，确认后续处理路径。'],
 ['节假日加班工资争议','工时休假','服务业劳动者反映法定节假日期间工作，但工资中未区分对应报酬。','核算加班时段与工资差额。','按模拟排班、实际出勤与工资明细交叉核对。','模拟结果：形成差额说明并协助完成一次协商。'],
 ['试用期工资差额','工资报酬','某技术岗位劳动者发现试用期实发工资与招聘时告知的标准存在差异。','弄清差额和相关条款。','整理录用沟通记录、劳动合同条款及两期工资记录。','模拟结果：获得工资构成的书面解释并确认后续调整。'],
 ['绩效工资扣减争议','工资报酬','某销售岗位劳动者认为绩效考核口径临时调整导致应发金额减少。','核验考核规则及扣款依据。','归集绩效制度、通知时间和个人业绩清单。','模拟结果：完成复核沟通，明确争议绩效的处理口径。'],
 ['离职工资结算延期','工资报酬','某仓储岗位劳动者完成交接后，多次询问末月工资发放日期。','推动形成明确付款安排。','核对交接清单和历史发薪日期，整理催付材料。','模拟结果：得到双方确认的工资结算时间表。'],
 ['解除劳动合同补偿争议','离职补偿','某办公室岗位劳动者被通知提前解除合同，对补偿计算有疑问。','核对工作年限、工资基数和解除原因。','整理合同、通知和工资材料，并协助准备专业咨询问题清单。','模拟结果：完成补偿核算说明，并形成协商方案。'],
 ['劳动关系证明不足','劳动合同','某配送岗位劳动者日常接受排班管理，但留存的合同材料较少。','梳理能够证明实际用工关系的材料。','归类排班截图、工作安排和工资支付记录。','模拟结果：形成证据目录，帮助申请人整理后续提交顺序。'],
 ['工时记录不完整','工时休假','某门店劳动者反映工作时间较长，但没有完整的纸质打卡记录。','核对可用于说明工作时间的资料。','比对排班、沟通消息与模拟工资单，制作工时登记表。','模拟结果：完成工时事实梳理和材料清单。'],
 ['年休假待遇争议','工时休假','某制造业劳动者不确定在职期间年休假安排及补偿计算方式。','明确年休假天数核算所需条件。','整理在岗时间、请假记录及企业休假制度。','模拟结果：形成书面核算说明并完成初步咨询。'],
 ['报酬支付周期争议','工资报酬','某兼职性质岗位的劳动者认为约定的结算周期未被遵守。','核验约定周期及未付款时间段。','整理沟通记录、任务交付和收款明细。','模拟结果：完成欠付金额核对并取得付款安排反馈。'],
 ['加班审批与工资核算','工时休假','某行政岗位劳动者日常加班与企业内部审批记录不一致。','理清审批记录与实际工作事实的差别。','制作时间线，归类工作任务与考勤记录。','模拟结果：取得完整核对表供后续专业判断。'],
 ['外包岗位劳动关系咨询','劳动合同','某外包项目劳动者对合同主体、实际管理主体与争议处理对象有疑问。','确认相关企业及合同关系信息。','整理合同首页、工资付款主体和日常管理材料。','模拟结果：明确进一步核查的主体信息清单。'],
 ['企业扣款规则争议','工资报酬','某连锁门店劳动者反映被按内部规定扣款，但缺少明确告知。','查询扣款规则、明细与通知依据。','模拟审阅员工手册和薪资条目，整理异议申请。','模拟结果：企业提供扣款说明并启动内部复核。'],
 ['调岗降薪协商问题','劳动合同','某运营岗位劳动者收到调岗安排，拟调整的工资标准引发争议。','了解岗位调整和工资变更的协商要点。','对比原合同、通知与变更方案。','模拟结果：形成协商意见及待确认问题清单。'],
 ['社会保险缴纳咨询','社保权益','某服务岗位劳动者发现社保缴纳记录与实际入职时间不一致。','核对缴纳期间、参保主体与查询方式。','整理劳动关系起始材料和参保记录截图。','模拟结果：完成参保记录核对并明确咨询渠道。'],
 ['离职交接与结算争议','离职补偿','某物流岗位劳动者已移交工作，但双方对交接完成情况说法不同。','明确交接事实及未结清事项。','制作资料交接清单和争议时间轴。','模拟结果：双方确认交接清单并继续办理结算。'],
 ['口头工资约定差额','工资报酬','某服务行业劳动者的实际发薪标准与入职沟通记录不一致。','整理约定工资与实发工资的差额。','比对录用沟通、薪资条及付款记录。','模拟结果：形成工资差额核对书并完成协商。'],
 ['劳动合同到期续签','劳动合同','某劳动者的固定期限合同接近届满，对续签条款存在疑问。','了解续签方案并梳理需确认条款。','审阅模拟续签要点清单，整理向企业提问的事项。','模拟结果：完成续签风险提示和沟通准备。'],
 ['工伤相关材料准备','社保权益','某劳动者在工作中受伤，正在整理事件发生经过和相关材料。','了解后续申请需要准备哪些文件。','模拟建立医疗、工作经过、见证资料清单。','处理中：等待模拟资料补齐，尚无案件结论。'],
 ['销售提成核算争议','工资报酬','销售岗位劳动者反映部分订单的提成尚未在工资中体现。','核对订单、计提规则和已付金额。','模拟收集订单清单与绩效口径。','处理中：已建立模拟核对清单，等待进一步对账。'],
 ['试用期解除争议','离职补偿','某应届岗位劳动者在试用期间被解除劳动关系，对处理方式有疑问。','了解解除通知与试用条件。','模拟整理岗位要求、考核通知与解除记录。','处理中：已受理模拟咨询，尚未完成结果核验。'],
 ['社保缴费基数咨询','社保权益','某劳动者在查询社保记录时发现缴费基数与工资记录存在差异。','弄清缴费信息及核对方法。','模拟整理参保信息、工资记录与月份对照表。','处理中：待取得完整模拟参保明细。'],
 ['排班与休息日争议','工时休假','某服务业劳动者认为连续排班缺少合理休息安排。','核对排班周期与出勤事实。','模拟建立排班时间线和补休记录。','处理中：进入模拟资料审核阶段。'],
 ['竞业限制条款咨询','劳动合同','某岗位劳动者收到离职后履约要求，对条款范围存在疑问。','了解条款义务及咨询重点。','模拟整理竞业条款、工作范围与补偿记录。','处理中：等待进一步专业评估。'],
 ['劳动合同变更争议','劳动合同','某劳动者收到合同补充协议，对工作地点和薪酬条款存疑。','评估拟变更条款的信息完整性。','模拟对照新旧合同及通知记录。','处理中：已形成问题清单，尚无处理结果。'],
 ['项目奖金发放争议','工资报酬','某项目岗位劳动者对奖金发放条件及确认流程存疑。','核对项目完成情况与奖金约定。','模拟整理项目节点、沟通记录与绩效依据。','处理中：正在模拟核对资料。'],
 ['劳动仲裁证据整理','劳动合同','某劳动者希望就劳动争议了解申请材料准备方式。','建立证据目录和主要争议事项清单。','模拟归集合同、工资、出勤和沟通材料。','处理中：仅完成模拟基础资料登记。']
];

const records:AidCase[]=caseSeeds.map((seed,index)=>({
 id:'HHBA-DEMO-'+String(index+1).padStart(3,'0'),
 title:seed[0],category:seed[1],background:seed[2],request:seed[3],service:seed[4],outcome:seed[5],
 date:new Date(Date.UTC(2026,10,3-index*2)).toISOString().slice(0,10),
 status:index<19?'已完成':'处理中',expense:expenseSamples[index]||0
}));
const money=(n:number)=>'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const initialCapital=100000,profitReceived=20000;
const totalSpent=records.reduce((sum,item)=>sum+item.expense,0);
const availableFund=initialCapital+profitReceived-totalSpent;
const types=['全部类型',...Array.from(new Set(records.map(item=>item.category)))];
const dateText=(date:string)=>date.replace(/-/g,'.');
const updateCaseInUrl=(id:string|null)=>{
 const url=new URL(window.location.href);
 if(id)url.searchParams.set('case',id);else url.searchParams.delete('case');
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
const docsByType:Record<string,string[]>={
 '工资报酬':['工资约定及薪酬构成','考勤、工资及支付情况对照','工资结算沟通摘要'],
 '劳动合同':['录用沟通与合同文件','劳动关系及日常管理材料','合同变更或解除通知'],
 '工时休假':['排班与考勤记录','加班、补休及请假材料','薪酬明细与核算表'],
 '离职补偿':['在岗年限及薪资记录','解除/离职通知及协商记录','工作交接记录'],
 '社保权益':['参保记录查询摘要','劳动关系证明目录','社保申报沟通材料']
};
function CaseDocument({record}:{record:AidCase}){
 const steps=[
  ['申请与登记','将模拟诉求归类并记录初步事实、申请日期和材料目录。'],
  ['证据及情况梳理','逐项整理用工背景、合同、薪酬或考勤信息，识别尚未核实的事实。'],
  ['提供支持与反馈',record.service],
  ['沟通和流程建议','依据假设情况整理沟通要点与后续可能需要准备的材料，不声称已经联系真实企业或律师。'],
  [record.status==='已完成'?'完成并归档':'阶段性进展',record.outcome]
 ];
 const sections=[['sec0','案件基本信息'],['sec1','争议背景'],['sec2','申请诉求与证据'],['sec3','受理审核'],['sec4','完整处理时间轴'],['sec5','具体帮扶措施'],['sec6','处理结果与评价'],['sec7','资金支出详情'],['sec8','公开监督及修订']];
 const serviceCost=Math.round(record.expense*.7);
 return <div className="hhba-a2-paper">
  <aside className="hhba-a2-chapters"><small>文档目录</small>{sections.map(([id,name],i)=><button type="button" key={id} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}>{String(i+1).padStart(2,'0')} / {name}</button>)}</aside>
  <article className="hhba-a2-article">
   <header className="hhba-a2-paper-hero"><span>CASE ARCHIVE / {record.id}</span><h2>{record.title}</h2><p>{record.category}　·　模拟{record.status}　·　版本 V1.0</p><div className="hhba-a2-hint">本档案为完全虚构的产品演示案例。人物、企业、争议、服务过程、处理结果与资金均未真实发生。</div></header>
   <section id="sec0" className="hhba-a2-doc-section"><h3><span>01</span> 案件基本信息</h3><dl className="hhba-a2-details"><div><dt>公开档案编号</dt><dd>{record.id}</dd></div><div><dt>争议类型</dt><dd>{record.category}</dd></div><div><dt>模拟申请日期</dt><dd>{record.date}</dd></div><div><dt>模拟处理状态</dt><dd>{record.status}</dd></div><div><dt>模拟完成或更新日期</dt><dd>{datePlus(record.date,8)}</dd></div><div><dt>模拟支持支出</dt><dd>{money(record.expense)}</dd></div></dl></section>
   <section id="sec1" className="hhba-a2-doc-section"><h3><span>02</span> 争议背景与经过</h3><p>{record.background}</p><p>假设申请人从日常工作记录中发现有关劳动权益的问题，整理初始材料后提出咨询。该背景只用于展示未来真实档案的叙述结构，并不构成对任何真实企业、岗位或个人的指控。</p><blockquote><b>争议焦点</b><p>{record.request}</p></blockquote></section>
   <section id="sec2" className="hhba-a2-doc-section"><h3><span>03</span> 申请诉求与材料目录</h3><p><b>拟解决的问题：</b>{record.request}</p><p>假设需要核对下列材料类型；这里只提供分类目录，不伪造合同、工资单、企业公章或律师函。</p><ul>{(docsByType[record.category]||[]).map(s=><li key={s}>{s} <em>· 模拟目录</em></li>)}</ul><p className="hhba-a2-muted">正式展示仅公开经授权脱敏的材料摘要和可披露索引，敏感原件留在受控管理系统。</p></section>
   <section id="sec3" className="hhba-a2-doc-section"><h3><span>04</span> 受理审核过程</h3><p>演示中的审核由三个步骤构成：争议类型初筛、申请材料完整性核对、支持服务范围判断。每一步在正式系统中都应有操作人、日期和留痕。</p><div className="hhba-a2-reviewgrid">{['模拟登记完成','模拟资料复核','模拟服务范围确认'].map(s=><span key={s}><CheckCircle2 size={15}/> {s}</span>)}</div><p>本案例不代表 HHBA 已正式受理申请、提供专业法律意见或完成收费服务。</p></section>
   <section id="sec4" className="hhba-a2-doc-section"><h3><span>05</span> 详细处理时间轴</h3><div className="hhba-a2-timeline">{steps.map(([name,text],i)=><div key={i}><time>{datePlus(record.date,[0,1,3,5,8][i])}</time><strong>{name}</strong><p>{text}</p></div>)}</div><p className="hhba-a2-muted">时间节点及具体服务过程均为模拟，正式案例将按实际发生日期及审核结论公开。</p></section>
   <section id="sec5" className="hhba-a2-doc-section"><h3><span>06</span> HHBA 模拟支持事项</h3><div className="hhba-a2-work"><div><b>资料梳理</b><p>{record.service}</p></div><div><b>程序和沟通准备</b><p>按模拟争议类型梳理可行的后续处理方向、有关问题清单，以及需要由专业人士核验的事项。</p></div><div><b>记录归档和进度跟进</b><p>假设将服务过程形成阶段性摘要，标明已完成事项与仍有待确认的信息。</p></div></div></section>
   <section id="sec6" className="hhba-a2-doc-section"><h3><span>07</span> 处理结果与实际影响</h3><div className="hhba-a2-outcome"><strong>模拟{record.status}</strong><p>{record.outcome}</p></div><p>正式公开时必须单独区分“服务是否完成”“争议是否解决”“争议款项是否实际收到”。不能把咨询完成等同于维权成功，也不能编造胜诉率或到账证明。</p></section>
   <section id="sec7" className="hhba-a2-doc-section"><h3><span>08</span> 模拟帮扶资金支出</h3><div className="hhba-a2-case-money"><small>该案例模拟累计支出</small><strong>{money(record.expense)}</strong></div><table><thead><tr><th>模拟支出科目</th><th>金额</th></tr></thead><tbody><tr><td>资料整理与服务支持</td><td>{money(serviceCost)}</td></tr><tr><td>沟通跟进与记录归档</td><td>{money(record.expense-serviceCost)}</td></tr><tr><td>本案模拟合计</td><td><strong>{money(record.expense)}</strong></td></tr></tbody></table><p>流水索引：HHBA-DEMO-OUT-{record.id.slice(-3)}。本记录不附虚构银行凭证、发票或结算证明；资金记录与总览在演示数据层一致。</p></section>
   <section id="sec8" className="hhba-a2-doc-section"><h3><span>09</span> 公开说明与监督修订</h3><dl className="hhba-a2-details"><div><dt>档案性质</dt><dd>纯虚构演示案例</dd></div><div><dt>公开版本</dt><dd>V1.0 · 演示</dd></div><div><dt>资料核验</dt><dd>无真实案件材料</dd></div><div><dt>真实凭证</dt><dd>不存在</dd></div></dl><p>未来真实案件公开需要适当授权、隐私审查、内容审核、修改历史和纠错渠道。实名资料、敏感合同、工资原件及律师保密通信不在公开页面直接呈现。</p></section>
  </article>
 </div>;
}
export function AidArchiveDemoPage({user}:{user:User|null}){
 const [layer,setLayer]=useState<Layer|null>(()=>new URLSearchParams(window.location.search).has('case')?'cases':null);
 const [chosenId,setChosenId]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('全部类型');
 const [status,setStatus]=useState<'全部'|'已完成'|'处理中'>('全部');
 const [page,setPage]=useState(1);
 const [ledgerQuery,setLedgerQuery]=useState('');
 const [trendRange,setTrendRange]=useState<'全部'|'近30天'>('全部');
 const [hovered,setHovered]=useState<number|null>(null);
 const chosen=records.find(r=>r.id===chosenId)||null;
 const finishedCount=records.filter(r=>r.status==='已完成').length;
 const results=useMemo(()=>records.filter(r=>(status==='全部'||r.status===status)&&(category==='全部类型'||r.category===category)&&(!query.trim()||[r.id,r.title,r.category,r.background].some(s=>s.toLowerCase().includes(query.trim().toLowerCase())))),[status,category,query]);
 const maxPage=Math.max(1,Math.ceil(results.length/6));
 const displayPage=Math.min(page,maxPage);
 const open=(next:Layer)=>{setLayer(next);setChosenId(null);updateCaseInUrl(null);};
 const openCase=(id:string)=>{setLayer('cases');setChosenId(id);updateCaseInUrl(id);};
 const close=()=>{setLayer(null);setChosenId(null);updateCaseInUrl(null);};
 useEffect(()=>{
  if(!layer)return;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(chosenId){setChosenId(null);updateCaseInUrl(null);}else close();}};
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
     <div className="hhba-a2-brand"><img src={hhbaLogoUrl} width={36} height={36} alt="HHBA 官方品牌标志"/><span><b>HHBA 汇方职场</b><small>PUBLIC TRANSPARENCY</small></span></div>
     <span className="hhba-a2-eyebrow">PUBLIC TRANSPARENCY / 责任与透明</span>
     <h1>让每一次帮扶，<br/><em>都有迹可循。</em></h1>
     <p>我们希望不仅公开资金去向，更完整记录受理、处理和支持结果。每一份责任，都应经得起查阅。</p>
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
  {layer&&<div className="hhba-a2-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section className="hhba-a2-modal" role="dialog" aria-modal="true" aria-label="HHBA 演示公开档案"><header className="hhba-a2-modalhead"><div>{chosen?<button type="button" onClick={()=>{setChosenId(null);updateCaseInUrl(null);}}><ChevronLeft size={16}/>返回档案目录</button>:<small>HHBA / PUBLIC RECORDS</small>}<strong>{chosen?'案件公开档案':layer==='cases'?'帮扶案例公开档案':layer==='funds'?'资金收支公开档案':layer==='reports'?'月度财务公开报告':'公开制度与监督'}</strong></div><div><span>模拟演示</span><button type="button" className="hhba-a2-close" aria-label="关闭弹窗" onClick={close}><X size={20}/></button></div></header><div className="hhba-a2-modalbody" key={chosenId||layer}>
   {layer==='cases'&&(chosen?<CaseDocument record={chosen}/>:<section className="hhba-a2-directory"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">CASE REGISTER / 001—028</span><h2>全部帮扶案例公开档案</h2><p>28 条独立模拟案卷，支持编号、类型和案件状态查询。每份档案都包含九个详细章节。</p></div><div className="hhba-a2-searchbar"><label><Search size={17}/><input placeholder="搜索档案编号、案件名称或背景" value={query} aria-label="搜索公开案例" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><select value={category} aria-label="选择案件类型" onChange={e=>{setCategory(e.target.value);setPage(1);}}>{types.map(t=><option key={t}>{t}</option>)}</select></div><div className="hhba-a2-filters">{(['全部','已完成','处理中'] as const).map(s=><button key={s} type="button" className={status===s?'active':''} onClick={()=>{setStatus(s);setPage(1);}}>{s}{s==='全部'?' · '+records.length:s==='已完成'?' · '+finishedCount:' · '+(records.length-finishedCount)}</button>)}</div><div className="hhba-a2-count">查询结果 {results.length} 条 · 所有内容均为虚构演示</div><div className="hhba-a2-casegrid">{results.slice((displayPage-1)*6,displayPage*6).map(r=><button type="button" className="hhba-a2-case" key={r.id} onClick={()=>openCase(r.id)}><span>{r.id}</span><small>{r.status}</small><strong>{r.title}</strong><p>{r.background}</p><div>{r.category} · {money(r.expense)} <ArrowUpRight size={17}/></div></button>)}</div>{!results.length&&<p className="hhba-a2-empty">没有匹配的模拟档案，请调整查询条件。</p>}<div className="hhba-a2-pages"><span>第 {displayPage} / {maxPage} 页，每页 6 条</span><div><button disabled={displayPage===1} type="button" onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={16}/>上一页</button><button disabled={displayPage===maxPage} type="button" onClick={()=>setPage(p=>Math.min(maxPage,p+1))}>下一页<ChevronRight size={16}/></button></div></div></section>)}
   {layer==='funds'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">FUNDING LEDGER / 模拟流水</span><h2>资金来源与支出公开档案</h2><p>资金池余额由假设入账及关联案件的每笔模拟支出计算，不使用独立编造的合计数字。</p></div><div className="hhba-a2-documentmetrics"><div><small>模拟累计入池</small><strong>{money(initialCapital+profitReceived)}</strong></div><div><small>模拟累计支出</small><strong>{money(totalSpent)}</strong></div><div><small>模拟资金结余</small><strong>{money(availableFund)}</strong></div></div><div className="hhba-a2-hint">假设创始人专项支持 {money(initialCapital)}，假设经营利润已依法核算并划入 {money(profitReceived)}。两类资金分别登记，不等同于实际账户余额。</div><label className="hhba-a2-ledgersearch"><Search size={16}/><input value={ledgerQuery} onChange={e=>setLedgerQuery(e.target.value)} placeholder="按流水编号、项目或关联案件查询" aria-label="搜索资金流水"/></label><div className="hhba-a2-ledgerlist">{ledger.filter(item=>[item.id,item.name,item.caseId||''].some(s=>s.toLowerCase().includes(ledgerQuery.trim().toLowerCase()))).slice().reverse().map(item=><div key={item.id}><span><small>{item.date}　{item.id}</small><strong>{item.name}</strong></span><span><b className={item.amount>0?'credit':'debit'}>{item.amount>0?'+':'−'}{money(Math.abs(item.amount))}</b>{item.caseId&&<button type="button" onClick={()=>openCase(item.caseId!)}>查看关联案件 <ArrowRight size={14}/></button>}</span></div>)}</div></section>}
   {layer==='reports'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">MONTHLY REPORT / 演示</span><h2>2026年10月 · 经营与权益帮扶月报</h2><p>这不是一份真实财务报表。全部金额仅演示如何公开用户收款、经营成本、可分配利润和帮扶池入账。</p></div><div className="hhba-a2-documentmetrics"><div><small>用户服务收入（模拟）</small><strong>{money(exampleRevenue)}</strong></div><div><small>成本及税费等（模拟）</small><strong>{money(exampleCosts)}</strong></div><div><small>可分配利润（假设核准）</small><strong>{money(exampleProfit)}</strong></div></div><div className="hhba-a2-doc-section"><h3>01 / 用户付费及经营核算</h3><p>假设用户通过购买求职及职业支持服务形成服务收入。退款、成本和税费等先行核算；依法确认可分配利润前，不能直接按每笔订单流水分配。</p><table><tbody><tr><td>模拟用户服务收入</td><td>{money(exampleRevenue)}</td></tr><tr><td>模拟经营成本和税费</td><td>− {money(exampleCosts)}</td></tr><tr><td>模拟当期经营结果</td><td>{money(exampleRevenue-exampleCosts)}</td></tr><tr><td>另行假设核准的可分配利润</td><td>{money(exampleProfit)}</td></tr></tbody></table></div><div className="hhba-a2-doc-section"><h3>02 / 60/40 利润分配制度</h3><p>企业 60%：{money(exampleProfit*.6)}。劳动者权益帮扶池 40%：{money(exampleProfit*.4)}。这是对假设的依法确认后利润的演示分配，不是对营业收入或每笔付费的直接抽成。</p></div><div className="hhba-a2-doc-section"><h3>03 / 资金池结余追溯</h3><p>创始人假设专项支持 {money(initialCapital)}，再加上假设实际划入的利润 {money(profitReceived)}，扣除模拟案例合计支出 {money(totalSpent)}，计算得模拟余额 {money(availableFund)}。</p><button type="button" className="hhba-a2-linkbutton" onClick={()=>open('funds')}>核对全部模拟资金流水 <ArrowRight size={16}/></button></div><p className="hhba-a2-hint">真实月报须由真实交易、凭证、审批记录和合法财务核算形成，不得把此演示报告发布成正式财报。</p></section>}
   {layer==='rules'&&<section className="hhba-a2-docpage"><div className="hhba-a2-intro"><span className="hhba-a2-eyebrow">POLICY & OVERSIGHT</span><h2>资金管理、公开与监督制度</h2><p>制度是档案可核验的基础。受理流程、费用审核、隐私授权、报告更正都应有可追溯的规则。</p></div>{[['资金与利润分配','依法核算并完成必要程序后的可分配利润，按企业发展 60% 与劳动者权益帮扶池 40% 的制度分配；创始人自愿专项支持另行记账。'],['受理与资格审核','真实开放前须明确申请资格、材料要求、审核标准、异议处理和服务范围。记录申请时间、审核结果和执行主体。'],['支出审批与核验','每笔实际支出记录审批、用途、支付日期、金额和凭据，公开的支出摘要可以回溯到内部账目。'],['隐私保护与信息公开','仅公开经合法授权及脱敏的摘要。姓名、个人联系方式、证件、完整工资流水和律师保密沟通等不直接对外发布。'],['版本修订与错误更正','公开记录的修改应保存旧版本、修改时间与原因，提供反馈或纠错渠道。'],['演示与正式数据隔离','全部虚构案例与模拟余额只在演示环境存在，正式环境必须读取真实账本和实际受理记录。']].map(([t,body],i)=><div key={t} className="hhba-a2-doc-section"><h3>{String(i+1).padStart(2,'0')} / {t}</h3><p>{body}</p></div>)}</section>}
   </div><footer className="hhba-a2-modalfoot"><span><ShieldCheck size={15}/> 演示环境 · 不代表真实案件或资金</span><button type="button" onClick={close}>关闭档案 <X size={15}/></button></footer></section></div>}
 </main></Shell>;
}
