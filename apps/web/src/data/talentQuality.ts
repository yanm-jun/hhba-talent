import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from './talentPolicyRecords';
import {TALENT_HOUSING_RECORDS,type TalentHousingRecord} from './talentHousingRecords';

export type TalentQualityGrade='A'|'B'|'C'|'D';
export type TalentSourceKind='government'|'secondary'|'unverified';
export type TalentAudit={
 id:string;city:string;title:string;kind:'policy'|'housing';
 grade:TalentQualityGrade;label:string;missing:string[];sourceUrl:string;
 sourceKind:TalentSourceKind;guideRoute?:string;reviewedAt?:string;
};
export type CertifiedGuide={
 id:string;city:string;route:string;reviewedAt:string;
 evidenceUrls:readonly string[];stepCount:number;branchCount:number;faqCount:number;
};
/**
 * Only separately researched, executable, and CI-tested guides belong here.
 * Adding a name alone NEVER earns an A: tests verify route, complete guide
 * sections, real applicant paths, official evidence and the stated counts.
 * Never automatically promote a base record because it has 4 generic steps.
 */
export const CERTIFIED_TALENT_GUIDES:Readonly<Record<string,CertifiedGuide>>={
 'sd-jinan-2026-talent-living':{
  id:'sd-jinan-2026-talent-living',city:'济南',
  route:'/talent-service/policy-guide-preview/jinan',reviewedAt:'2026-10-30',
  evidenceUrls:['https://www.jinan.gov.cn/col/col118356/art/2026/art_8f508c1bb00a4a01baacdb1e081d9ef0.html','https://www.jinan.gov.cn/col/col118356/art/2026/art_4460a126d72f475d8b9d3b36f2f8749f.html'],
  stepCount:6,branchCount:3,faqCount:8
 },
 'qd-rent-25':{
  id:'qd-rent-25',city:'青岛',
  route:'/talent-service/policy-guide-preview/qingdao/housing',reviewedAt:'2026-10-30',
  evidenceUrls:['https://www.qingdao.gov.cn/zwgk/xxgk/rlshbz/gkml/gwfg/202404/t20240411_7996962.shtml','https://www.qingdao.gov.cn/zwgk/xxgk/rlshbz/ywfl/rcfw/202505/t20250526_9552432.shtml'],
  stepCount:6,branchCount:3,faqCount:6
 },
 'sd-qingdao-2026-free-housing':{
  id:'sd-qingdao-2026-free-housing',city:'青岛',
  route:'/talent-service/policy-guide-preview/qingdao/stay',reviewedAt:'2026-10-30',
  evidenceUrls:['https://www.qingdao.gov.cn/zwgk/xxgk/rlshbz/gkml/gwfg/202606/t20260630_10647826.shtml','https://www.qingdao.gov.cn/ywdt/zwzl/zxwdpt_00/zxwdpt_10/202607/t20260701_10648916.shtml'],
  stepCount:6,branchCount:2,faqCount:7
 },
 'qd-laoshan-202610':{
  id:'qd-laoshan-202610',city:'青岛',
  route:'/talent-service/policy-guide-preview/qingdao/laoshan',reviewedAt:'2026-10-30',
  evidenceUrls:['https://zhufang.qingdao.gov.cn/rczf/web/announcement/detail/986342070313422851'],
  stepCount:7,branchCount:3,faqCount:7
 }
};
export const CERTIFIED_TALENT_HOUSING_GUIDES:Readonly<Record<string,CertifiedGuide>>={};

/** Cities may be marked fully accepted ONLY when every current record meets A.
 * Existing data migration remains '建设中'; no city is falsely marked done. */
export const ACCEPTED_TALENT_CITIES:readonly string[]=[];

export function talentSourceKind(raw:string):TalentSourceKind{
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password)return 'unverified';
  const host=url.hostname.toLowerCase();
  if(!host||host==='localhost'||host.endsWith('.localhost')||host==='example.com')return 'unverified';
  if(host==='gov.cn'||host.endsWith('.gov.cn'))return 'government';
  // An educational portal or a news reprint can be useful evidence, not a
  // governmental primary source. Do not silently label media as official.
  return 'secondary';
 }catch{return 'unverified'}
}
function pastDeadline(deadline:string|undefined,asOf:string):boolean{
 return Boolean(deadline&&/^\d{4}-\d{2}-\d{2}$/.test(deadline)&&deadline<asOf);
}
function dateToday():string{return new Date().toISOString().slice(0,10)}
function label(grade:TalentQualityGrade,kind:'policy'|'housing'):string{
 if(grade==='A')return kind==='policy'?'完整办事指南':'完整住房办理指南';
 if(grade==='C')return '历史或已截止资料 · 仅供参考';
 if(grade==='D')return '来源待核验 · 不作为申领依据';
 return kind==='policy'?'基础政策资料 · 指南待完善':'住房基础资料 · 指南待完善';
}
export function assessPolicy(p:TalentPolicyRecord,asOf:string=dateToday()):TalentAudit{
 const missing:string[]=[];
 const sourceKind=talentSourceKind(p.sourceUrl);
 const certified=CERTIFIED_TALENT_GUIDES[p.id];
 if(sourceKind==='unverified')missing.push('有效的原始来源地址');
 if(sourceKind==='secondary')missing.push('政府主管部门一手文件（现为转载或其他来源）');
 if(!p.eligibility||p.eligibility.trim().length<45)missing.push('细化的申请资格与排除条件');
 if(!p.targetGroup)missing.push('明确适用对象');
 if(!certified){
  if(!p.applicationSteps||p.applicationSteps.length<4)missing.push('分步骤申请办理流程');
  if(!p.materials||p.materials.length<2)missing.push('申请材料及其依据');
  if(!p.applicationUrl)missing.push('可核验的官方办理入口');
  missing.push('逐项核实的完整指南、资格分支与常见问题');
 }
 if(!p.reviewNote)missing.push('风险与限制说明');
 const outdated=p.temporal==='historical'||p.temporal==='past-window'||pastDeadline(p.deadline,asOf);
 // Source and deadline always override any earlier guide certification.
 const grade:TalentQualityGrade=sourceKind==='unverified'?'D':outdated?'C':
  certified&&certified.city===p.city&&sourceKind==='government'?'A':'B';
 return {id:p.id,city:p.city,title:p.title,kind:'policy',grade,label:label(grade,'policy'),missing,
  sourceUrl:p.sourceUrl,sourceKind,guideRoute:grade==='A'?certified?.route:undefined,reviewedAt:certified?.reviewedAt||p.reviewedAt};
}
export function assessHousing(h:TalentHousingRecord,asOf:string=dateToday()):TalentAudit{
 const missing:string[]=[];
 const sourceKind=talentSourceKind(h.sourceUrl);
 const certified=CERTIFIED_TALENT_HOUSING_GUIDES[h.id];
 if(sourceKind==='unverified')missing.push('有效原始来源地址');
 if(sourceKind==='secondary')missing.push('政府或项目方的一手公告');
 if(!h.eligibility||h.eligibility.length<50)missing.push('项目住房资格及家庭限制');
 if(!h.steps||h.steps.length<4)missing.push('申请、选房、签约与入住步骤');
 if(!h.applyUrl)missing.push('已核对的申报渠道');
 if(!h.contactPhone)missing.push('真实公开咨询方式（如官方公布）');
 if(!certified)missing.push('逐项核实的完整项目办理指南');
 const outdated=pastDeadline(h.applicationEnd,asOf);
 const grade:TalentQualityGrade=sourceKind==='unverified'?'D':outdated?'C':
  certified&&certified.city===h.city&&sourceKind==='government'?'A':'B';
 return {id:h.id,city:h.city,title:h.title,kind:'housing',grade,label:label(grade,'housing'),missing,
  sourceUrl:h.sourceUrl,sourceKind,guideRoute:grade==='A'?certified?.route:undefined,reviewedAt:certified?.reviewedAt||h.reviewedAt};
}
export function assessTalentCity(city:string,asOf:string=dateToday()){
 const records=[
  ...TALENT_POLICY_RECORDS.filter(p=>p.city===city).map(p=>assessPolicy(p,asOf)),
  ...TALENT_HOUSING_RECORDS.filter(h=>h.city===city).map(h=>assessHousing(h,asOf))
 ];
 const open=records.filter(x=>x.grade!=='C');
 const accepted=records.length>0&&open.length>0&&open.every(x=>x.grade==='A')&&ACCEPTED_TALENT_CITIES.includes(city);
 return {city,records,accepted,completed:records.filter(x=>x.grade==='A').length,total:records.length};
}
export const TALENT_QUALITY_AUDIT:TalentAudit[]=[
 ...TALENT_POLICY_RECORDS.map(p=>assessPolicy(p)),
 ...TALENT_HOUSING_RECORDS.map(h=>assessHousing(h))
];
export const TALENT_QUALITY_SUMMARY={
 total:TALENT_QUALITY_AUDIT.length,policies:TALENT_POLICY_RECORDS.length,
 housing:TALENT_HOUSING_RECORDS.length,
 byGrade:Object.fromEntries((['A','B','C','D'] as const).map(grade=>[
  grade,TALENT_QUALITY_AUDIT.filter(p=>p.grade===grade).length
 ])) as Record<TalentQualityGrade,number>
};
