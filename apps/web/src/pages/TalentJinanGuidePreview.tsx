import {UnifiedPolicyGuide,type CompleteGuide} from '../components/talent/UnifiedPolicyGuide';
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

const jinanGuide:CompleteGuide={
 city:'济南',title:'济南市高层次人才生活补贴',kicker:'TALENT POLICY SERVICE · 济南',
 desc:'按人才分类核对就业、参保和申报资格；从判断类别到办理和发放，一步步解释清楚。',
 support:'¥1,000—5,000',unit:'每月 · 按人才类别分别核定',limit:'最长3—5年，实际待遇须审核',
 review:'2026年济南市人社局官方答复已核对；当前受理状态按人才网申报窗口为准。',
 amounts:pay,branches:Object.fromEntries(Object.entries(trackInfo).map(([key,item])=>[key,{
  label:item.label,desc:item.subtitle,conditions:item.conditions,materials:item.materials,warning:item.remark
 }])),
 defaultBranch:'master',steps,checks:checks.map(x=>x.text),
 faq:questions.map(([q,a])=>[q,a] as [string,string]),
 sources:[
  ['2026年官方补贴金额和期限',OFFICIAL.amount],
  ['适用对象及人才类别区分',OFFICIAL.conditions],
  ['申请平台和单位授权流程',OFFICIAL.process],
  ['补贴发放时限与账户',OFFICIAL.payment],
  ['购房、住房待遇互斥说明',OFFICIAL.conflict],
  ['补贴未到账处理办法',OFFICIAL.missing],
  ['济南市2026年区县经办电话',OFFICIAL.contact],
  ['济南起步区2026年落实公示',OFFICIAL.evidence]
 ],
 officialUrl:OFFICIAL.portal,officialLabel:'济南人才网',
 officialNote:'个人与单位分别注册、由单位开通申报权限。登录后的当前申报状态须以实际页面为准。',
 contacts:districts,contactSource:OFFICIAL.contact,
 listPath:'/talent-service/policy-layout-preview/jinan',
 detailPath:'/talent-service/policy/sd-jinan-2026-talent-living',stepPortalIndex:2
};
export function TalentJinanGuidePreview(){return <UnifiedPolicyGuide data={jinanGuide}/>;}
