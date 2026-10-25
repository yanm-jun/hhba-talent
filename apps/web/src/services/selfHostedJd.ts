import type {LiveJob} from './liveRecruitment';
export type SelfHostedJd = {
 id:string;company:string;title:string;sourceUrl:string;
 mode:'MANUAL_EDITORIAL'|'ARCHIVAL_EDITORIAL'|'EXTRACTED_FACTS';
 reviewDate:string|null;sourcePage:string|null;
 overviewZh:string;responsibilitiesZh:string[];requirementsZh:string[];benefitsZh:string[];
 overviewEn:string;responsibilitiesEn:string[];requirementsEn:string[];benefitsEn:string[];
 facts:{education:string|null;experienceMinYears:number|null;skills:string[];sourceHash:string}|null;
};
type Shard={kind:string;snapshotUpdated:string;jobs:Record<string,SelfHostedJd>};
const sources=new Map<string,Promise<Shard>>();
function sourceShard(id:string){return String([...id].reduce((n,ch)=>(n+ch.charCodeAt(0))%32,0)).padStart(2,'0');}
export async function readSelfHostedJd(job:LiveJob,signal:AbortSignal):Promise<SelfHostedJd|null>{
 if(!/^[A-Za-z0-9_-]{1,180}$/.test(job.id))return null;
 const file=sourceShard(job.id);
 if(!sources.has(file)){
  const promise=fetch(import.meta.env.BASE_URL+'data/self-hosted-jd/v1/'+file+'.json',{
   method:'GET',credentials:'omit',cache:'force-cache',signal:undefined,
   headers:{Accept:'application/json'}
  }).then(async response=>{
   if(!response.ok)throw Error('本地职位快照尚未发布');
   const data=await response.json() as Shard;
   if(data.kind!=='HHBA_SELF_HOSTED_JD_SHARD_V1'||!Array.isArray(Object.values(data.jobs))||
      !Number.isFinite(Date.parse(data.snapshotUpdated)))
    throw Error('本地职位快照格式异常');
   return data;
  }).catch(e=>{sources.delete(file);throw e});
  sources.set(file,promise);
 }
 const data=await sources.get(file)!;
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const row=data.jobs[job.id];
 if(!row)return null;
 // Never let a different posting, company or stale ID inherit another job's requirements.
 if(row.id!==job.id||row.company!==job.company||row.title!==job.title||row.sourceUrl!==job.url)
  return null;
 if(!['MANUAL_EDITORIAL','ARCHIVAL_EDITORIAL','EXTRACTED_FACTS'].includes(row.mode))
  return null;
 if(row.mode!=='EXTRACTED_FACTS'&&
   (!Array.isArray(row.responsibilitiesZh)||!row.responsibilitiesZh.length||
    !Array.isArray(row.requirementsZh)||!row.requirementsZh.length))
  return null;
 return row;
}
