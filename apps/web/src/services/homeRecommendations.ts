import type {LiveJob} from './liveRecruitment';
import {matchRoleToMajor} from './majorJobMatching';
export type RecommendationProfile={preferred_role?:string;preferred_city?:string;skills?:string;headline?:string;intro?:string};
export type RecommendationStage='all'|'INTERNSHIP'|'CAMPUS'|'SOCIAL';
export type RecommendedJob={job:LiveJob;score:number;reasons:string[];collaborative:boolean};
export const HOME_RECOMMENDATION_VERSION='HHBA_HOME_HYBRID_V1';
function norm(s:unknown){return String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'').slice(0,180);}
function words(s:unknown){
 const raw=String(s||'').normalize('NFKC').slice(0,180).split(/[\s,，、;；\/|]+/).map(norm).filter(x=>x.length>=2);
 return [...new Set(raw)].slice(0,15);
}
function hits(text:string,terms:string[]){return terms.filter(t=>text.includes(t));}
export function rankHomeJobs(jobs:LiveJob[],profile:RecommendationProfile|null,
 savedIds:ReadonlySet<string>,collaboration:ReadonlyMap<string,number>,stage:RecommendationStage='all',limit=8,majorSlug=''):RecommendedJob[]{
 const role=words(profile?.preferred_role),skills=words(profile?.skills),city=norm(profile?.preferred_city);
 const ranked:RecommendedJob[]=[],seen=new Set<string>();
 for(const job of jobs){
  if(!job?.domestic||!job.id||seen.has(job.id)||savedIds.has(job.id))continue;
  seen.add(job.id);
  if(stage!=='all'&&job.recruitmentType!==stage)continue;
  const title=norm([job.titleZh,job.title,job.companyZh,job.company].join(' '));
  const evidence=norm([job.titleZh,job.title,job.requirementsSummary,(job.skillSignals||[]).join(' '),...job.majorNames||[]].join(' '));
  const location=norm([job.locationZh,job.location].join(' '));
  const roleHit=hits(title,role),skillHit=hits(evidence,skills);
  const cityHit=!!city&&city.length>1&&location.includes(city);
  const peers=collaboration.get(job.id)||0;
  const majorMatch=majorSlug?matchRoleToMajor(job,majorSlug):'all';
  const reasons:string[]=[];
  let score=0;
  if(roleHit.length){score+=32;reasons.push('与你关注的岗位方向相关');}
  if(majorMatch==='related'){score+=34;reasons.push('与所选专业存在已整理的关联');}
  else if(majorMatch==='unrestricted'){score+=6;reasons.push('已整理为不限制专业');}
  else if(majorMatch==='other')score-=12;
  if(skillHit.length){score+=Math.min(28,skillHit.length*9);reasons.push('与你填写的技能有交集');}
  if(cityHit){score+=18;reasons.push('符合意向工作城市');}
  if(peers>0){score+=Math.min(25,peers*5);reasons.push('与你兴趣相似的用户也关注');}
  if(job.currentApplicationVerified===true){score+=10;reasons.push('官方申请入口近期已核验');}
  if(job.recruitmentType==='CAMPUS'&&stage==='CAMPUS')score+=8;
  if(job.recruitmentType==='INTERNSHIP'&&stage==='INTERNSHIP')score+=8;
  // A deterministic tie-breaker keeps results stable across refreshes.
  score+=job.id.split('').reduce((n,ch)=>((n*31+ch.charCodeAt(0))%997),0)/997;
  if(!reasons.length)reasons.push('符合当前探索方向，投递前请核对岗位要求');
  ranked.push({job,score,reasons:reasons.slice(0,2),collaborative:peers>0});
 }
 ranked.sort((a,b)=>b.score-a.score||a.job.id.localeCompare(b.job.id));
 const perCompany=new Map<string,number>(),selected:RecommendedJob[]=[];
 for(const row of ranked){
  const company=norm(row.job.companyZh||row.job.company)||row.job.id;
  if((perCompany.get(company)||0)>=2)continue;
  selected.push(row);perCompany.set(company,(perCompany.get(company)||0)+1);
  if(selected.length>=limit)break;
 }
 return selected;
}
