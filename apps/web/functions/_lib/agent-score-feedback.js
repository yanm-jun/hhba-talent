/**
 * Feedback-driven evidence refinement: the score/reasoning stage sends its
 * unresolved facts to the same model, which chooses whether to research more.
 * The model never supplies authoritative job descriptions or arbitrary URLs.
 * The provider search is public, so private résumé contents never enter queries.
 */
import {normalizeAutonomousQueries} from './autonomous-mainland-search.js';
import {researchDomesticJobEvidence} from './domestic-job-research.js';
import {sortByMatchScore} from './match-job-quality.js';

const BASE='https://api.deepseek.com';
const stateRank={INSUFFICIENT_EVIDENCE:0,SEARCH_SNIPPET_ONLY:1,PARTIAL_SOURCE:2,VERIFIED_FULL_JD:3};
const clean=(s,n=500)=>String(s||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const validId=s=>typeof s==='string'&&/^[a-z0-9_-]{1,100}$/i.test(s);
const outputText=json=>(json?.output||[]).filter(x=>x?.type==='message')
 .flatMap(x=>(x.content||[]).filter(y=>y?.type==='output_text').map(y=>y.text||'')).join('');

export function normalizeFeedbackActions(raw,unresolved,previous=[]){
 const allowed=new Set(unresolved.map(j=>j.id).filter(validId));
 const byJob=new Map(),used=new Set(previous);
 const rows=Array.isArray(raw?.actions)?raw.actions:[];
 for(const row of rows){
  if(row?.type!=='search'||!allowed.has(row.job_id))continue;
  const next=normalizeAutonomousQueries(row.queries,used);
  if(!next.length)continue;
  // Query-specific context should contain employer/role, not résumé facts.
  // This is validation, not the AI's choice of career direction.
  const job=unresolved.find(x=>x.id===row.job_id);
  const company=clean(job?.company,85);
  const role=clean(job?.title_zh||job?.title,100);
  const grounded=next.filter(q=>(company&&q.includes(company))||
   (role&&q.includes(role))||(company.length>4&&q.includes(company.slice(0,4))));
  if(!grounded.length)continue;
  const queries=grounded.filter(q=>!used.has(q));
  queries.forEach(q=>used.add(q));
  if(queries.length)byJob.set(row.job_id,[...(byJob.get(row.job_id)||[]),...queries]);
 }
 return {actions:[...byJob].map(([job_id,queries])=>({job_id,queries})),
  finish:raw?.finish===true,
  rationale:clean(raw?.rationale,200)};
}
async function planFeedback(key,resume,jobs,history,{fetcher=fetch,signal=null,timeoutMs=22000}={}){
 const timeout=AbortSignal.timeout(timeoutMs),sig=signal?AbortSignal.any([signal,timeout]):timeout;
 const input=jobs.map(j=>({id:j.id,company:j.company,title:j.title_zh||j.title,
  city:j.location,evidence_status:j.evidence_status,score:j.match_score,
  score_basis:clean(j.score_basis,260),evidence_excerpt:clean(j.evidence_excerpt,680),
  evidence_gaps:Array.isArray(j.evidence_gaps)?j.evidence_gaps.slice(0,5):[],
  next_research_questions:Array.isArray(j.next_research_questions)?
   j.next_research_questions.slice(0,5):[],
  source_count:j.evidence_sources?.length||0}));
 const instructions=[
  '你是 HHBA 岗位研究主 Agent，评分器已经根据公开证据分析岗位，现在请决定是否必须回头补充研究。',
  '你拥有研究决策权，不用机械地为所有岗位重复搜索。重点是证据不足、无法说明任职资格、推荐理由缺少岗位依据的候选。',
  '操作是 search：指定已有岗位 id 和适当的中国大陆公开招聘搜索查询词。优先利用企业、具体岗位名称和所需任职要求进行检索。可以根据证据问题改变查询方向。',
  '搜索词仅含公开企业、岗位和公开的职位信息，绝对不要放入求职者简历、姓名、经验细节、手机号、邮箱、身份证、令牌或私密信息。',
  '不允许生成新职位或来源 URL，不允许绕过登录和验证码。若证据已充分或公开来源无法核实，finish=true。',
  '严格 JSON：{"actions":[{"type":"search","job_id":"已有id","queries":["企业名称 岗位名称 任职资格 官方招聘"]}],"finish":false,"rationale":"下一步研究理由"}'
 ].join('\n');
 const response=await fetcher(BASE+'/responses',{method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'high'},max_output_tokens:8500,
   text:{format:{type:'json_object'}},stream:false,instructions,
   input:'岗位的评分反馈与公开来源：\n'+JSON.stringify(input)+
    '\n已采取的公开研究操作：\n'+JSON.stringify(history.slice(-12))})
 });
 if(!response.ok)throw Error('AGENT_FEEDBACK_UNAVAILABLE');
 return JSON.parse(outputText(await response.json()));
}
async function publicEvidenceSearch(key,query,{fetcher=fetch,signal=null,timeoutMs=10000}={}){
 const timeout=AbortSignal.timeout(timeoutMs),sig=signal?AbortSignal.any([signal,timeout]):timeout;
 const response=await fetcher(BASE+'/v1/tools/search',{method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({query,count:12,need_content:false})});
 if(!response.ok)throw Error('EVIDENCE_PROVIDER_SEARCH_FAILED');
 const data=await response.json();return Array.isArray(data.results)?data.results.slice(0,12):[];
}
export async function iterateScoredJobEvidence(key,resume,matches,options={},deps={}){
 const initial=Array.isArray(matches)?matches:[];
 const onProgress=options.onProgress||(()=>{});
 const signal=options.signal,deadline=Date.now()+(options.timeBudgetMs??68000);
 const decide=deps.decide||planFeedback,search=deps.search||publicEvidenceSearch;
 const rescore=deps.rescore||researchDomesticJobEvidence;
 let jobs=[...initial],rounds=0,queryCount=0,errors=0,improved=0;
 const used=[],history=[];
 while(Date.now()+14500<deadline){
  if(signal?.aborted)break;
  const unresolved=jobs.filter(j=>j.jd_source_status!=='VERIFIED_JD'&&
   (j.match_score===null||j.match_score===undefined||
    j.evidence_status==='INSUFFICIENT_EVIDENCE'||
    j.evidence_status==='SEARCH_SNIPPET_ONLY'||
    (Array.isArray(j.evidence_gaps)&&j.evidence_gaps.length>0)||
    j.evidence_reason_status!=='AI_INDIVIDUAL_ANALYSIS'));
  if(!unresolved.length)break;
  let choice;
  try{choice=normalizeFeedbackActions(await decide(key,resume,unresolved,history,{
   ...options,timeoutMs:Math.min(22000,Math.max(3000,deadline-Date.now()-11000))
  }),unresolved,used)}
  catch{errors++;break}
  if(choice.finish||!choice.actions.length)break;
  const collected=new Map();
  for(const action of choice.actions){
   for(const query of action.queries){
    if(signal?.aborted||Date.now()+11000>=deadline)break;
    used.push(query);queryCount++;
    try{
     const hits=await search(key,query,{...options,
      timeoutMs:Math.min(10000,deadline-Date.now()-2500)});
     collected.set(action.job_id,[...(collected.get(action.job_id)||[]),...hits]);
    }catch{errors++}
   }
  }
  if(!collected.size)break;
  onProgress('researching');
  const targets=unresolved.filter(j=>collected.has(j.id));
  if(!targets.length)break;
  const byId=new Map(jobs.map(j=>[j.id,j]));
  onProgress('scoring');
  let updated;
  try{
   updated=await rescore(key,resume,targets,{...options,
    onProgress:()=>onProgress('scoring')},{
    search:async(k,job)=>collected.get(job.id)||[]
   });
  }catch{errors++;break}
  let roundImprovements=0;
  for(const current of updated.matches||[]){
   const old=byId.get(current.id);
   if(!old)continue;
   const oldRank=stateRank[old.evidence_status]??0,newRank=stateRank[current.evidence_status]??0;
   const better=newRank>oldRank||
    (newRank===oldRank&&old.match_score==null&&current.match_score!=null)||
    (newRank===oldRank&&current.evidence_reason_status==='AI_INDIVIDUAL_ANALYSIS'&&
     old.evidence_reason_status!=='AI_INDIVIDUAL_ANALYSIS');
   // Never overwrite an existing evaluated result with a worse source.
   if(better){byId.set(current.id,{...current,feedback_refined:true});roundImprovements++}
  }
  jobs=jobs.map(j=>byId.get(j.id)||j);
  improved+=roundImprovements;rounds++;
  history.push({round:rounds,researched:targets.map(x=>x.id),
   new_information:roundImprovements,queries:choice.actions.reduce((n,a)=>n+a.queries.length,0)});
  options.onCheckpoint?.({phase:'feedback',jobs:jobs.map(j=>({
   id:j.id,evidence_status:j.evidence_status,match_score:j.match_score
  })),rounds,query_count:queryCount});
  if(!roundImprovements)break;
 }
 return {matches:sortByMatchScore(jobs),diagnostic:{mode:'HHBA_AGENT_SCORE_FEEDBACK_V1',
  feedback_rounds:rounds,feedback_queries:queryCount,feedback_refined_jobs:improved,
  feedback_errors:errors,unresolved_after:jobs.filter(j=>j.match_score==null).length}};
}
