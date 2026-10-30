import type {SearchFacet} from './jobSearchFacets.mjs';
export type PublicSearchFacetIndex = {
 kind:'HHBA_OFFICIAL_JD_SEARCH_FACETS_V1';
 indexed_as_of:string;
 verified_at:string;
 total_indexed_jobs:number;
 extracted_count:number;
 extraction_mode:string;
 jobs:({id:string;original_source_hash:string}&SearchFacet)[];
};
type LoadedIndex={indexed_as_of:string;extracted_count:number;facets:Map<string,SearchFacet>};
let promise:Promise<LoadedIndex>|null=null;
export async function loadOfficialSearchFacets():Promise<LoadedIndex>{
 if(!promise){
  const path=import.meta.env.BASE_URL+'data/job-search-facets.json';
  promise=fetch(path,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}})
   .then(async response=>{
     if(!response.ok)throw new Error('岗位筛选条件索引尚未发布');
     const data=await response.json() as Partial<PublicSearchFacetIndex>;
     if(data.kind!=='HHBA_OFFICIAL_JD_SEARCH_FACETS_V1'||
        !Array.isArray(data.jobs)||data.jobs.length>25000||
        !Number.isInteger(data.total_indexed_jobs)||data.total_indexed_jobs!<1||
        data.jobs.length!==data.extracted_count||
        typeof data.indexed_as_of!=='string'||!Number.isFinite(Date.parse(data.indexed_as_of))||
        data.indexed_as_of!==data.indexed_as_of.trim())throw new Error('岗位搜索条件索引不完整');
     if(Date.now()-Date.parse(data.indexed_as_of)>24*3600_000||
        Date.parse(data.indexed_as_of)>Date.now()+5*60_000)throw new Error('岗位搜索条件已过期');
     const facets=new Map<string,SearchFacet>();
     for(const row of data.jobs){
       if(!row||typeof row.id!=='string'||!/^[A-Za-z0-9_-]{1,180}$/.test(row.id)||
          !/^[a-f0-9]{64}$/.test(String(row.original_source_hash||''))||
          !['greenhouse','ashby','lever'].some(p=>row.id.startsWith(p+'-'))||
          (row.education!==null&&!['UNRESTRICTED','HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'].includes(row.education))||
          (row.experienceMinYears!==null&&!Number.isInteger(row.experienceMinYears))||
          !Array.isArray(row.skills)||row.skills.length>32||facets.has(row.id))
         throw new Error('岗位搜索证据元数据格式异常');
       facets.set(row.id,row);
     }
     return {indexed_as_of:data.indexed_as_of,extracted_count:data.extracted_count!,facets};
   }).catch(e=>{promise=null;throw e});
 }
 return promise;
}
