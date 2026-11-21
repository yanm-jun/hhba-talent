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
 sourceParagraphs:string[];
 /** Ordered, user-reviewed AI writing with explicit section headings in new-layout DOCX. */
 structuredSourceParagraphs?:Array<{section:ResumeBlock['section'];text:string}>;
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
/**
 * Extract text-only source paragraphs without pretending they are verified
 * positions, educational credentials, or employment achievements.
 * Never silently invent semantic headings. The original document stays intact.
 */
export function sourceResumeBlocks(raw:string):ResumeBlock[]{
 const source=typeof raw==='string'?raw.replace(/\r\n?/g,'\n').trim().slice(0,19000):'';
 if(!source)return [];
 const parts=source.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 const chunks:string[]=[];
 let current='';
 function push(){if(current.trim())chunks.push(current.trim());current='';}
 for(const part of parts){
  const segments=part.match(/[\s\S]{1,1400}/g)||[];
  for(const piece of segments){
   if(current.length+piece.length+1>1400)push();
   current=current?current+'\n'+piece:piece;
   if(chunks.length>=12)break;
  }
  if(chunks.length>=12)break;
 }
 if(chunks.length<12)push();
 return chunks.slice(0,12).map((text,i)=>({id:'source-'+i,section:'summary',text}));
}
/** Keep exports honest: the 12 editable source snippets may omit the end of
 * a long CV. Compare non-whitespace characters so paragraph wrapping and
 * leading/trailing whitespace do not create false truncation warnings. */
export function sourceResumeOmittedCharacters(raw:string,sourceBlocks:readonly ResumeBlock[]):number{
 const original=typeof raw==='string'?raw.replace(/\r\n?/g,'\n').trim():'';
 if(!original)return 0;
 const visible=sourceBlocks.filter(block=>block.id.startsWith('source-'))
  .map(block=>block.text).join('');
 const nonspace=(value:string)=>value.replace(/\s/gu,'').length;
 return Math.max(0,nonspace(original)-nonspace(visible));
}
/** Structured ATS profiles can contain more entries or longer evidence than
 * the printable resume template preserves. Never export that partial copy
 * without an explicit warning to the candidate. */
export function structuredResumeOmittedCharacters(profile:CandidateProfile):number{
 const nonspace=(value:string)=>value.replace(/\s/gu,'').length;
 let omitted=0;
 for(const entries of [profile.experiences,profile.skills]){
  const evidenced=(Array.isArray(entries)?entries:[])
   .filter(item=>typeof item.evidence==='string'&&item.evidence.trim());
  for(let i=0;i<evidenced.length;i++){
   const text=evidenced[i].evidence as string;
   omitted+=nonspace(i<12?text.slice(1600):text);
  }
 }
 if(typeof profile.education_evidence==='string')
  omitted+=nonspace(profile.education_evidence.slice(300));
 return omitted;
}
export function buildResumeDocument(
 profile:CandidateProfile,blocks:readonly ResumeBlock[],details:ResumeDocumentDetails
):ResumeDocument{
 const byId=new Map(blocks.map(block=>[block.id,block.text]));
 const experiences=(Array.isArray(profile.experiences)?profile.experiences:[]).filter(e=>typeof e.evidence==='string'&&e.evidence.trim()).slice(0,12)
  .map((item,i)=>({
   id:'experience-'+i,
   title:safe(item.role,160),organization:safe(item.organization,160),
   period:safe(item.period,120),
   details:safe(byId.get('experience-'+i)??item.evidence,1600)
  }));
 const skills=(Array.isArray(profile.skills)?profile.skills:[]).filter(s=>typeof s.evidence==='string'&&s.evidence.trim()).slice(0,12)
  .map((item,i)=>({
   name:safe(item.name,120),details:safe(byId.get('skill-'+i)??item.evidence,1600)
  }));
 const education=[
  safe(profile.education_evidence,300)||
  (profile.education?DEGREE_NAMES[profile.education]||'':''),
  safe(details.educationDetails,600)
 ].filter(Boolean);
 return {details:normalizeResumeDocumentDetails(details),education,experiences,skills,
  sourceParagraphs:blocks.filter(b=>b.id.startsWith('source-')).map(b=>b.text)};
}
export function readableResumeDocument(doc:ResumeDocument):boolean{
 return doc.details.fullName.length>=2&&doc.details.fullName.length<=80&&
  Boolean(doc.experiences.length||doc.skills.length||doc.education.length||doc.details.summary||doc.sourceParagraphs.length);
}
