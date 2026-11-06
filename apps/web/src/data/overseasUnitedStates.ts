/* HHBA 美国海外发展：只提供官方依据与操作路线，不做个人资格保证。2026-11-06资料整理。 */
import {usRoutesA} from './overseasUnitedStatesA';
import {usRoutesB} from './overseasUnitedStatesB';
import type {UsPathway} from './overseasUnitedStatesTypes';
export type {UsPathway} from './overseasUnitedStatesTypes';
export const usVerifiedOn='2026-11-06';
export const usPathways:UsPathway[]=[...usRoutesA,...usRoutesB];
export const usNotEligible=[
 {title:'B-1/B-2访客签证不是普通就业或攻读学位签证',detail:'普通旅游/商务访客身份不能直接从事美国当地就业，也不能取代需要F-1/M-1的学历学位课程；商务考察、短期非学分兴趣课程有严格例外。',url:'https://travel.state.gov/content/travel/en/us-visas/business/b-1-fact-sheet.html'},
 {title:'中国大陆普通护照不是E-2投资者条约国国籍',detail:'国务院中国国籍对等表将E-1/E-2标为No Treaty。除非另具符合条件的条约国国籍并满足独立规则，不应宣传中国普通护照可直接通过美国E-2。',url:'https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/China.html'},
 {title:'F-1 CPT、OPT与STEM OPT都不是独立签证',detail:'CPT由学校DSO根据课程批准，OPT/STEM OPT通常需要USCIS授权与符合规定的EAD。拿到学校录取或企业offer不意味着可以直接开始校外工作。',url:'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html'},
 {title:'H-1B已实施2027财年工资等级加权规则',detail:'2026年3月举行的2027财年初始注册已结束。2025/2026总统公告涉及10万美元付款要求，但诉讼、例外及执行状态存在争议；只有当期USCIS和法院信息才能确定某个申请是否适用。',url:'https://content.govdelivery.com/accounts/USDHSCIS/bulletins/406da02'},
 {title:'中国大陆出生申请人的职业移民排期不是全部Current',detail:'截至2026年11月国务院Visa Bulletin，中国大陆出生申请人的EB-1、EB-2、EB-3常规类别和EB-5无保留类别均有Final Action截止日期；不要把I-140批准当作立即取得绿卡。',url:'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html'},
 {title:'美国签证审查包含对部分申请人线上公开信息的审查',detail:'2026年9月国务院更新部分非移民签证审核通知。申请人应按领事馆当期指引核对真实材料与线上信息，不得造假，也不可承诺免面谈。',url:'https://travel.state.gov/en/newsroom/visas/2026/announcement-of-expanded-screening-and-vetting-for-visa-applicants.html'}
];
export const usQuickSources=[
 {label:'美国国务院签证类别',url:'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/all-visa-categories.html'},
 {label:'美国公民及移民服务局USCIS',url:'https://www.uscis.gov/'},
 {label:'美国国务院11月移民排期',url:'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html'},
 {label:'国务院签证收费表',url:'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html'}
];
if(new Set(usPathways.map(p=>p.id)).size!==usPathways.length)throw new Error('Duplicate US route ids');
