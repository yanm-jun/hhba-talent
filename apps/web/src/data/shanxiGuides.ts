import type {CompleteGuide,GuideStep} from '../components/talent/UnifiedPolicyGuide';
import {SHANXI_POLICY_RECORDS} from './shanxiPolicyRecords';
import {SHANXI_HOUSING_RECORDS} from './shanxiHousingRecords';
export const SHANXI_CITIES=['太原','大同','阳泉','长治','晋城','朔州','晋中','运城','忻州','临汾','吕梁'] as const;
export const shanxiGuideUrl=(kind:'policy'|'housing',id:string)=>'/talent-service/policy-guide-preview/shanxi/'+kind+'/'+encodeURIComponent(id);
export function getShanxiGuide(kind:string,id:string):CompleteGuide|undefined{
 const p=kind==='policy'?SHANXI_POLICY_RECORDS.find(r=>r.id===id):undefined;
 const h=kind==='housing'?SHANXI_HOUSING_RECORDS.find(r=>r.id===id):undefined;
 if(!p&&!h)return undefined;
 const item=p||h!;
 const isPast=p?.temporal==='historical'||Boolean(h?.applicationEnd&&h.applicationEnd<'2026-10-31');
 const risk=p?.reviewNote||h?.statusNote||'申请条件及办理入口待核实';
 const conditions=p?.eligibility||h!.eligibility;
 const details=p?.benefit||h!.rent;
 const materials=p?.materials||['本人及家庭身份和当地住房证明（依政府要求）','用人单位及就业、社保材料（依具体项目要求）','当期政府申请表及申报材料（须从官方经办机构取得）'];
 const steps=p?.applicationSteps||h!.steps;
 const guideSteps:GuideStep[]=steps.map((action,i)=>({title:['核对政策版本与地区','确认个人或企业资格','检查补贴金额与材料','核对当前申报渠道','等待正式审核结果'][Math.min(i,4)],why:['不同城市不能混用政策，省级统一规定须注意属地。','实际身份、就业和住房条件决定能否申请。','政策最高额度及历史建设规模不是实际审批或实时空房。','政府政策原文不等于具体在线受理事项。','只有政府审核及签约或资金发放能够确认结果。'][Math.min(i,4)],action,done:['已确认官方发文及适用城市','已逐项核对真实资格','已确认具体材料与金额限制','已找到有效官方办理事项或明确待核实','已取得政府真实审核结果，不凭本站推断'][Math.min(i,4)]}));
 return {city:item.city,title:item.title,kicker:'山西省 · 全国人才城市V5.1',desc:p?.summary||h!.statusNote,
 support:p?.headlineAmount||'住房制度信息',unit:p?.headlineUnit||'非实时房源',limit:isPast?'历史资料不可直接当2026现行申报':'当前受理以政府公布为准',
 review:'资料核验2026-10-31；未独立通过A级验收',qualityLevel:isPast?'C':'B',
 amounts:[[p?.category||h?.housingCategory||'住房',details,p?.headlineUnit||'按实际条件核实'],['适用对象或项目范围',p?.targetGroup||h?.district||'',conditions],['限制和来源',risk,item.published]],
 branches:{eligible:{label:'查看适用条件',desc:'以本条政府原文为依据，实际审核由主管部门进行。',conditions:[conditions,risk],materials,warning:risk},other:{label:'不确定或不符合条件',desc:'不可跨市套用，不得把同省统一政策视为本市独立新政。',conditions:['核查属地和政策资格','检查家庭住房、就业和历史补贴限制','联系主管部门确认更适用的项目'],materials,warning:'申报入口和材料以真实政府事项为准。'}},defaultBranch:'eligible',
 steps:guideSteps,checks:['已查看政府原文和最新有效版本','已核实自己所在市和区县','已核实学历、就业或经营与住房条件','已区分企业补贴和个人补贴','已区分住房制度与真实项目',...materials,'已核对正式申报时间和事项入口'],
 faq:[['是否符合学历就能领取？','不能，仍须满足本条具体资格及主管部门审核。'+conditions],['省级政策为何11市都出现？','这是同一山西省统一制度的属地索引，不是11项市级独立政策。'],['最高金额一定到账吗？','不是，'+details],['是否正在开放申报？','尚须核对政府当期事项公告。'+risk],['人才公寓有空房吗？','住房制度不能证明2026实时空房；须查具体地址、租金与项目批次。'],['到哪里办理？',p?.application||'联系本市住房保障部门查阅真实项目与申办事项。']],
 sources:[[p?.sourceName||'官方住房制度来源',item.sourceUrl]],officialUrl:p?.applicationUrl||h?.applyUrl,officialLabel:'实际政府申报事项待核实',officialNote:p?.application||h?.statusNote||'',contacts:[],
 listPath:'/talent-service/list/'+(p?'policies':'housing')+'/'+encodeURIComponent(item.city),detailPath:'/talent-service/'+(p?'policy':'housing')+'/'+encodeURIComponent(item.id),otherRoute:'/talent-service/city/'+encodeURIComponent(item.city),otherLabel:'返回城市主页'};
}