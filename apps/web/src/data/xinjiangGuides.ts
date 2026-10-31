import type {CompleteGuide,GuideBranch,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {XINJIANG_14_PREFECTURES,XINJIANG_POLICY_RECORDS} from './xinjiangPolicyRecords.ts';
import {XINJIANG_HOUSING_RECORDS} from './xinjiangHousingRecords.ts';
export {XINJIANG_14_PREFECTURES} from './xinjiangPolicyRecords.ts';
export const XINJIANG_CORPS_CITIES_2026=['石河子','阿拉尔','图木舒克','五家渠','北屯','铁门关','双河','可克达拉','昆玉','胡杨河','新星','白杨','草湖'] as const;
export function xinjiangGuideUrl(kind:'policy'|'housing',id:string):string{return '/talent-service/policy-guide-preview/xinjiang/'+kind+'/'+encodeURIComponent(id);}
const FAQs:[string,string][]=[
 ['同在新疆，兵团师市能直接套用地州的人才补贴吗？','不能。新疆生产建设兵团师市具有独立管理和部分单独财税、人社政策；14个地州市记录不自动适用兵团直辖市。'],
 ['毕业证学历够了就能领取最高购房补贴吗？','不能。许多项目要求通过正式引进、五年服务与考核后在指定市州买房，金额按县市人才等级核算。'],
 ['生活补助与购房补助一定可以同时领取吗？','不一定，例如昌吉2026公告明确已经享受生活补助的引进人才不得重复领取购房补助。'],
 ['人口引进公告的招录计划人数是现有可报名岗位数量吗？','不是。招聘公告的计划、实际资格审核、报名截止和已录用数据必须分开。'],
 ['公租房/保租房建设套数是目前可申请的房号吗？','不是。工程招标、计划建设、历史存量、建成已入住和当前空房是五种不同状态。'],
 ['2026年政策文件的政府网址是否就是申请入口？','通常不是。政策文章仅是法规说明，需依最新招聘、政务办事服务或住房项目运营方指定平台申报。'],
 ['本科或硕士是否可直接预约政府人才公寓？','不可以。必须满足本地区真实招录或住房资格，并等待管理单位审核及有实际可配房号。'],
 ['公寓与替代租房补贴能同时享受吗？','通常不能。诸多人才政策明确在公寓无法安排时才允许申请现金租房支持，具体互斥以本地公告为准。'],
 ['住房配售是否为政府送的现金？','不是。配售型保障住房是限定准入的住房买卖，购买价格和房号需要按项目实际合同确定。'],
 ['能把和田人才住房工程招标价当成个人补贴金额吗？','不能。政府工程招标金额是采购预算，和招引人才个人现金收入无关。'],
 ['今天是2026年11月，2026年上半年报名网址还能使用吗？','不能以原链接仍能访问就认定报名开放；需要查看相应公告明确的报名截止与最新补充公告。'],
 ['本平台能否保证资格、补贴到账或现时公寓空房？','不能。HHBA整理政策与官方证据，真实资格、资金、物业租金与分房均由政府主管部门及授权运营方核准。']
];
export function buildXinjiangGuide(kind:'policy'|'housing',id:string):CompleteGuide|null{
 const p=kind==='policy'?XINJIANG_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?XINJIANG_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 if(!p&&!h)return null;
 const record=p||h!,today=new Date().toISOString().slice(0,10);
 const outdated=p?Boolean(p.temporal!=='policy'||p.deadline&&p.deadline<today):Boolean(h?.applicationEnd&&h.applicationEnd<today);
 const caution=p?.reviewNote||h?.statusNote||'现行办理请核实主管部门原文';
 const materials=p?.materials?.length?p.materials:[
 '本人身份证及实际共同申请家庭信息（如需）',
 '正式人才类别、就业岗位/劳动合同及在岗社保材料（适用时）',
 '住房困难、家庭住房/收入、现有住房保障与项目资格材料',
 '正式当期申请表、诚信承诺及主管部门要求的附件'];
 const actions=p?.applicationSteps?.length?p.applicationSteps:h?.steps||[];
 const steps:GuideStep[]=actions.map((action,i)=>({
 title:['政策原文与报名时间','个人及行政属地条件','指定证明与申请材料','主管部门真实办理入口','资格复审、公示与结果'][i]||'后续核实事项',
 why:['政府源存在不等于申报仍开放，历史项目、在建住房、在租住房各有不同截止与状态','兵团师市与地方14地州的管理口径不同，县市不能直接套用自治区最高待遇','材料清单仅能以所申请政策真实事项为准，勿上传无关个人隐私','政府新闻、工程招标、中标结果、政策指引不是实时空房和网上提交页','提交不等于获批，兑现须看住房分配及财政审核'][i]||'属地正式办事规定优先',
 action,done:'已用主管部门最新公告核实本项；未能证明有效办理时保持“待核验”'
 }));
 const branches:Record<string,GuideBranch>={
 eligible:{label:p?.payoutTo==='用人单位'?'可能有资格的申报单位':'可能符合对象的申请人',desc:p?.targetGroup||h?.eligibility||'',
 conditions:[p?.eligibility||h?.eligibility||'','申请人的真实工作居住/人才认定属地与本市州相符','按政策核验期限、已有住房保障与资金补贴互斥条件'],materials,warning:caution},
 other:{label:'不适用的对象/地区',desc:'不得直接跨市、跨县或跨兵团套用人才住房及补助',
 conditions:['根据本人实际岗位和行政区找对应政策','不是实际招录人才不得借人才资格申领住房补助','已过期或施工中的项目不能当可直接申请'],materials:['真实身份和实际就业/居住区域证明','自己所属县市的最新政府办事公告'],warning:caution},
 verify:{label:'房源、资金或办理渠道待核实',desc:'只有主管部门当期确认才可实际申报',
 conditions:['逐项核对政府原文、最新执行年份和截止日期','取得明确的当前在线或线下受理窗口','住房要取得具体可租房号及当期租金，不以规划数量代替'],materials:['当期经办部门答复或新发布公告','该项目的真实申报材料清单'],warning:caution}
 };
 const sep=p?'policy':'housing';
 return {
 city:record.city,title:record.title,kicker:'新疆维吾尔自治区 · '+record.city+' · '+(p?'人才政策/服务':'安居住房')+' V6',
 desc:p?.summary||h?.statusNote||'',support:p?.headlineAmount||(h?.kind==='project'?'项目证据':'住房保障/实施事项'),
 unit:p?.headlineUnit||'历史项目、在建房与实有空房严格分开',
 limit:outdated?'招聘、配租或历史资料已过有效期，不得沿旧链接直接申报':p?.deadline?'公告期限至 '+p.deadline+'，实际报名须另核':'当前办理入口及实际住房库存须单独核查',
 review:caution,qualityLevel:outdated?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'住房',p?.benefit||h?.rent||'按实际项目标准核定','资格不同不得统一推导最高额'],['适用地区',p?.district||h?.district||record.city,'自治区地方/兵团师市政策必须分开']],
 branches,defaultBranch:'eligible',steps,
 checks:['核对官方原文及发布日期','确认事项是政府住房制度、工程项目、招聘还是现金补助','确认所属县市与兵团师市权限','审核本人学历/职称、就业在岗或住房资格',...materials,'取得政府最新实际受理渠道','如申请住房需核对现在真实空房、房型及租金'],
 faq:FAQs,
 sources:[[p?.sourceName||'住建政府/人社主管部门住房公开证据',record.sourceUrl]],
 officialUrl:p?.applicationUrl||h?.applyUrl,officialLabel:p?.applicationUrl||h?.applyUrl?'官方业务入口（时效另核）':'真实事项申报入口待核实',
 officialNote:caution,contacts:[],
 listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(record.city),
 detailPath:'/talent-service/'+sep+'/'+encodeURIComponent(record.id)
 };
}
