// Public job information is separate from a verified employer JD and never
// upgrades eligibility or invents requirements, salary or experience.
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';
const text=v=>typeof v==='string'?v.trim():'';
const norm=v=>text(v).replace(/\s+/g,' ');
const urlOf=v=>{const u=v4PublicJobUrl(v);return u&&!isCommercialRecruitmentBoard(u)?u:null};
const strings=v=>[...new Set((Array.isArray(v)?v:[]).map(text).filter(Boolean))];
export function cleanJdResearch(value){
 if(!value||typeof value!=='object')return undefined;
 const facts=(Array.isArray(value.facts)?value.facts:[]).flatMap(f=>{
  const url=urlOf(f?.url),quote=text(f?.quote);
  return url&&quote?[{url,quote,context:f.context==='same_job'?'same_job':'related_context'}]:[];
 });
 return {facts:[...new Map(facts.map(f=>[JSON.stringify(f),f])).values()],inference:text(value.inference),unknowns:strings(value.unknowns),diagnostics:strings(value.diagnostics),...(text(value.checked_at)?{checked_at:text(value.checked_at)}:{})};
}
// Only independently read exact public excerpts qualify as source material.
// AI's interpretation of even a valid excerpt is not an employer requirement.
export function groundJdResearch(value,ledger=[],diagnostics=[]){
 const proposed=cleanJdResearch(value)||{facts:[],inference:'',unknowns:[],diagnostics:[]};
 const facts=proposed.facts.filter(f=>ledger.some(r=>urlOf(r.url)===f.url&&norm(r.text).includes(norm(f.quote))));
 return {...proposed,facts,diagnostics:strings(diagnostics),checked_at:new Date().toISOString()};
}
export function mergeJdResearch(a,b){
 if(!a&&!b)return undefined;
 const old=cleanJdResearch(a)||{facts:[],inference:'',unknowns:[],diagnostics:[]};
 const next=cleanJdResearch(b)||{facts:[],inference:'',unknowns:[],diagnostics:[]};
 return cleanJdResearch({...old,...next,facts:[...old.facts,...next.facts],inference:next.inference||old.inference,unknowns:next.unknowns.length?next.unknowns:old.unknowns,diagnostics:[...old.diagnostics,...next.diagnostics],checked_at:next.checked_at||old.checked_at});
}
const origin=j=>j.research_candidate_url||j.official_url;
const official=j=>j?.jd_source_status==='VERIFIED_JD'&&j.source_type==='站外官方招聘'&&!!text(j.evidence_excerpt);
const strength=j=>official(j)?3:j?.evidence_status==='VERIFIED_FULL_JD'&&text(j.evidence_excerpt)?2:j?.evidence_status==='PARTIAL_SOURCE'&&text(j.evidence_excerpt)?1:0;
export function preserveJobEvidence(previous,current){
 if(!previous)return current;
 if(!current)return previous;
 // Never use an earlier JD to override an explicitly closed/excluded vacancy.
 if(current.excluded_closed||current.excluded_board)return current;
 const older= strength(previous)>strength(current)||(strength(previous)>0&&strength(previous)===strength(current)&&norm(previous.evidence_excerpt)===norm(current.evidence_excerpt)&&Number.isInteger(previous.match_score)&&!Number.isInteger(current.match_score));
 const chosen=older?previous:current;
 return {...chosen,jd_research:mergeJdResearch(previous.jd_research,current.jd_research)};
}
export function mergeJobEvidence(previous,current){
 const map=new Map(previous.map(j=>[origin(j),j]));
 for(const j of current){const k=origin(j);map.set(k,preserveJobEvidence(map.get(k),j));}
 const byUrl=new Map();
 for(const j of map.values()){
  if(j.excluded_closed||j.excluded_board)continue;
  byUrl.set(j.official_url,preserveJobEvidence(byUrl.get(j.official_url),j));
 }
 return [...byUrl.values()];
}
// This sizes durable Worker invocations, not the number of jobs researched.
// Increase after uncomplicated batches; shrink after expensive recovery.
export function nextVerificationBatch(previous,hadRecovery,remaining){
 const size=Number.isSafeInteger(previous)&&previous>0?previous:1;
 return Math.max(1,Math.min(remaining||1,hadRecovery?Math.ceil(size/2):size+1,4));
}
