// Presentation only: never mutate AI output, evidence, or the original destination.
export type RecruitmentSource={url:string;host:string;verified:boolean;label:string};
type LinkToken={start:number;end:number;url:string;label:string};
export function safeRecruitmentSource(raw:string){
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u:null;
 }catch{return null;}
}
function urlEnd(text:string,start:number){
 let end=start,depth=0;
 for(;end<text.length;end++){
  const c=text[end];
  if(/[\s<>"'、，。；！？：）】》\]}]/u.test(c))break;
  if(c==='(')depth++;
  if(c===')'){if(!depth)break;depth--;}
 }
 while(end>start&&/[.,;!?]/.test(text[end-1]))end--;
 return end;
}
function tokens(text:string):LinkToken[]{
 const found:LinkToken[]=[];
 const pattern=/\[[^\]\n]*\]\(\s*https?:\/\/|https?:\/\//gi;
 for(let match;(match=pattern.exec(text));){
  const raw=match[0],markdown=raw.startsWith('[');
  const start=match.index,urlStart=start+(markdown?raw.toLowerCase().lastIndexOf('http'):0);
  const end=urlEnd(text,urlStart),url=text.slice(urlStart,end);
  if(end<=urlStart){continue;}
  const closed=markdown&&text[end]===')';
  const tokenStart=closed?start:urlStart;
  const tokenEnd=closed?end+1:end;
  let label=closed?raw.slice(1,raw.indexOf(']')).trim():'';
  const host=safeRecruitmentSource(url)?.hostname||'';
  if(label&&(/^(?:https?:\/\/|www\.)/i.test(label)||label.toLowerCase()===host.toLowerCase()||label.toLowerCase()===host.replace(/^www\./,'').toLowerCase()||/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(label)))label='';
  found.push({start:tokenStart,end:tokenEnd,url,label});
  pattern.lastIndex=tokenEnd;
 }
 return found;
}
export function recruitmentText(raw?:string|null){
 if(!raw)return '';
 const matches=tokens(raw);if(!matches.length)return raw;
 let text='',cursor=0;
 for(const item of matches){
  let start=item.start,end=item.end;
  // A citation wrapped by parentheses is a standalone annotation, not prose.
  if(!item.label&&start>cursor&&((raw[start-1]==='('&&raw[end]===')')||(raw[start-1]==='（'&&raw[end]==='）')||(raw[start-1]==='['&&raw[end]===']')||(raw[start-1]==='<'&&raw[end]==='>'))){start--;end++;}
  text+=raw.slice(cursor,start)+(item.label||'');cursor=end;
 }
 text+=raw.slice(cursor);
 return text.replace(/[ \t]+(?=[，。；、！？,.!?;])/g,'').replace(/[ \t]+$/gm,'').replace(/^[ \t]+/gm,'').trim();
}
type SourceInput={company?:string;official_url?:string;source_type?:string;jd_source_status?:string;requirements_basis?:string;score_basis?:string;recommendation_reason?:string;evidence_excerpt?:string;recruitment_source_note?:string;matched?:string[];not_evidenced?:string[];needs_verification?:string[];evidence_sources?:{url:string;kind?:string}[];jd_research?:{facts?:{url:string;quote:string}[];inference?:string;unknowns?:string[]};research_detail?:{comparisons?:{requirement:string;analysis:string}[];strengths?:string;risks?:string;competition?:string;career_development?:string;optimization_advice?:string;score_explanation?:string;extra_sections?:{title:string;content:string}[]};jd_comparisons?:{requirement:string}[]};
export function collectRecruitmentSources(job:SourceInput,includePrimary=true):RecruitmentSource[]{
 const list=new Map<string,RecruitmentSource>();
 const add=(raw:string,verified=false,label='')=>{
  const u=safeRecruitmentSource(raw);if(!u)return;
  const prior=list.get(u.href);
  list.set(u.href,{url:u.href,host:u.hostname,verified:verified||!!prior?.verified,label:verified?label||prior?.label||'':prior?.label||label});
 };
 const primary=job.official_url?safeRecruitmentSource(job.official_url)?.href:undefined;
 const verified=job.source_type==='站外官方招聘'&&job.jd_source_status==='VERIFIED_JD';
 if(includePrimary&&primary)add(primary,verified,job.company?job.company+'招聘页面':'岗位招聘页面');
 const addRelated=(raw:string,label='')=>add(raw,!!primary&&safeRecruitmentSource(raw)?.href===primary&&verified,label);
 for(const source of job.evidence_sources||[])addRelated(source.url);
 for(const fact of job.jd_research?.facts||[])addRelated(fact.url);
 const detail=job.research_detail;
 const texts=[job.requirements_basis,job.evidence_excerpt,job.score_basis,job.recommendation_reason,job.recruitment_source_note,...(job.matched||[]),...(job.not_evidenced||[]),...(job.needs_verification||[]),job.jd_research?.inference,...(job.jd_research?.unknowns||[]),...(job.jd_research?.facts||[]).map(f=>f.quote),...(job.jd_comparisons||[]).map(c=>c.requirement),...(detail?.comparisons||[]).flatMap(c=>[c.requirement,c.analysis]),detail?.strengths,detail?.risks,detail?.competition,detail?.career_development,detail?.optimization_advice,detail?.score_explanation,...(detail?.extra_sections||[]).flatMap(s=>[s.title,s.content])];
 for(const value of texts)if(value)for(const item of tokens(value))addRelated(item.url,item.label);
 return [...list.values()];
}
