/**
 * HHBA Talent Intelligence — evidence-grounded semantic fit validation.
 *
 * AI is allowed to PROPOSE cross-industry capability alignments, not to
 * assign unconstrained scores. Both sides of every alignment must quote
 * actual resume and VERIFIED JD text. Hard qualifications cannot be rescued
 * by a high semantic score. A score is relevance, never hiring probability.
 */
import { evaluateJobEligibility } from './match-ranking.js';
import { extractSkillRequirements } from './job-skill-evidence.js';
import { extractMandatoryProfessionalCredentials } from './professional-credentials.js';

const ALIGNMENTS = new Set(['direct','adjacent','transferable']);
const DEGREE_ORDER = ['HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'];
const DEGREE_WORDS = [
  ['PHD',/(?:博士|ph\.?d\.?|doctorate)/i],
  ['MASTER',/(?:硕士|研究生|master'?s?)/i],
  ['BACHELOR',/(?:本科|学士|bachelor'?s?)/i],
  ['ASSOCIATE',/(?:大专|专科|associate'?s?)/i],
  ['HIGH_SCHOOL',/(?:高中|中专|high school)/i],
];

function txt(value, max=12000) {
  return typeof value==='string' ? value.trim().slice(0,max) : '';
}
function compact(value){
  return txt(value,40000).normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase();
}
function matchesEvidence(source,quote,min=10) {
  const needle=compact(quote);
  return needle.length>=min && compact(source).includes(needle);
}
const CN_NUM={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
function yearsValue(raw) {
  if (/^\d{1,2}$/.test(raw)) return Number(raw);
  if (raw==='十') return 10;
  if (raw.startsWith('十')) return 10+(CN_NUM[raw[1]]??0);
  if (raw.endsWith('十')) return (CN_NUM[raw[0]]??0)*10;
  if (raw.includes('十')){
    const [t,o]=raw.split('十');
    return (CN_NUM[t]??0)*10+(CN_NUM[o]??0);
  }
  return CN_NUM[raw]??null;
}
/** Extract only clearly stated minimums, never "preferred" requirements. */
export function parseExplicitHardRequirements(jdText) {
  const raw=txt(jdText,20000);
  const clauses=raw.split(/[\n；;。]+/).map(x=>x.trim()).filter(Boolean);
  let minimumEducation=null, minimumYears=null;
  const yearsPattern=/(?:至少|不少于|要求|须有|具备)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:[-~至]\s*\d{1,2})?\s*年(?:以上|及以上|或以上|起)?\s*[^，,；;。\n]{0,24}(?:经验|经历|工作经验)|(?:工作|相关|行业|岗位|管理|从业)经验[^，,；;。\n]{0,15}(\d{1,2}|[一二两三四五六七八九十]{1,3})年(?:以上|及以上)?/g;
  for(const clause of clauses){
    if (/(?:优先|加分|更佳|preferred|nice to have|学历不限|经验不限|不要求|不必须|非必需)/i.test(clause)) continue;
    for(const match of clause.matchAll(yearsPattern)) {
      const years=yearsValue(match[1]||match[2]||'');
      if(Number.isFinite(years) && years>0 && years<=40) minimumYears=Math.max(minimumYears||0,years);
    }
    if (/(?:学历|学位|教育背景|本科及以上|硕士及以上|博士及以上|至少|最低学历|学历要求|degree|required)/i.test(clause)){
      const candidates=DEGREE_WORDS.filter(([,re])=>re.test(clause));
      if(candidates.length){
        // Alternatives like "本科或硕士" imply the *lower* required degree.
        const degree=candidates.reduce((best,[key])=>
          !best || DEGREE_ORDER.indexOf(key)<DEGREE_ORDER.indexOf(best)?key:best,null);
        if(!minimumEducation || DEGREE_ORDER.indexOf(degree)>DEGREE_ORDER.indexOf(minimumEducation))
          minimumEducation=degree;
      }
    }
  }
  const skills=extractSkillRequirements(raw);
  const creds=extractMandatoryProfessionalCredentials(raw);
  return {
    minimum_education:minimumEducation,
    min_experience_years:minimumYears,
    mandatory_skills:skills.mandatory,
    professional_credential_requirements:creds.mandatory,
  };
}
function uniquePairs(proposed,resumeText,jdText) {
  const valid=[];
  const seen=new Set();
  for(const item of Array.isArray(proposed)?proposed.slice(0,25):[]){
    if(!item||typeof item!=='object')continue;
    const resumeQuote=txt(item.resume_quote,350);
    const jobQuote=txt(item.job_quote,350);
    const alignment=ALIGNMENTS.has(item.alignment)?item.alignment:null;
    const explanation=txt(item.explanation,300);
    if(!alignment||explanation.length<12||!matchesEvidence(resumeText,resumeQuote,12)||
       !matchesEvidence(jdText,jobQuote,12))continue;
    const signature=compact(resumeQuote)+'|'+compact(jobQuote);
    if(seen.has(signature))continue;
    seen.add(signature);
    valid.push({
      resume_quote:resumeQuote,job_quote:jobQuote,
      alignment,explanation,
    });
  }
  return valid;
}
function familyBonus(intent) {
  return intent==='direct'?0.10:intent==='adjacent'?0.06:
    intent==='transferable'?0.02:0;
}
function competitiveEvidence(pairs) {
  // Passing a qualification gate is not proof of hiring success.
  // Only count directly supported duty/skill analogies; cross-industry matches
  // can be fit-relevant but are not automatically equivalent credentials.
  return pairs.filter(p=>p.alignment==='direct').length;
}
/**
 * Validate model-proposed pairs, apply known hard requirements, and output
 * scores plus cited evidence only when evidence is sufficient.
 *
 * @param {string} resumeText De-identified source text, never search payload.
 * @param {object} profile Candidate normalized qualifications.
 * @param {object} job Independently verified job with original JD evidence.
 * @param {object} direction Evidence-grounded direct/adjacent/transferable role.
 * @param {object} proposal Semantic alignment suggestions from a reasoning model.
 */
export function judgeVerifiedJobFit({resumeText='',profile={},job={},direction={},proposal={}}={}) {
  const textJD=[txt(job.responsibilities),txt(job.requirements)].filter(Boolean).join('\n');
  if(txt(resumeText).length<30 || textJD.length<50 ||
     !job.official_url || !job.recruitment_source_status?.startsWith('VERIFIED_EMPLOYER_')){
    return {eligible:false,reason:'UNVERIFIED_EVIDENCE',relevance:null,competitiveness:null,pairs:[]};
  }
  const hard=parseExplicitHardRequirements(job.requirements);
  const gated=evaluateJobEligibility(profile,{...job,...hard});
  if(!gated.eligible){
    return {eligible:false,reason:gated.reason,relevance:null,competitiveness:null,pairs:[],
      hard_requirements:hard};
  }

  const pairs=uniquePairs(proposal.pairs,resumeText,textJD);
  const evidentiaryMin=direction.intent==='transferable'?3:2;
  if(pairs.length<evidentiaryMin){
    return {eligible:true,reason:'INSUFFICIENT_MATCH_EVIDENCE',relevance:null,
      competitiveness:null,pairs,hard_requirements:hard};
  }
  const strength={direct:1,adjacent:0.8,transferable:0.6};
  const effective=pairs.slice(0,6).reduce((sum,p)=>sum+strength[p.alignment],0);
  const relevance=Math.min(0.94,Number((0.38+Math.min(0.43,effective*0.14)+familyBonus(direction.intent)).toFixed(3)));
  const directPairs=competitiveEvidence(pairs);
  const competitiveness=directPairs===0?null:
    Math.min(0.90,Number((0.38+Math.min(0.4,directPairs*0.15)).toFixed(3)));
  return {
    eligible:true,reason:'EVIDENCE_BACKED_RELEVANCE',
    relevance,competitiveness,pairs,
    matched_evidence_count:pairs.length,
    hard_requirements:hard,
    disclaimer:'匹配分仅衡量岗位与已提供的能力证据相关性，不是面试、录用概率或对资格的保证。',
  };
}
/**
 * The inference adapter must return structured, quoted evidence proposals.
 * It may never turn its own unsupported score into a HHBA score.
 */
export function createEvidenceFitScorer({resumeText,profile,evaluatePairs}={}){
  if(typeof evaluatePairs!=='function')throw Error('FIT_EVIDENCE_MODEL_REQUIRED');
  if(typeof resumeText!=='string'||resumeText.length<30)throw Error('RESUME_EVIDENCE_REQUIRED');
  return async (job,plan,verification)=>{
    const proposed=await evaluatePairs({
      resumeText,
      job: {title:job.title,responsibilities:job.responsibilities,requirements:job.requirements},
      direction: {role:plan.role,intent:plan.intent},
    });
    return judgeVerifiedJobFit({
      resumeText,profile,job,direction:plan,proposal:proposed,
    });
  };
}
