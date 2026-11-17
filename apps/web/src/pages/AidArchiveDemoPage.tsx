import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,BookOpenCheck,Check,CheckCircle2,ChevronRight,Clock3,FileText,Search,ShieldCheck,Wallet,X} from 'lucide-react';
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
 date:new Date(Date.UTC(2026,10,16-index*2)).toISOString().slice(0,10),
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
export function AidArchiveDemoPage({user}:{user:User|null}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'全部'|'已完成'|'处理中'>('全部');
 const [category,setCategory]=useState('全部类型');
 const [active,setActive]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('case'));
 const chosen=records.find(item=>item.id===active)||null;
 const complete=records.filter(item=>item.status==='已完成').length;
 const filtered=useMemo(()=>records.filter(item=>{
  const q=search.trim().toLowerCase();
  return (filter==='全部'||item.status===filter)
   &&(category==='全部类型'||item.category===category)
   &&(!q||[item.id,item.title,item.category,item.background,item.request].some(val=>val.toLowerCase().includes(q)));
 }),[search,filter,category]);
 const open=(id:string)=>{setActive(id);updateCaseInUrl(id);};
 const close=()=>{setActive(null);updateCaseInUrl(null);};
 useEffect(()=>{
  if(!chosen)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[chosen]);
 return <Shell user={user}>
 <main className="hhba-aidarchive">
  <div className="hhba-aa-container">
   <div className="hhba-aa-top"><Link to="/transparency"><ArrowLeft size={15}/> 返回责任与透明</Link><span>HHBA / PUBLIC AID ARCHIVE</span></div>
   <div className="hhba-aa-demo-banner"><ShieldCheck size={17}/><div><strong>产品演示环境 · 非真实帮扶记录</strong><span>本页面中的资金、收入、支出、申请数量、案件经过、处理结果均为虚构示例，仅供设计验收；不可作为真实案例或财务凭证。</span></div></div>
   <header className="hhba-aa-heading">
    <div><span className="hhba-aa-eyebrow">OPEN RECORDS · 公开可查</span><h1>每一份支持，<br/><em>都有迹可循。</em></h1><p>公开的不只是数字。受理、处理、结果与资金记录，都应该有可以逐项查询的档案。</p></div>
    <div className="hhba-aa-heading-stamp"><BookOpenCheck size={26}/><strong>公开档案</strong><span>按编号追溯 · 过程可查</span></div>
   </header>
   <section className="hhba-aa-funds" aria-label="模拟权益帮扶池资金">
    <div className="hhba-aa-balance"><div className="hhba-aa-balance-title"><Wallet size={17}/> 劳动者权益帮扶池 <span>SIMULATION</span></div><div className="hhba-aa-balance-label">模拟当前资金余额</div><div className="hhba-aa-amount">{money(availableFund)}</div><p>金额由下列模拟资金流水计算，而非单独填写的展示数字。</p></div>
    <div className="hhba-aa-ledger">
     <div className="hhba-aa-ledger-head">资金收支简表 <span>模拟数据 · 人民币</span></div>
     <div><span>创始人专项投入（假设）</span><strong>+ {money(initialCapital)}</strong></div>
     <div><span>利润核算后划入（假设）</span><strong>+ {money(profitReceived)}</strong></div>
     <div><span>案件帮扶支出合计（假设）</span><strong className="hhba-aa-out">− {money(totalSpent)}</strong></div>
     <div className="hhba-aa-ledger-total"><span>当前模拟结余</span><strong>{money(availableFund)}</strong></div>
    </div>
   </section>
   <section className="hhba-aa-metrics" aria-label="模拟案例统计">
    <div><small>公开案例总数</small><strong>{records.length}<span> 件</span></strong><p>全部模拟档案可查询</p></div>
    <div><small>模拟已完成</small><strong>{complete}<span> 件</span></strong><p>均有处理结果与摘要</p></div>
    <div><small>模拟处理中</small><strong>{records.length-complete}<span> 件</span></strong><p>展示阶段和待办事项</p></div>
    <div><small>模拟累计支出</small><strong>{money(totalSpent)}</strong><p>与逐案支出金额相符</p></div>
   </section>
   <section className="hhba-aa-directory" aria-labelledby="archive-title">
    <div className="hhba-aa-directory-head"><div><div className="hhba-aa-eyebrow">CASE REGISTER / 001—028</div><h2 id="archive-title">帮扶案例公开档案</h2><p>选取一个案件，查看模拟受理背景、诉求、服务过程、处理结果及对应支出。</p></div><span className="hhba-aa-count">共收录 {records.length} 条演示档案</span></div>
    <div className="hhba-aa-filters">
     <label className="hhba-aa-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索案件编号、关键词或争议类型" aria-label="搜索公开案例"/></label>
     <div className="hhba-aa-tabs" aria-label="按案件状态筛选">{(['全部','已完成','处理中'] as const).map(v=><button type="button" className={filter===v?'active':''} onClick={()=>setFilter(v)} key={v}>{v}</button>)}</div>
     <label className="hhba-aa-select"><span className="sr-only">案件类型</span><select value={category} onChange={e=>setCategory(e.target.value)}>{types.map(v=><option key={v}>{v}</option>)}</select></label>
    </div>
    <div className="hhba-aa-table-head"><span>公开编号 / 案件摘要</span><span>案件类型</span><span>状态</span><span>模拟支出</span><span>详情</span></div>
    <div className="hhba-aa-list">
     {filtered.length===0?<div className="hhba-aa-empty">没有找到符合条件的演示案件，请尝试其他关键词或筛选。</div>:filtered.map(item=><button type="button" key={item.id} className="hhba-aa-case" onClick={()=>open(item.id)}>
      <div className="hhba-aa-case-main"><span className="hhba-aa-id">{item.id} <span>· {dateText(item.date)}</span></span><strong>{item.title}</strong><small>{item.background}</small></div>
      <span className="hhba-aa-type">{item.category}</span><span className={'hhba-aa-status '+(item.status==='已完成'?'complete':'ongoing')}>{item.status==='已完成'?<CheckCircle2 size={14}/>:<Clock3 size={14}/>} {item.status}</span><span className="hhba-aa-cost">{item.expense?money(item.expense):'—'}</span><span className="hhba-aa-arrow"><ArrowUpRight size={19}/></span>
     </button>)}
    </div>
    <div className="hhba-aa-table-foot"><span>当前显示 {filtered.length} / {records.length} 条</span><span>演示编号不可用于查询真实案件</span></div>
   </section>
   <footer className="hhba-aa-footer"><ShieldCheck size={20}/><p><strong>关于档案透明与隐私</strong>　正式案例公开前，须取得适当授权并审核隐私风险。公开内容仅提供经脱敏的摘要、处理节点及经核对的资金记录，不公开姓名、证件、工资原件、律师沟通或其他敏感证据。该演示不涉及真实申请人。</p></footer>
  </div>
  {chosen&&<div className="hhba-aa-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
   <section className="hhba-aa-drawer" role="dialog" aria-modal="true" aria-labelledby="hhba-aa-detail-title">
    <div className="hhba-aa-drawer-top"><span><FileText size={17}/> 案件公开档案 / 演示</span><button type="button" onClick={close} aria-label="关闭案件详情"><X size={20}/></button></div>
    <div className="hhba-aa-drawer-scroll">
     <div className="hhba-aa-drawer-id">{chosen.id} <span>· 虚构案例</span></div><h2 id="hhba-aa-detail-title">{chosen.title}</h2>
     <div className="hhba-aa-detail-chips"><span>{chosen.category}</span><span>{chosen.status}</span><span>模拟受理 {dateText(chosen.date)}</span></div>
     <div className="hhba-aa-detail-alert"><ShieldCheck size={16}/> 下列人物背景、争议过程、处理结果与金额均为演示构造，不对应真实案件。</div>
     <div className="hhba-aa-detail-section"><h3><span>01</span> 案件背景</h3><p>{chosen.background}</p></div>
     <div className="hhba-aa-detail-section"><h3><span>02</span> 申请诉求</h3><p>{chosen.request}</p></div>
     <div className="hhba-aa-detail-section"><h3><span>03</span> 模拟服务时间轴</h3><div className="hhba-aa-timeline">
      <div><i/><strong>申请登记</strong><p>已创建演示档案，登记争议类型、申请诉求与材料清单。</p></div>
      <div><i/><strong>情况梳理</strong><p>{chosen.service}</p></div>
      <div><i/><strong>{chosen.status==='已完成'?'服务结案':'后续进度待更新'}</strong><p>{chosen.outcome}</p></div>
     </div></div>
     <div className="hhba-aa-detail-section"><h3><span>04</span> 处理结果</h3><p>{chosen.outcome}</p></div>
     <div className="hhba-aa-detail-money"><div><small>该案模拟帮扶支出</small><strong>{money(chosen.expense)}</strong></div><span>{chosen.expense?'支出类别示意：资料整理及服务协调':'尚未记录模拟支出'}</span></div>
     <div className="hhba-aa-evidence"><strong>公开材料索引</strong><p>正式运营后，可放置经同意与脱敏的受理摘要、核验说明、支出凭证索引和历史版本；当前不提供虚构证明文件。</p><span>凭证状态：演示未接入</span></div>
    </div>
    <div className="hhba-aa-drawer-bottom"><span><Check size={15}/> 演示档案 · 非真实数据</span><button type="button" onClick={close}>返回案例列表 <ChevronRight size={15}/></button></div>
   </section>
  </div>}
 </main>
 </Shell>;
}
