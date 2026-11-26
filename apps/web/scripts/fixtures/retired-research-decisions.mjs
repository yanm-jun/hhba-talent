// Historical action normalization fixture; no provider dispatch.
import {normalizeAutonomousQueries} from '../../functions/_lib/public-search-queries.js';
const shorten=(v,max=450)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const distinct=values=>[...new Set(values.filter(Boolean))];
/**
 * The model's action is a suggestion, never authority to visit a URL.
 * Tool arguments must pass validation against existing Search observations.
 */
export function normalizeResearchDecision(raw,pool,usedQueries){
 const data=raw&&typeof raw==='object'?raw:{};
 const byId=new Set(pool.map(p=>p.id));
 const byUrl=new Set(pool.map(p=>p.url));
 const operations=Array.isArray(data.actions)?data.actions:[];
 const seenIds=new Set(),ids=[];
 const suggestedQueries=[];
 let finish=false;
 for(const operation of operations){
  if(!operation||typeof operation!=='object')continue;
  if(operation.type==='finish')finish=true;
  if(operation.type==='search'&&Array.isArray(operation.queries))
   suggestedQueries.push(...operation.queries);
  if(operation.type==='fetch'&&Array.isArray(operation.candidate_ids)){
   for(const id of operation.candidate_ids){
    if(typeof id!=='string'||!byId.has(id)||seenIds.has(id))continue;
    seenIds.add(id);ids.push(id);
   }
  }
 }
 const shortlist=distinct((Array.isArray(data.shortlist_ids)?data.shortlist_ids:[])
  .filter(id=>typeof id==='string'&&byId.has(id)));
 // Model can discuss evidence, but cannot provide authoritative job URLs or
 // content. Only Search's validated pool goes to Fetch and the result UI.
 const queries=normalizeAutonomousQueries(suggestedQueries,usedQueries);
 return {queries,fetchIds:ids,shortlistIds:shortlist,finish,
  rationale:shorten(data.rationale,240),sourceCount:byUrl.size};
}
/**
 * Source recovery: use public repost titles as hints for a bounded search
 * of employer-owned hiring pages. Repost URLs never become job links.
 */
export function targetedEmployerRecoveryQueries(history,usedQueries=[]){
 const titles=[...history].reverse().flatMap(row=>
  Array.isArray(row?.rejected_title_hints)?row.rejected_title_hints:[]);
 const proposals=[];
 for(const item of titles){
  const title=shorten(item,95)
   .replace(/(?:[-—–|_ ]+)(?:牛企直聘|智联招聘|前程无忧|最佳东方|猎聘|BOSS直聘|招聘网|求职网)(?:.*)?$/i,'')
   .trim();
  if(title.length<4||/(?:Job Board|职位列表|全部职位|招聘首页|招聘频道|职位搜索)/i.test(title)||
   /(?:https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)1[3-9]\d{9}(?!\d))/i.test(title))continue;
  // No occupation whitelist: public titles can be cook, florist, farmer,
  // technician, driver or any other role; only privacy and source checks apply.
  proposals.push(title.slice(0,58)+' 企业官网 官方招聘 职位详情 -site:zhipin.com -site:51job.com -site:liepin.com');
 }
 return normalizeAutonomousQueries(proposals,usedQueries).slice(0,4);
}
/**
 * A final source-discovery pass when the Agent has too little real employer
 * evidence. Only already-public role names and AI-derived career-family
 * search terms are sent to Search. No private CV excerpt or invented URL.
 */
export function underfilledOfficialSearchQueries(groundedQueries,history,usedQueries=[]){
 const reposts=targetedEmployerRecoveryQueries(history,usedQueries);
 const fresh=usedQueries.slice(-4).map(q=>
  q.slice(0,80)+' 企业自有招聘官网 在招岗位 工作城市');
 return normalizeAutonomousQueries([...reposts,...groundedQueries,...fresh],usedQueries).slice(0,8);
}
