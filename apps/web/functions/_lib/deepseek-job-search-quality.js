/**
 * HHBA V8: pre-Fetch ranking for PUBLIC Search results only.
 * Search snippets / summaries / dates are discovery hints, NEVER job evidence.
 * A job must still pass independently fetched JD + employer proof + hard gates.
 */
import {findMainlandCity} from './mainland-job-location.js';

const LOCATION=/(?:工作地点|工作城市|办公地点|工作地|上班地点|办公城市|work location|location)\s*[：:\-|｜]?\s*([^\n，;；。|｜]{2,42})/i;
const REQUIREMENTS=/(?:任职要求|任职资格|岗位要求|职位要求|资格要求|学历要求|应聘条件|本科及以上|大专及以上|工作经验|qualifications|requirements)/i;
const DUTIES=/(?:岗位职责|工作职责|工作内容|职位描述|职责描述|工作任务|responsibilities|what you'll do)/i;
const APPLY=/(?:立即投递|立即申请|在线申请|在线投递|申请岗位|申请职位|投递简历|我要应聘|立即应聘|apply now|apply for this job)/i;
const LISTING=/(?:招聘会|招聘公告|岗位汇总|职位汇总|招聘信息汇总|求职攻略|面试经验|资讯|职位列表|岗位列表|职位搜索|职位筛选|校园招聘官网|招聘首页|招募计划|招聘简章|求职指南)/i;
const normalize=x=>typeof x==='string'?x.toLowerCase().replace(/\s+/g,'').slice(0,1100):'';
const clamp=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):0;

export function searchEvidenceHints(result,roles,now=new Date()){
 const title=normalize(result?.title).slice(0,180);
 const summary=normalize([result?.snippet,result?.summary].filter(x=>typeof x==='string').join(' '));
 const terms=[...new Set((Array.isArray(roles)?roles:[]).map(normalize).filter(x=>x.length>=2))];
 const jobRoleInTitle=terms.some(role=>title.includes(role));
 const jobRoleInSummary=terms.some(role=>summary.includes(role));
 const detailHint=!!(result?.url&&/(?:job|position|recruit|vacancy|career)/i.test(result.url));
 const match=summary.match(LOCATION);
 const workCityMention=!!(match&&findMainlandCity(match[1]));
 const requirementsMention=REQUIREMENTS.test(summary);
 const dutyMention=DUTIES.test(summary);
 const applyMention=APPLY.test(summary);
 const genericListing=LISTING.test(title);
 const relevance=clamp(result?.rerank_score,0,3);
 const authority=clamp(result?.authority,-1,4);
 const published=typeof result?.date==='string'?Date.parse(result.date):NaN;
 const age=Number.isFinite(published)&&published<=now.getTime()?
  (now.getTime()-published)/86400000:Infinity;
 const recentPage=age<=120; // NOT proof of a vacancy being active
 const score=(jobRoleInTitle?34:0)+(jobRoleInSummary?8:0)+
  (workCityMention?22:0)+(requirementsMention?16:0)+
  (dutyMention?9:0)+(applyMention?8:0)+(detailHint?3:0)+
  Math.round(relevance*2)+Math.max(0,authority)+
  (recentPage?2:0)-(genericListing?38:0);
 return Object.freeze({
  score:Math.max(0,score),
  role_in_title:jobRoleInTitle,
  role_in_summary:jobRoleInSummary,
  work_city_hint:workCityMention,
  requirements_hint:requirementsMention,
  duties_hint:dutyMention,
  apply_hint:applyMention,
  listing_warning:genericListing,
  // This flag means nothing beyond a discovery hint. Never use as proof.
  hint_only:true
 });
}
export function orderPublicJobCandidates(candidates,roleAliases,{maxPerDomain=2,limit=6,now=new Date()}={}){
 if(!Array.isArray(candidates))return [];
 const ranked=candidates.map((c,index)=>({
  ...c,rank:searchEvidenceHints(c.search_metadata||{title:c.search_title||'',url:c.url},
   roleAliases,now),index
 })).filter(x=>(x.rank.role_in_title||x.rank.role_in_summary)&&
  !x.rank.listing_warning)
  .sort((a,b)=>b.rank.score-a.rank.score||a.index-b.index);
 // Two passes ensure diversity without letting a single enterprise consume
 // the entire six-page postpass if alternatives are available.
 const chosen=[],counts=new Map(),seen=new Set();
 for(const diversity of [true,false]){
  for(const c of ranked){
   if(chosen.length>=limit)break;
   if(seen.has(c.url))continue;
   const n=counts.get(c.domain)||0;
   if(diversity&&n>=maxPerDomain)continue;
   seen.add(c.url);counts.set(c.domain,n+1);chosen.push(c);
  }
 }
 return chosen;
}
