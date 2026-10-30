import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CheckCircle2,ChevronDown,ClipboardCheck,ExternalLink,FileCheck2,FileText,HelpCircle,Info,Landmark,MapPin,Phone,ShieldCheck,Wallet,AlertTriangle} from 'lucide-react';
import {Link} from '../router';
import '../styles/talent-jinan-guide-preview.css';

type Track='senior'|'doctor'|'master';
type Step={title:string;why:string;action:string;done:string;note?:string};
const OFFICIAL={
 portal:'https://rc.jinan.gov.cn/',
 process:'https://www.jinan.gov.cn/col/col118356/art/2026/art_8f508c1bb00a4a01baacdb1e081d9ef0.html',
 conditions:'https://www.jinan.gov.cn/col/col118356/art/2026/art_fe1a2934b353434abf12db1722a84f2f.html',
 amount:'https://www.jinan.gov.cn/col/col118356/art/2026/art_4460a126d72f475d8b9d3b36f2f8749f.html',
 payment:'https://www.jinan.gov.cn/col/col118356/art/2026/art_92709553d0014c569b8359ee2a2fed8d.html',
 conflict:'https://www.jinan.gov.cn/col/col118356/art/2026/art_a62c9fea317c4110976449b13a17772f.html',
 missing:'https://www.jinan.gov.cn/col/col118356/art/2026/art_7229b6a440d8449792521f50d0ca51ae.html',
 contact:'https://www.jinan.gov.cn/col/col118356/art/2026/art_cea357cf8ad243e890bca858d84d4307.html',
 evidence:'https://jnxxq.jinan.gov.cn/col/col71556/art/2026/art_7dd3fff31d5c4b1ca09e5c4da08c5c47.html'
};
const pay=[
 ['A类人才','5,000 元/月','最长5年'],
 ['B类人才','4,000 元/月','最长5年'],
 ['C类人才','3,000 元/月','最长5年'],
 ['D类人才','2,000 元/月','最长5年'],
 ['符合条件的全日制博士','1,500 元/月','最长3年'],
 ['符合条件的全日制硕士','1,000 元/月','最长3年']
];
const trackInfo:Record<Track,{label:string;subtitle:string;conditions:string[];materials:string[];remark:string}>={
 senior:{
  label:'A—D类高层次人才',subtitle:'认定类人才与硕博学历通道不同',
  conditions:[
   '从济南市外引进，并已获得济南市委人才办相应A、B、C、D类别认定。',
   '申请人、配偶及未满18周岁子女组成的人才家庭，在济南没有政策定义的自有住房。',
   '申请人在济南实际租房居住，须能提供真实租赁合同。',
   '由所在单位协助完成系统授权、真实性核对和属地申报。'
  ],
  materials:[
   'A—D类高层次人才认定相关信息或有效证明。',
   '房屋租赁合同（官方申报细则明确此类人才需上传）。',
   '个人身份与家庭成员住房核验所需信息（是否上传、具体形式以系统提示为准）。',
   '单位注册、申报权限及系统要求的其他补充证明。'
  ],
  remark:'不要将A—D类“在济无自有住房、实际租房”的条件直接套用硕博学历通道，二者应分别核验。'
 },
 doctor:{
  label:'全日制博士研究生',subtitle:'按所在单位类型分别核对准入',
  conditions:[
   '新引进至驻济企业的全日制博士；或驻济科研院所、医疗机构、相关事业单位新引进的全日制博士；驻济高校博士另有全球TOP200高校范围要求。',
   '首次向区县提交申请时，毕业时间不超过3年。',
   '与用人单位签订至少3年的劳动合同或聘用合同，并在济南正常缴纳社会保险。',
   '单位协助注册授权并按就业所在地办理属地审核。'
  ],
  materials:[
   '博士毕业证、学位证及学历认证信息（具体以系统核验提示为准）。',
   '三年及以上劳动合同或聘用合同、真实在职资料。',
   '济南市社会保险参保记录，供系统比对。',
   '高校任职博士如涉及全球TOP200条件，应核对对应学校及排名认定口径。'
  ],
  remark:'“毕业不超过3年”对应首次提报至区县的时点，不是可以在济南工作满3年后再无条件申报。'
 },
 master:{
  label:'全日制硕士研究生',subtitle:'重点核实企业引进、毕业年限与合同',
  conditions:[
   '属于驻济企业新引进的全日制硕士研究生；不是所有在济硕士都自动具备资格。',
   '首次向区县提交申请时，毕业时间不超过3年。',
   '与用人单位签订3年及以上劳动合同（聘用合同），并在济正常缴纳社会保险。',
   '个人和所在单位都需要注册济南人才网账户，由单位开通申报权限。'
  ],
  materials:[
   '全日制硕士毕业证、学位证及学历认证资料。',
   '至少3年的劳动合同（聘用合同）或系统要求的合同证明。',
   '济南社保正常参保记录，供系统核对。',
   '单位为申请人授权及填写申报信息所需的其他证明。'
  ],
  remark:'官方答复明确支持“驻济企业新引进的全日制硕士”；在高校或其他单位任职的硕士不能直接套用这一条。'
 }
};
const steps:Step[]=[
 {title:'先判断自己走哪条人才申报通道',
  why:'生活补贴分为A—D类认定人才与符合条件的博士、硕士等路径；两类条件不相同。',
  action:'对照页面上方的“适用人群”切换你的实际类别。A—D类查看是否取得市委人才办认定，硕博按单位类型、学历和毕业时间筛查。',
  done:'能够确定自己属于哪个政策对象，或列出需要咨询人社部门的资格问题。',
  note:'只提供条件自查，不代表已获得政府的人才类别认定。'},
 {title:'核对合同、社保和住房要求',
  why:'符合学历仅是必要条件的一部分，劳动合同、正常参保及住房条件可能直接影响审核。',
  action:'硕博通道重点核对首次申报时毕业不超过3年、合同期限至少3年及在济正常参保；A—D类人才核对家庭无自有住房、实际租房和租赁合同。',
  done:'找到合同、社保记录、住房情况与申请条件的对应证明材料。'},
 {title:'让用人单位先开通申报权限',
  why:'济南市人社局明确规定，个人不能跳过单位核实直接完成属地审核。',
  action:'打开济南人才网，请单位人力资源部门注册/登录单位账户，同时申请人注册个人账户；单位在系统中为申请人开通“高层次人才生活补贴”申报权限。',
  done:'个人账户中可以进入对应生活补贴申报事项，单位确认可配合核实。',
  note:'若看不到申报事项，先核对单位是否完成授权；不要把政府网站首页当成已经提交申请。'},
 {title:'按系统提示填报并上传附件',
  why:'资料不准确或证明不完整可能导致补正或审核延迟。',
  action:'在“高层次人才生活补贴”系统填报真实个人信息、工作单位及相关资格材料；A—D类须上传房屋租赁合同。硕博资料先经过学历与社保等数据核验，如系统未通过比对，再按提示补充佐证。',
  done:'申报材料在系统内成功提交至所在用人单位，留存提交记录。',
  note:'材料清单是政策要求与准备建议的组合，最终以当前系统要求为准。'},
 {title:'单位核实后，进入区县受理与人才办审核',
  why:'不同区县由单位所在地主管部门受理，提交给单位不等于政府已经受理。',
  action:'用人单位对申请资料真实性核实确认，再按单位所在地提交至区县人社部门；人社部门和区县委人才办按规定审核。关注系统补正、复核与当地政府公示。',
  done:'能在系统或相应区县公告中核对审核结果，不再把“单位已提交”误当“补贴获批”。'},
 {title:'查看发放、账户信息与后续变化',
  why:'审核通过不等于当天到账；社保卡金融账户及就业状态会影响发放。',
  action:'按济南市人社局2026年答复，通常在审核通过后的下一季度发放至登记的社保卡金融账户；检查账户是否已激活、信息是否一致，关注所在区县公示。如单位变化、社保中断或申请购房补贴，应及时咨询经办区县。',
  done:'明确本人的审核季度、预计发放季度、收款账户及咨询电话。',
  note:'区县实际发放时间、后续年度资格和变更处理，以最新部门通知为准。'}
];
const checks=[
 {id:'track',text:'已核对自己属于A—D认定人才或符合条件的硕博通道'},
 {id:'dates',text:'已核对毕业时间、单位类别及相关人才认定限制'},
 {id:'work',text:'已确认劳动合同、济南参保或本通道住房条件'},
 {id:'account',text:'已联系单位人事开通个人申报权限'},
 {id:'files',text:'已根据申报页面准备相应证明与附件'},
 {id:'bank',text:'已核对社保卡金融账户和区县咨询方式'}
];
const questions=[
 ['本科毕业可以直接申请这项每月1000—5000元的生活补贴吗？','不能仅凭本科学历申领本项硕博或A—D类生活补贴。符合条件的本科生可另外查询济南本科毕业生租赁住房等政策，不能混淆两项待遇。'],
 ['硕士必须先认定为A、B、C、D类人才吗？','不一定。济南市人社局把“驻济企业新引进的全日制硕士”单列为支持对象，重点审核毕业年限、合同、社保及单位条件；A—D类是另一条人才认定路径。'],
 ['硕士毕业超过三年还能首次申请吗？','按济南市人社局2026年官方答复，硕博学历通道首次提报至区县时毕业不超过3年。超过时限一般不满足该通道的首次申报条件，是否有其他适用人才政策需咨询当地部门。'],
 ['个人账户已经注册，为什么找不到申报入口？','个人和单位均须注册济南人才网；单位需要先为个人开通相应事项权限。如果尚未授权，应联系用人单位人事部门核查。'],
 ['审核通过后多久能领到补贴？','2026年1月济南市人社局的答复是：审核通过后的下一季度内发至登记的社保卡金融账户。例如第一季度审核通过，通常第二季度发放。'],
 ['社保卡没收到钱怎么办？','先核对区县公示及当前所属发放季度；再检查社保卡金融账户是否开通、账户类型、开户行及姓名等是否一致。若列在公示名单仍未到账，联系所在区县人社部门核查。'],
 ['可以同时申请购房补贴、人才公寓和生活补贴吗？','不能直接叠加。济南市人社局说明：生活补贴与市级统筹人才公寓当年度不得同时享受，与硕博租赁住房补贴不重复；已享受高层次人才购房补贴的，不再享受生活补贴。'],
 ['换公司或社保中断，还能继续领吗？','工作单位、就业区县和参保记录变化都可能影响后续审核与支付，应及时告知原单位和所在区县经办部门，按其要求变更信息。不可简单断言一律停发或一律不影响。']
];
const districts=[
 {name:'历下区',phone:'0531-88152310'},
 {name:'市中区',phone:'0531-51806989'},
 {name:'槐荫区',phone:'0531-87067277'},
 {name:'天桥区',phone:'0531-85872683'},
 {name:'历城区',phone:'0531-88906698'},
 {name:'长清区',phone:'0531-87217181'},
 {name:'章丘区',phone:'0531-83232918'},
 {name:'济阳区',phone:'0531-84238716'},
 {name:'莱芜区',phone:'0531-76113396'},
 {name:'钢城区',phone:'0531-75873011'},
 {name:'平阴县',phone:'0531-87890710'},
 {name:'商河县',phone:'0531-84880198'},
 {name:'高新区',phone:'0531-88871223'},
 {name:'南部山区',phone:'0531-88112713'},
 {name:'起步区',phone:'0531-66604391'}
];
export function TalentJinanGuidePreview(){
 const [track,setTrack]=useState<Track>('master');
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [district,setDistrict]=useState('历下区');
 const [openFaq,setOpenFaq]=useState<number|null>(0);
 const [searchFaq,setSearchFaq]=useState('');
 const items=useMemo(()=>questions.map(([q,a],i)=>({q,a,i})).filter(x=>(x.q+x.a).includes(searchFaq.trim())),[searchFaq]);
 const progress=checks.filter(x=>selected[x.id]).length;
 const active=trackInfo[track];
 const selectedDistrict=districts.find(x=>x.name===district)!;
 return <main className="jgd-page">
   <nav className="jgd-breadcrumb" aria-label="当前位置"><Link to="/talent-service">人才服务</Link><span>›</span><Link to="/talent-service/policy-layout-preview/jinan">济南政策样板</Link><span>›</span>详细办理指南</nav>
   <header className="jgd-hero">
    <div className="jgd-hero-text"><span className="jgd-kicker">HHBA / TALENT POLICY SERVICE · 济南单城V3.1样板</span><h1>济南市高层次人才生活补贴</h1>
     <p>从“我能不能申请”到“去哪里申请、怎样拿到补贴”，按照官方发布的流程一步步说明。</p>
     <div className="jgd-tags"><span>2026年官方问答已核对</span><span>线上申报</span><span>资格及受理状态以政府核定为准</span></div>
    </div>
    <div className="jgd-hero-aside"><span>符合条件的不同类别标准</span><strong>¥1,000—5,000</strong><small>每月 · 按人才类别分别核定</small><span>最长3—5年 · 不可视为人人可领</span></div>
   </header>
   <nav className="jgd-page-nav" aria-label="本页快速导航"><a href="#jgd-money">补贴标准</a><a href="#jgd-eligibility">资格条件</a><a href="#jgd-steps">6步申请指南</a><a href="#jgd-checks">材料自查</a><a href="#jgd-faq">常见疑问</a><a href="#jgd-source">官方入口</a></nav>
   <div className="jgd-layout"><div className="jgd-main">
    <section id="jgd-money" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><Wallet size={18}/></span><div><h2>01 政策支持与补贴标准</h2><p>按人才类别分别认定，不是“学历达到就能直接领取”。</p></div></div>
     <div className="jgd-money-table"><table><thead><tr><th>人才类别</th><th>月度补贴标准</th><th>最长期限</th></tr></thead><tbody>{pay.map(row=><tr key={row[0]}>{row.map((value,i)=><td key={i}>{value}</td>)}</tr>)}</tbody></table></div>
     <div className="jgd-tip"><Info size={16}/><p>表格金额来源于济南市人社局2026年1月30日官方答复。申报资格及发放时间按个人类别、实际审批和当期公告确定。<a href={OFFICIAL.amount} target="_blank" rel="noopener noreferrer">查看官方金额说明 <ArrowUpRight size={12}/></a></p></div>
    </section>
    <section id="jgd-eligibility" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><ShieldCheck size={18}/></span><div><h2>02 谁可以申请？需要满足什么条件？</h2><p>选择与你相符的类别，页面会展示对应条件及准备资料。</p></div></div>
     <div className="jgd-track-tabs" role="group" aria-label="选择人才类型">
      {([['master','全日制硕士'],['doctor','全日制博士'],['senior','A—D类认定人才']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={track===value} className={track===value?'active':''} onClick={()=>setTrack(value)}>{label}</button>)}
     </div>
     <div className="jgd-track-box"><h3>{active.label}</h3><p>{active.subtitle}</p><ul>{active.conditions.map((c,i)=><li key={i}><CheckCircle2 size={15}/><span>{c}</span></li>)}</ul>
      <div className="jgd-track-remark"><AlertTriangle size={16}/>{active.remark}</div>
     </div>
     <a className="jgd-inline-ref" href={OFFICIAL.conditions} target="_blank" rel="noopener noreferrer"><FileText size={14}/> 济南市人社局2026年申请条件原文 <ArrowUpRight size={13}/></a>
    </section>
    <section id="jgd-steps" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><ClipboardCheck size={18}/></span><div><h2>03 申请办理：从准备到发放的6个步骤</h2><p>每一步都解释“为什么做、具体做什么、完成后应该看到什么”。</p></div></div>
     <ol className="jgd-step-list">{steps.map((step,i)=><li className="jgd-step" key={step.title}>
      <span className="jgd-step-index">{i+1}</span><div className="jgd-step-content"><h3>{step.title}</h3>
       <div className="jgd-step-detail"><p><strong>为什么要做</strong>{step.why}</p><p><strong>具体怎么做</strong>{step.action}</p><p><strong>完成后的确认</strong>{step.done}</p></div>
       {step.note&&<p className="jgd-step-note">{step.note}</p>}
       {i===2&&<a className="jgd-step-action" href={OFFICIAL.portal} target="_blank" rel="noopener noreferrer">打开济南人才网官方入口 <ArrowUpRight size={14}/></a>}
      </div>
     </li>)}</ol>
     <div className="jgd-tip"><Info size={16}/><p>申报顺序以济南市人社局2026年1月30日说明为依据；材料补正、所在区县审核周期及页面功能以系统实际显示为准。<a href={OFFICIAL.process} target="_blank" rel="noopener noreferrer">核对官方办理说明 <ArrowUpRight size={12}/></a></p></div>
    </section>
    <section id="jgd-checks" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><FileCheck2 size={18}/></span><div><h2>04 申请前检查清单</h2><p>勾选已确认的事项，仅保留于当前网页，不上传个人数据。</p></div></div>
     <div className="jgd-progress"><span>已确认 {progress}/{checks.length} 项</span><div role="progressbar" aria-label="申请前准备进度" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={progress}><span style={{width:(progress/checks.length*100)+'%'}}/></div></div>
     <div className="jgd-checklist">{checks.map(row=><label key={row.id}><input type="checkbox" checked={Boolean(selected[row.id])} onChange={e=>setSelected(x=>({...x,[row.id]:e.target.checked}))}/><span>{row.text}</span></label>)}</div>
     <h3 className="jgd-material-heading">当前选中类别建议提前准备</h3><ul className="jgd-materials">{active.materials.map((x,i)=><li key={i}>{x}</li>)}</ul>
     <p className="jgd-mutedsmall">这是一份准备建议，不是政府系统的最终材料清单，也不表示已通过资格审核。</p>
    </section>
    <section id="jgd-faq" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><HelpCircle size={18}/></span><div><h2>05 常见问题与容易踩的坑</h2><p>从学历要求、单位授权、重复享受到补贴不到账，逐项解释。</p></div></div>
     <label className="jgd-faq-search">快速查找问题 <input type="search" value={searchFaq} onChange={e=>setSearchFaq(e.target.value)} placeholder="例如：社保、硕士、到账、购房..." /></label>
     <div className="jgd-faq-list">{items.map(item=><div className="jgd-faq-item" key={item.i}><button type="button" aria-expanded={openFaq===item.i} onClick={()=>setOpenFaq(x=>x===item.i?null:item.i)}><span>{item.q}</span><ChevronDown size={16} className={openFaq===item.i?'opened':''}/></button>{openFaq===item.i&&<p>{item.a}</p>}</div>)}{!items.length&&<p className="jgd-no-results">没有匹配的问题，请尝试“补贴”“申报”等关键词。</p>}</div>
    </section>
    <section id="jgd-source" className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><Landmark size={18}/></span><div><h2>06 官方申报入口与咨询方式</h2><p>清楚区分“直接申报平台”和“官方依据文档”。</p></div></div>
      <div className="jgd-portal"><div><strong>济南人才网</strong><span>市人社局指明的在线申报平台</span><small>个人和单位分别注册；单位先开通个人申报权限。</small></div><a href={OFFICIAL.portal} target="_blank" rel="noopener noreferrer">进入官方平台 <ExternalLink size={15}/></a></div>
      <p className="jgd-portal-warning"><AlertTriangle size={15}/> 官方入口由市人社局2026年答复确认；本次仅能核实其官方指向，网站当前可达性及登录后页面未能实时验证。</p>
      <label className="jgd-district"><MapPin size={15}/> 选择单位所在区县 <select value={district} onChange={e=>setDistrict(e.target.value)}>{districts.map(d=><option value={d.name} key={d.name}>{d.name}</option>)}</select></label>
      <div className="jgd-contact"><div><span>{selectedDistrict.name} · 人才生活补贴咨询</span><strong>{selectedDistrict.phone}</strong><small>咨询前可准备毕业年限、单位区县、合同及参保信息；不要在公共网站提交证件号码。</small></div><a href={'tel:'+selectedDistrict.phone}><Phone size={15}/> 拨打电话</a></div>
      <a className="jgd-inline-ref" href={OFFICIAL.contact} target="_blank" rel="noopener noreferrer">查看济南市人社局2026年区县完整电话及窗口地址 <ArrowUpRight size={14}/></a>
      <div className="jgd-sources"><h3>核验过的官方依据</h3>
       {[
        ['2026-01-30 · 申报流程及单位授权',OFFICIAL.process],
        ['2026-01-30 · 支持对象及申请条件',OFFICIAL.conditions],
        ['2026-01-30 · 补贴金额与期限',OFFICIAL.amount],
        ['2026-01-30 · 审核通过后的发放时间',OFFICIAL.payment],
        ['2026-01-30 · 与住房类补贴的互斥要求',OFFICIAL.conflict],
        ['2026-01-30 · 补贴未到账排查方法',OFFICIAL.missing],
        ['2026-04-01 · 济南起步区2026版补贴公示',OFFICIAL.evidence]
       ].map(([label,url])=><a key={url} href={url} rel="noopener noreferrer" target="_blank">{label}<ArrowUpRight size={13}/></a>)}
      </div>
    </section>
   </div><aside className="jgd-side"><div className="jgd-side-card"><span>办理重点</span><h3>先确认资格，再开始网申</h3><ul><li>这项补贴有不同人才通道</li><li>单位须开通申报权限</li><li>按单位所在地的区县审核</li><li>审核通过通常下季度到账</li></ul><a href={OFFICIAL.portal} target="_blank" rel="noopener noreferrer">济南人才网 <ArrowUpRight size={13}/></a></div><div className="jgd-side-card"><span>页面状态</span><p>单项政策V3.1独立预览。其他城市、旧版详情和首页未修改。</p><Link to="/talent-service/policy/sd-jinan-2026-talent-living">对比原详情页 <ArrowRight size={13}/></Link></div></aside></div>
   <footer className="jgd-footer"><Link to="/talent-service/policy-layout-preview/jinan"><ArrowLeft size={14}/> 返回济南政策新版列表</Link><span>2026-10-30 核验 · HHBA 信息整理，仅供辅助理解，不替代政府审核</span></footer>
 </main>;
}
