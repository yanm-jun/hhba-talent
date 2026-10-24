import type {LiveJob} from './liveRecruitment';
export type DomesticSummary = {
 id:string;sourceUrl:string;observedAt:string;
 mode:'HHBA_PARAPHRASED_HISTORICAL_SUMMARY';
 rightsReviewStatus:'RIGHTS_REVIEW_REQUIRED';
 responsibilities:string;requirements:string;
};
type Bundle={kind:string;updated:string;total:number;jobs:DomesticSummary[]};
let summaryCache:Promise<Map<string,DomesticSummary>>|null=null;
// Historical HHBA-authored paraphrases only. No original third-party JD or live status claim.
export async function loadDomesticSummary(job:LiveJob,signal:AbortSignal):Promise<DomesticSummary>{
 if(!job.domestic||job.recordKind!=='DOMESTIC_ARCHIVE_SNAPSHOT')throw new Error('不属于国内历史岗位');
 if(!summaryCache){
  summaryCache=fetch(import.meta.env.BASE_URL+'data/domestic-jd-summaries.json',{
   method:'GET',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}
  }).then(async response=>{
   if(!response.ok)throw new Error('历史岗位职责数据未发布');
   const data=await response.json() as Bundle;
   if(data.kind!=='HHBA_DOMESTIC_HISTORICAL_SUMMARIES_V1'||
      !Array.isArray(data.jobs)||data.jobs.length!==data.total||
      data.jobs.length>10000||!Number.isFinite(Date.parse(data.updated)))
      throw new Error('国内职位详情索引无效');
   const items=new Map<string,DomesticSummary>();
   for(const row of data.jobs){
    if(!row||typeof row.id!=='string'||!/^[A-Za-z0-9_-]{1,180}$/.test(row.id)||
       items.has(row.id)||typeof row.sourceUrl!=='string'||
       row.mode!=='HHBA_PARAPHRASED_HISTORICAL_SUMMARY'||
       row.rightsReviewStatus!=='RIGHTS_REVIEW_REQUIRED'||
       typeof row.responsibilities!=='string'||row.responsibilities.trim().length<20||
       row.responsibilities.length>5000||typeof row.requirements!=='string'||
       row.requirements.trim().length<20||row.requirements.length>5000)
      throw new Error('国内职位职责字段校验失败');
    items.set(row.id,row);
   }
   return items;
  }).catch(e=>{summaryCache=null;throw e});
 }
 const rows=await summaryCache;
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const result=rows.get(job.id);
 if(!result||result.sourceUrl!==job.url||result.observedAt!==job.observedAt)
   throw new Error('职责内容与该岗位原始来源不匹配');
 return result;
}
