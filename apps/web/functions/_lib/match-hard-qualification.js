/**
 * Minimum experience gating for cited employer JD requirements.
 *
 * Crucial distinction: having similar duties does not prove eligibility.
 * Inspect only the employer's verified requirements, not the resume, title,
 * search snippet or unrelated "3-year project" descriptions.
 * Any missing/conflicting tenure is UNKNOWN, not assumed eligible.
 */
const normalized=s=>String(s||'').replace(/\s+/g,' ').trim();
export const QUALIFICATION_GATE_VERSION='HHBA_MINIMUM_EXPERIENCE_EVIDENCE_V1';

export function minimumExperienceFromJd(requirements){
 const text=normalized(requirements).slice(0,18000);
 if(!text)return null;
 const patterns=[
  /(\d{1,2})(?:\s*[-–—~至到]\s*\d{1,2})?\s*年\s*(?:及?以上|以上|(?:[\u4e00-\u9fff]{0,12}(?:工作|行业|零售|培训|运营|管理|从业|相关|经验|经历)))/g,
  /(?:minimum\s+|at\s+least\s+|above\s+|over\s+)?(\d{1,2})(?:\s*[-–—~]\s*\d{1,2})?\s*\+?\s*years?\b/gi
 ];
 let found=null;
 for(const pattern of patterns){
  for(const match of text.matchAll(pattern)){
   const years=Number(match[1]);
   if(!Number.isInteger(years)||years<1||years>30)continue;
   const from=Math.max(0,match.index-35),to=Math.min(text.length,match.index+90);
   const context=text.slice(from,to);
   // A number alone is not evidence of a work-history requirement.
   if(!/(?:经验|经历|工作|从业|零售|培训|运营|管理|retail|training|operation|work|experience|management|marketing)/i.test(context))
    continue;
   // A preferred qualification is NOT a mandatory eligibility threshold.
   // E.g. "区经理职级2年以上经验优先" must not suppress a suitable match.
   const preceding=text.slice(Math.max(0,match.index-18),match.index);
   const following=text.slice(match.index+match[0].length)
    .split(/[，,。；;!！?？]/)[0].slice(0,28);
   const optionalBefore=/(?:优先(?:考虑|具备|拥有|具有)?|加分|preferred|nice\s+to\s+have)[\s\u4e00-\u9fff]{0,7}$/i.test(preceding);
   const optionalAfter=/^(?:[\s\u4e00-\u9fff]{0,8}(?:优先(?:考虑)?|为佳|加分)|\s*(?:(?:of|in|related|relevant|retail|work|operations|marketing|training|management|experience)\s+){0,6}(?:preferred|desirable|a\s+plus)\b)/i.test(following);
   if(optionalBefore||optionalAfter)continue;
   // Weak rules may accidentally include unrelated tenure such as bonuses.
   if(/(?:合同期限|质保|保修|售后保修|有效期|质保期|试用期)/.test(context)&&
    !/(?:经验|经历|从业|年工作|years?\s+(?:in|of|experience))/.test(context))
    continue;
   const entry={years,evidence:normalized(match[0]).slice(0,110)};
   // For multiple mandatory experience thresholds, preserve the highest.
   if(!found||years>found.years)found=entry;
  }
 }
 return found;
}

export function assessExperienceRequirement(requirements,profile){
 const requirement=minimumExperienceFromJd(requirements);
 if(!requirement)return {status:'NOT_SPECIFIED',requiredYears:null,verifiedYears:null,note:''};
 const years=Number.isFinite(profile?.experience_years)&&
  profile.experience_years>=0?profile.experience_years:null;
 const status=years===null?'UNVERIFIED':years<requirement.years?'BELOW_MINIMUM':'EVIDENCED';
 const note=status==='EVIDENCED'?'':'岗位公开要求至少'+requirement.years+
  '年相关经验；'+(years===null?'简历未能核实符合该经验门槛。':
   '当前可核实的累计经验约'+years+'年，低于该公开要求。')+
  '此信息不能通过润色简历来补齐。';
 return {status,requiredYears:requirement.years,verifiedYears:years,
  evidence:requirement.evidence,note};
}
