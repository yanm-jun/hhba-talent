import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from './talentPolicyRecords';
import {TALENT_HOUSING_RECORDS,type TalentHousingRecord} from './talentHousingRecords';
export type TalentQualityGrade='A'|'B'|'C'|'D';
export type TalentAudit={id:string;city:string;title:string;kind:'policy'|'housing';grade:TalentQualityGrade;label:string;missing:string[];sourceUrl:string};
const completeGuides=new Set(['sd-jinan-2026-talent-living','qd-rent-25','sd-qingdao-2026-free-housing','qd-laoshan-202610']);
const completeHousingGuides=new Set<string>();
const govSource=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&Boolean(u.hostname)&&!['example.com','localhost'].includes(u.hostname)}catch{return false}};
export function assessPolicy(p:TalentPolicyRecord):TalentAudit{
 const missing:string[]=[];
 if(!govSource(p.sourceUrl))missing.push('可追溯的政策原文链接');
 if(!p.eligibility||p.eligibility.length<45)missing.push('可操作的申请资格明细');
 if(!p.applicationSteps||p.applicationSteps.length<4)missing.push('完整分步骤办理流程');
 if(!p.materials||p.materials.length<2)missing.push('申请材料');
 if(!p.applicationUrl)missing.push('明确的办理入口（可能仅有原文）');
 if(!p.targetGroup)missing.push('适用对象');
 if(!p.reviewNote)missing.push('重要限制说明');
 const isOld=p.temporal==='historical'||p.temporal==='past-window'||Boolean(p.deadline&&/^\d{4}-\d{2}-\d{2}$/.test(p.deadline)&&p.deadline<'2026-10-30');
 const grade:TalentQualityGrade=!govSource(p.sourceUrl)?'D':isOld?'C':completeGuides.has(p.id)?'A':'B';
 return {id:p.id,city:p.city,title:p.title,kind:'policy',grade,label:grade==='A'?'完整办事指南':grade==='B'?'基础政策资料 · 指南完善中':grade==='C'?'历史或已截止资料':'来源待核验',missing,sourceUrl:p.sourceUrl};
}
export function assessHousing(h:TalentHousingRecord):TalentAudit{
 const missing:string[]=[];
 if(!govSource(h.sourceUrl))missing.push('可追溯的项目或政策原文链接');
 if(!h.eligibility||h.eligibility.length<50)missing.push('详细住房资格');
 if(!h.steps||h.steps.length<4)missing.push('详细选房签约步骤');
 if(!h.applyUrl)missing.push('住房申请渠道');
 if(!h.contactPhone)missing.push('官方咨询号码');
 if(!h.applicationEnd)missing.push('明确的本批次截止时间（如适用）');
 const old=Boolean(h.applicationEnd&&h.applicationEnd<'2026-10-30');
 const grade:TalentQualityGrade=!govSource(h.sourceUrl)?'D':old?'C':completeHousingGuides.has(h.id)?'A':'B';
 return {id:h.id,city:h.city,title:h.title,kind:'housing',grade,label:grade==='A'?'完整住房办事指南':grade==='B'?'住房资料 · 详情待完善':grade==='C'?'已截止住房批次':'来源待核验',missing,sourceUrl:h.sourceUrl};
}
export const TALENT_QUALITY_AUDIT:TalentAudit[]=[
 ...TALENT_POLICY_RECORDS.map(assessPolicy),
 ...TALENT_HOUSING_RECORDS.map(assessHousing)
];
export const TALENT_QUALITY_SUMMARY={
 total:TALENT_QUALITY_AUDIT.length,
 policies:TALENT_POLICY_RECORDS.length,
 housing:TALENT_HOUSING_RECORDS.length,
 byGrade:Object.fromEntries((['A','B','C','D'] as const).map(grade=>[grade,TALENT_QUALITY_AUDIT.filter(x=>x.grade===grade).length])) as Record<TalentQualityGrade,number>
};
