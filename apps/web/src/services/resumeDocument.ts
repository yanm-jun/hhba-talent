import type {CandidateProfile} from './resumeMatching';
import type {ResumeBlock} from './targetedResumeOptimization';

export type ResumeDocumentDetails={
 fullName:string;headline:string;email:string;phone:string;location:string;summary:string;
 educationDetails:string;
};
export type ResumeDocumentExperience={
 id:string;title:string;organization:string;period:string;details:string;
};
export type ResumeDocument={
 details:ResumeDocumentDetails;
 education:string[];
 experiences:ResumeDocumentExperience[];
 skills:{name:string;details:string}[];
};
export const EMPTY_RESUME_DOCUMENT_DETAILS:ResumeDocumentDetails={
 fullName:'',headline:'',email:'',phone:'',location:'',summary:'',educationDetails:''
};
const safe=(text:unknown,max:number)=>typeof text==='string'?text.trim().slice(0,max):'';
const DEGREE_NAMES:Record<string,string>={
 HIGH_SCHOOL:'高中',ASSOCIATE:'专科',BACHELOR:'本科',MASTER:'硕士',PHD:'博士'
};
export function normalizeResumeDocumentDetails(raw:unknown):ResumeDocumentDetails{
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 return {
  fullName:safe(input.fullName,80),headline:safe(input.headline,120),
  email:safe(input.email,120),phone:safe(input.phone,60),
  location:safe(input.location,120),summary:safe(input.summary,800),
  educationDetails:safe(input.educationDetails,600)
 };
}
export function buildResumeDocument(
 profile:CandidateProfile,blocks:readonly ResumeBlock[],details:ResumeDocumentDetails
):ResumeDocument{
 const byId=new Map(blocks.map(block=>[block.id,block.text]));
 const experiences=profile.experiences.filter(e=>typeof e.evidence==='string'&&e.evidence.trim()).slice(0,12)
  .map((item,i)=>({
   id:'experience-'+i,
   title:safe(item.role,160),organization:safe(item.organization,160),
   period:safe(item.period,120),
   details:safe(byId.get('experience-'+i)??item.evidence,1600)
  }));
 const skills=profile.skills.filter(s=>typeof s.evidence==='string'&&s.evidence.trim()).slice(0,12)
  .map((item,i)=>({
   name:safe(item.name,120),details:safe(byId.get('skill-'+i)??item.evidence,1600)
  }));
 const education=[
  safe(profile.education_evidence,300)||
  (profile.education?DEGREE_NAMES[profile.education]||'':''),
  safe(details.educationDetails,600)
 ].filter(Boolean);
 return {details:normalizeResumeDocumentDetails(details),education,experiences,skills};
}
export function readableResumeDocument(doc:ResumeDocument):boolean{
 return doc.details.fullName.length>=2&&doc.details.fullName.length<=80&&
  Boolean(doc.experiences.length||doc.skills.length||doc.education.length||doc.details.summary);
}
