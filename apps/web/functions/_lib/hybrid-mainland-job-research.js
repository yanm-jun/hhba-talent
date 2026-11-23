/**
 * Mainland recruitment discovery from two independent DeepSeek capabilities:
 * 1) native model-owned deep search and page reading
 * 2) standalone Search over explicit public occupation + preference cities
 *
 * Run them IN PARALLEL to avoid a second long wait if native deep search
 * returns few job URLs. Raw resumes never enter standalone Search queries.
 *
 * A Search result is only a source hint. No listing is invented, scored,
 * marked open or called "verified JD" without the existing independent gates.
 */
import {runNativeDeepSearchJobs} from './native-deepsearch-job-research.js';
import {searchPublicJobs,enrichCandidateDetails,sourceOnlyJobPreviews,recoverSearchGroundedShortlist,indexedJobWorkCity} from './deepseek-search-match.js';
import {isMainlandEmployerJobUrl,isDirectEmployerSourceHit} from './match-employer-source.js';
import {fallbackIndexIndustries} from './domestic-employer-index.js';

export const HYBRID_DISCOVERY_VERSION='HHBA_MAINLAND_NATIVE_HYBRID_RECALL_V1';
const compact=(value,max=90)=>String(value||'').replace(/[\u0000-\u001f]/g,' ')
 .replace(/\s+/g,' ').trim().slice(0,max);
const CONTACT=/(?:https?:|www\.|@|(?<!\d)1[3-9]\d{9}(?!\d)|(?:身份证|手机号|邮箱|家庭地址|联系电话)|(?:sk-[a-z0-9_-]{12,}))/i;
function role(x){
 const text=compact(x,65);
 return text.length>=2&&text.length<=45&&!CONTACT.test(text)?
  text.replace(/["'<>\\|{}]/g,' ').trim():'';
}
/**
 * Only *explicit* preference labels in a redacted CV can determine where to
 * widen Search; previous office/territory cities are NOT a preference.
 */
export function mainlandSearchPreferenceCities(resume){
 const text=String(resume||'').slice(0,16000);
 const m=text.match(/(?:期望(?:工作)?城市|意向(?:工作)?城市|求职(?:意向)?地点|期望工作(?:地点|地)|意向工作(?:地点|地))[：:\s]{1,5}([^\n\r；;。]{2,38})/);
 const val=compact(m?.[1]||'',40);
 if(!val||CONTACT.test(val))return [];
 if(/上海/.test(val))return ['上海','苏州','杭州'];
 if(/北京/.test(val))return ['北京','天津','廊坊'];
 if(/深圳|广州/.test(val))return ['深圳','广州','东莞'];
 if(/南京/.test(val))return ['南京','苏州','合肥'];
 if(/杭州/.test(val))return ['杭州','嘉兴','上海'];
 if(/苏州/.test(val))return ['苏州','上海','无锡'];
 if(/成都/.test(val))return ['成都','德阳','重庆'];
 if(/武汉/.test(val))return ['武汉','鄂州','孝感'];
 if(/济南/.test(val))return ['济南','淄博','泰安'];
 if(/青岛/.test(val))return ['青岛','烟台','潍坊'];
 return [];
}
export function mainlandHybridSearchQueries(resume,roleHint,profile,limit=6){
 const roles=[roleHint,...(Array.isArray(profile?.target_roles)?profile.target_roles:[])]
  .map(role).filter(Boolean);
 const uniqueRoles=[...new Set(roles)].slice(0,3);
 if(!uniqueRoles.length)return [];
 const cities=mainlandSearchPreferenceCities(resume);
 // The native Agent handles wider city reasoning. These supplementary Search
 // calls are deliberately broad, domestic and independent of CV personal data.
 const places=cities.length?cities:['全国','中国大陆'];
 const list=[];
 for(const target of uniqueRoles){
  for(const city of places.slice(0,3)){
   list.push((target+' '+city+' 企业官网 社会招聘 职位详情').slice(0,128));
   if(list.length>=limit)return list;
  }
 }
 return list;
}
const knownCode=e=>typeof e?.code==='string'&&/^AI_[A-Z_]+$/.test(e.code)?
 e.code:'AI_NATIVE_DEEPSEARCH_FAILED';
const fatalProviderCode=new Set([
 'AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
 'AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_REQUEST_REJECTED'
]);

export async function runHybridMainlandJobResearch(key,resume,roleHint,limit=10,options={},deps={}){
 const native=deps.native||runNativeDeepSearchJobs,search=deps.search||searchPublicJobs,
  enrich=deps.enrich||enrichCandidateDetails,
  recover=deps.recover||recoverSearchGroundedShortlist,
  previews=deps.previews||sourceOnlyJobPreviews,now=Date.now();
 const nativeTrial=options.search_engine!=='standard';
 const baseQueries=mainlandHybridSearchQueries(resume,roleHint,options.resumeProfile,nativeTrial?6:3);
 let queries=baseQueries,indexCompanies=0;
 const companion=(async()=>{
  const roles=[roleHint,...(options.resumeProfile?.target_roles||[])].map(role).filter(Boolean).slice(0,4);
  if(typeof options.employerIndex==='function'&&roles.length){
   try{
    const hint=await options.employerIndex(roles,fallbackIndexIndustries(roles));
    if(hint?.available&&Array.isArray(hint.queries)){
     indexCompanies=Number(hint.considered)||0;
     queries=[...new Set([...baseQueries,...hint.queries.filter(q=>
      typeof q==='string'&&q.length<=128&&!CONTACT.test(q))])].slice(0,nativeTrial?9:5);
    }
   }catch{/* Index is only a hint. Public Search remains independent. */}
  }
  if(!queries.length)return {matches:[],hits:[],diagnostic:{queries:0,raw_results:0,candidate_links:0},error:null};
  try{
   const r=await search(key,'',roleHint,{signal:options.signal,
    queriesOverride:queries,allowEmpty:true,maxHits:54,queryTimeoutMs:12500});
   const hits=(r.hits||[]).filter(x=>isDirectEmployerSourceHit(x)&&
    options.excludePosting?.(x.url)!==true);
   // Search can return a legitimate official vacancy URL with only a
   // generic "职位详情" summary. Never discard it before fetching the page.
   if(hits.length)options.onSources?.([],[],hits.map(x=>x.url));
   const initial=previews(hits,limit).filter(job=>
    isMainlandEmployerJobUrl(job.official_url));
   let candidates=hits,readSuccess=0,readAttempted=0,readFailures=0;
   if(hits.length){
    readAttempted=Math.min(hits.length,12);
    options.onProgress?.('reading');
    options.onActivity?.({stage:'reading',
     message:'已发现 '+hits.length+' 条国内企业招聘链接，正在打开最多 '+
      readAttempted+' 个具体网页核对岗位名称和工作地点。'});
    try{
     const details=await enrich(key,hits,{signal:options.signal,
      onProgress:options.onProgress,
      maxFetch:readAttempted,fetchTimeoutMs:6500});
     candidates=(details?.hits||hits).filter(x=>isDirectEmployerSourceHit(x));
     readSuccess=Math.min(readAttempted,Number(details?.fetches)||0);
     readFailures=Math.max(0,readAttempted-readSuccess);
    }catch{
     // Broken Fetch never invalidates the original public Search evidence.
     candidates=hits;readFailures=readAttempted;
    }
   }
   const cityEvidence=candidates.filter(hit=>Boolean(indexedJobWorkCity(hit))).length;
   const fromFetched=previews(candidates,limit).filter(job=>
    isMainlandEmployerJobUrl(job.official_url));
   // Model-backed source extraction is supplementary, not a trusted answer:
   // URL, employer, job and real work-city must still corroborate with the
   // ORIGINAL fetched Search record via the existing selectedJobs validator.
   let modelRecovered=0;
   let jobs=[...fromFetched];
   if(jobs.length<Math.min(limit,6)&&
      candidates.some(hit=>typeof hit.content==='string'&&hit.content.length>=80)){
    options.onActivity?.({stage:'researching',message:'已阅读 '+readSuccess+
     ' 个招聘网页，正在让 AI 对照原始页面复核仍未识别的岗位与工作城市。'});
    try{
     const extracted=await recover(key,resume,candidates,
      Math.min(limit,10),{signal:options.signal,recoveryTimeoutMs:19000});
     const byUrl=new Map(candidates.map(hit=>[hit.url,hit]));
     const seen=new Set(jobs.map(job=>job.official_url));
     for(const raw of Array.isArray(extracted)?extracted:[]){
      const url=raw?.official_url,hit=byUrl.get(url);
      if(!hit||!isDirectEmployerSourceHit(hit)||seen.has(url)||
       !indexedJobWorkCity(hit)||!isMainlandEmployerJobUrl(url)||
       options.excludePosting?.(url)===true)continue;
      // Never trust a model's score or open/recruiting-state claims.
      const job={...raw,match_score:null,reference_score:0,score_basis:'',
       source_type:'站外招聘职位',source_status:'SOURCE_SEARCH_PREVIEW',
       evidence_status:'RESEARCH_PENDING',recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE',
       application_status:'NEEDS_OFFICIAL_CONFIRMATION',
       research_anchor:{url,title:hit.title,site_name:hit.source,
        summary:String(hit.content||hit.summary||'').slice(0,700)}};
      seen.add(url);jobs.push(job);modelRecovered++;
      if(jobs.length>=limit)break;
     }
    }catch{/* public-source previews remain available */}
   }
   if(!jobs.length&&initial.length)jobs=initial;
   if(jobs.length)options.onSources?.(jobs,[],[]);
   if(jobs.length)options.onPartial?.(jobs);
   options.onActivity?.({stage:'searching',
    message:'国内企业补充搜索：检索 '+queries.length+' 组关键词，发现 '+hits.length+
     ' 条招聘来源，读取 '+readSuccess+' 个网页、确认 '+cityEvidence+
     ' 条具体工作城市证据，形成 '+jobs.length+' 条待核实职位。',
    searches:r.diagnostic?.successful_searches||0,candidate_links:hits.length,
    pages_read:readSuccess});
   return {matches:jobs,hits:candidates,diagnostic:{...r.diagnostic,
    source_preview_before_fetch:initial.length,
    fetched_job_pages:readSuccess,fetch_attempted:readAttempted,
    fetch_failures:readFailures,explicit_work_city_sources:cityEvidence,
    model_recovered:modelRecovered,source_previews:jobs.length},error:null};

  }catch(e){
   const code=knownCode(e);
   options.onActivity?.({stage:'searching',message:'国内企业补充搜索暂不可用；原生深度搜索继续独立执行。'});
   return {matches:[],hits:[],diagnostic:{queries:queries.length,search_failures:queries.length},error:code};
  }
 })();
 // Concurrent, never a sequential second 150-second research after primary.
 const [nativeResult,supplementalResult]=await Promise.allSettled([
  native(key,resume,roleHint,limit,options,deps.nativeDependencies||{}),companion
 ]);
 const supplement=supplementalResult.status==='fulfilled'?supplementalResult.value:
  {matches:[],hits:[],diagnostic:{},error:'AI_SEARCH_UNAVAILABLE'};
 const deep=nativeResult.status==='fulfilled'?nativeResult.value:null;
 const nativeError=nativeResult.status==='rejected'?knownCode(nativeResult.reason):null;
 if(nativeError&&fatalProviderCode.has(nativeError)&&supplement.error)
  throw nativeResult.reason;
 if(!deep&&!supplement.matches.length&&!supplement.hits.length){
  if(nativeResult.status==='rejected'){
   const e=nativeResult.reason;
   if(!e.diagnostic)e.diagnostic={};
   e.diagnostic={...e.diagnostic,hybrid_fallback:{
    searched:queries.length,candidate_links:0,error:supplement.error}};
   throw e;
  }
 }
 const merged=[],seen=new Set();
 for(const item of [...(deep?.matches||[]),...supplement.matches]){
  if(!item||!isMainlandEmployerJobUrl(item.official_url)||
   options.excludePosting?.(item.official_url)===true||
   seen.has(item.official_url))continue;
  seen.add(item.official_url);merged.push(item);
  if(merged.length>=limit)break;
 }
 const diag=deep?.diagnostic||nativeResult.reason?.diagnostic||{};
 const searchDiag=supplement.diagnostic||{};
 return {matches:merged,incomplete:merged.length<limit,diagnostic:{
  ...diag,mode:HYBRID_DISCOVERY_VERSION,
  native_mode:diag.mode||null,native_error:nativeError,
  searches:(Number(diag.searches)||0)+(Number(searchDiag.successful_searches)||0),
  candidate_links:(Number(diag.candidate_links)||0)+(Number(searchDiag.candidate_links)||0),
  provider_items:(Number(diag.provider_items)||0)+(Number(searchDiag.raw_results)||0),
  visible_jobs:merged.length,elapsed_ms:Date.now()-now,
  hybrid_fallback:{queries:queries.length,index_companies_considered:indexCompanies,
   raw_results:Number(searchDiag.raw_results)||0,
   candidate_links:supplement.hits.length,
   source_previews:supplement.matches.length,
   source_preview_before_fetch:Number(searchDiag.source_preview_before_fetch)||0,
   fetch_attempted:Number(searchDiag.fetch_attempted)||0,
   fetched_job_pages:Number(searchDiag.fetched_job_pages)||0,
   fetch_failures:Number(searchDiag.fetch_failures)||0,
   explicit_work_city_sources:Number(searchDiag.explicit_work_city_sources)||0,
   model_recovered:Number(searchDiag.model_recovered)||0,
   search_failures:Number(searchDiag.search_failures)||0,
   error:supplement.error}
 }};
}
