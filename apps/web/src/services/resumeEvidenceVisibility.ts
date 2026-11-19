import type {ResumeBlock} from './targetedResumeOptimization';

export interface EvidenceVisibility {
 score:number|null; present:string[]; missing:string[]; total:number;
}
/**
 * A conservative, deterministic *wording visibility* audit.
 * This is NOT the upstream JD matching algorithm, job eligibility, hiring probability
 * or a reliable NLP inference. Display it only with that distinction.
 */
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]/gu,'');
function trigrams(value:string):Set<string>{
 const clean=normalize(value),parts=new Set<string>();
 if(clean.length<3){if(clean.length>1)parts.add(clean);return parts;}
 for(let i=0;i+3<=clean.length;i++){
  const tri=clean.slice(i,i+3);
  if(!['相关经','工作经','具备良','良好的','以及其','专业能','等方面'].includes(tri))parts.add(tri);
 }
 return parts;
}
function related(requirement:string,resume:string):boolean{
 const normalized=normalize(requirement);
 if(normalized.length<2)return false;
 if(normalize(resume).includes(normalized))return true;
 const targets=trigrams(requirement);
 if(targets.size<2)return false;
 const known=trigrams(resume);
 const hits=[...targets].filter(token=>known.has(token)).length;
 return hits>=2&&hits/targets.size>=0.50;
}
export function evidenceVisibility(requirements:readonly string[],blocks:readonly ResumeBlock[]):EvidenceVisibility{
 const unique=[...new Set(requirements.map(r=>r.trim()).filter(r=>r.length>=3&&r.length<=160))].slice(0,12);
 if(!unique.length)return {score:null,present:[],missing:[],total:0};
 const original=blocks.map(b=>b.text).join(' ');
 const present=unique.filter(label=>related(label,original));
 const missing=unique.filter(label=>!related(label,original));
 return {score:Math.round(present.length/unique.length*100),present,missing,total:unique.length};
}
