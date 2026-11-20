import type {CandidateProfile} from './resumeMatching';
import type {ResumeBlock,ResumeSection} from './targetedResumeOptimization';

/**
 * Build a COMPLETE writer source, separate from the twelve short editable
 * snippets retained for the legacy five-tip workflow.
 * Never silently drop text when an unusually long input cannot fit.
 */
export type CompleteRewriteSource={blocks:ResumeBlock[];complete:boolean;reason?:string};
const MAX_CHARS_PER_BLOCK=4200;
const MAX_BLOCKS=96;
function sectionOf(text:string):ResumeSection{
 if(/^(?:教育背景|教育经历|学历|education)\b/i.test(text))return 'education';
 if(/^(?:技能|能力|专业技能|skills?)\b/i.test(text))return 'skills';
 if(/^(?:项目|项目经历|projects?)\b/i.test(text))return 'projects';
 if(/^(?:工作|实习|岗位|任职|经历|experience)\b/i.test(text))return 'experience';
 return 'summary';
}
export function completeRewriteSource(profile:CandidateProfile,sourceText?:string):CompleteRewriteSource{
 const original=typeof sourceText==='string'?sourceText.replace(/\r\n?/g,'\n').trim():'';
 const chunks:{section:ResumeSection;text:string}[]=[];
 function push(section:ResumeSection,text:string){
  const value=text.trim();
  if(!value)return;
  // Respect paragraph boundaries where possible but never discard overflow.
  for(let start=0;start<value.length;start+=MAX_CHARS_PER_BLOCK){
   chunks.push({section,text:value.slice(start,start+MAX_CHARS_PER_BLOCK)});
  }
 }
 if(original){
  const paragraphs=original.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  for(const paragraph of paragraphs)push(sectionOf(paragraph),paragraph);
 }else{
  for(const x of profile.experiences||[])
   if(x.evidence?.trim())push('experience',x.evidence);
  for(const x of profile.skills||[])
   if(x.evidence?.trim())push('skills',x.evidence);
  if(profile.education_evidence?.trim())push('education',profile.education_evidence);
  if(profile.experience_evidence?.trim()&&!(profile.experiences||[]).some(
   x=>x.evidence===profile.experience_evidence))
   push('experience',profile.experience_evidence);
 }
 if(chunks.length>MAX_BLOCKS){
  return {blocks:[],complete:false,
   reason:'这份简历可提取文本超过当前单次处理容量。必须使用分段连续任务读取全文，不能偷偷遗漏后面的经历。'};
 }
 return {blocks:chunks.map((x,i)=>({
  id:'full-'+i,section:x.section,text:x.text
 })),complete:chunks.length>0,
 reason:chunks.length?'': '尚未读取到完整的简历事实文本，请重新上传 Word 或检查提取结果。'};
}
