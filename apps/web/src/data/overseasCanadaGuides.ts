import {allCanadaRoutes,caOfficial,caVerifiedOn} from './overseasCanada.ts';
import {pack} from './overseasNzGuidesV2a.ts';
import type {DetailedGuide} from '../components/OverseasDetailedGuide';
type Line=[string,string,string];
const toPoints=(a:Line[])=>a;
export const caCompleteGuides:Record<string,DetailedGuide>=Object.fromEntries(allCanadaRoutes.map(route=>{
 const chapters:[string,Line[]][]=[
  ['先识别这条加拿大项目真正适用的人群和法律目的，永久居民申请、临时工作许可、学生许可和类别邀请不是同一件事。',[
   ['这到底是一条什么路径',route.summary,'先记下该项目的官方英文名称与IRCC政府页面，判断是PR移民、工作许可、留学，还是仅为筛选制度。'],
   ['哪些人需要重点查看',route.audience,'核对自己真实的教育、语言、工作地点、合法身份和目标省份，列出当前具备和暂不具备的资格。'],
   ['最容易误解的情况',route.risks[0]||'申请条件不能只凭中介宣传认定。','用IRCC或所在省的公开文件验证任何门槛，条件不足先不要付款。']
  ]],
  ['把2026官方核心门槛逐项拆开。职业NOC、TEER、语言、合法有薪工作、工资或真实工作offer需要以该类别为准。',toPoints(route.thresholds)],
  ['每项证据说明了为什么需要、从什么官方机构或真实雇主取得以及怎样判断缺口；不能只上传“个人简历”。',toPoints(route.documents)],
  ['按真实办理顺序完成官网资格确认、申请或邀约、准备证明、递交审批，每一步保留具体产出。',toPoints(route.steps)],
  ['资金证明、考试和学历评估、政府申请费、生活成本互不相同；以下逐项核对真实承担者和计算方法。',toPoints(route.budget)],
  ['真实流程由资格核实、岗位/学校申请、地方提名、联邦审批等不同节点组成，任何处理时间都不是个人保证。',toPoints(route.timeline)],
  ['申请或获得身份后，合法工作、雇主变更、学校要求、家庭与省级执照按批准文件分别决定，不能混称“拿到签证就能随便工作”。',toPoints(route.rights)],
  ['了解续签、从临时身份到永久居民的真实其他条件，以及当某一通道关闭、offer撤销或资格不足时的合法选择。',toPoints(route.next)]
 ];
 if(chapters.length!==8||chapters.some(x=>x[1].length<3))throw new Error('Incomplete Canadian 8 chapters: '+route.id);
 const titleMap:Record<string,string>={
 fsw:'加拿大IRCC：联邦技术工人项目与67分条件',cec:'加拿大IRCC：CEC真实有薪工作经验',
 fst:'加拿大IRCC：联邦技工项目与真实资格证',
 category:'加拿大IRCC：2026职业与法语类别（NOC表）',
 reform:'加拿大IRCC：2026年11月3日CRS/LMIA重大变更',jobOffer:'加拿大IRCC：2026年Express Entry真实工作offer规则',
 crs:'IRCC CRS官方新分数计算器',language:'IRCC语言考试与CLB/NCLC换算',funds:'IRCC最新家庭人数安家资金证明',
 pnp:'联邦IRCC省提名类别与各省官方入口',pnpEE:'IRCC：省提名额外600分及确认时限',
 aip:'IRCC大西洋移民正式申请步骤',aipEligibility:'IRCC大西洋移民雇主、语言与经验条件',
 rcip:'IRCC乡村社区RCIP十四个社区',fcip:'IRCC法语社区FCIP六个社区',
 employer:'IRCC雇主专属工作许可与LMIA',francophone:'IRCC法语流动C16免LMIA工签',
 study:'IRCC学习许可正式申请流程',studyMoney:'IRCC 2026-09-01以后留学生活费最低额',pal:'IRCC 2026 PAL/TAL与公立硕博豁免',
 pgwp:'IRCC毕业工作许可PGWP合格条件',pgwpField:'IRCC 2026 PGWP合格专业CIP冻结目录',
 quebec:'魁省PSTQ独立选拔官方说明',quebecInvites:'魁省Arrima 2026邀请轮次',
 peqClosed:'魁省PEQ 2026-10-31关闭公告',noc:'加拿大NOC五位职业编码及任务清单',
 canadaJobBank:'加拿大Job Bank政府招聘查询',startup:'IRCC创业签证暂停公告',express:'IRCC FSW/CEC/FST联邦经济类资格'
 };
 const sources=route.sourceKeys.map(x=>[titleMap[x]||x,caOfficial[x],'打开官方原文逐项核验该路径的资格、办理步骤和2026最新状态'] as [string,string,string]);
 const faq=route.faq;
 return [route.id,pack(route.id,'一句话：'+route.summary,'建议先做：'+route.thresholds[0][2],chapters,faq,[...route.risks,'官方资料核验日：'+caVerifiedOn+'。加拿大联邦、魁省及其他省政府可更改职业、资金、邀请、工作许可及审批条件。提交当天必须重新查看官方材料；HHBA不保证任何申请结果。'],route.terms,sources)];
}));
