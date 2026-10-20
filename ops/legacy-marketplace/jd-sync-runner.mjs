import {createHash} from "node:crypto";
const asError=e=>String(e instanceof Error?e.message:e).slice(0,120);
export function createFullJdWorker({store,source,readDetail,chunkJd,translateChunk,
   maxPartsDaily=300,maxPartsPerTick=3,now=()=>Date.now(),logger=console.log}){
  if(!store||typeof source!=="function"||typeof readDetail!=="function"||
     typeof chunkJd!=="function"||typeof translateChunk!=="function")
    throw Error("INCOMPLETE_JD_WORKER_DEPENDENCIES");
  if(!Number.isInteger(maxPartsDaily)||maxPartsDaily<1||maxPartsDaily>100000)
    throw Error("INVALID_DAILY_BUDGET");
  let busy=false,lastIndexUpdate="";
  let stopped=false;
  async function tick(){
    if(busy||stopped)return {skipped:true};
    busy=true;
    let id=null;
    try{
      const listing=await source();
      if(!listing || !Array.isArray(listing.rows)||!Number.isInteger(listing.boards)||
         !Number.isInteger(listing.failures)||listing.rows.length===0)
        throw Error("INVALID_OFFICIAL_ATS_INDEX");
      if(lastIndexUpdate!==listing.updated){
        // Never treat missing data on a partially failed ATS refresh as a closed job.
        const complete=listing.failures===0&&listing.boards>=3;
        store.catalogSync(listing.rows,{complete});
        lastIndexUpdate=listing.updated;
      }
      store.cleanup();
      if(store.remainingBudget(maxPartsDaily)<=0)return {budget_exhausted:true,remaining:0};
      const task=store.claim();
      if(!task)return {idle:true,coverage:store.coverage()};
      id=task.id;
      const job=listing.rows.find(row=>row.id===id);
      if(!job){store.fail(id,"JOB_NOT_IN_LATEST_INDEX",{permanent:listing.failures===0});id=null;return {not_found:true};}
      const detail=await readDetail(job);
      if(!detail||detail.status!=="LIVE_CONTENT"||typeof detail.description!=="string"){
        store.fail(id,"OFFICIAL_DESCRIPTION_NOT_AVAILABLE");
        id=null;return {source_missing:true};
      }
      if(detail.description.length>100000){store.fail(id,"ORIGINAL_JD_TOO_LONG",{permanent:true});id=null;return {too_long:true};}
      const blocks=chunkJd(detail.description);
      if(!Array.isArray(blocks)||blocks.length<1||blocks.length>150){
        store.fail(id,"SOURCE_JD_BLOCK_COUNT_UNSUPPORTED",{permanent:true});id=null;return {invalid_chunks:true};
      }
      const hash=createHash("sha256").update(detail.description).digest("hex");
      const version=store.sourceVersion(id,hash,blocks.length,detail.description);
      if(version.complete){id=null;return {already_complete:true};}
      let translated=0;
      for(let part=0;part<blocks.length&&translated<maxPartsPerTick;part++){
        if(store.cachedPart(id,hash,part,blocks.length)!==null)continue;
        if(!store.reserveBudget(maxPartsDaily))break;
        let chinese;
        try{chinese=await translateChunk(job,blocks[part],part,blocks.length);}
        catch(error){
          store.fail(id,"TRANSLATION_ERROR_"+asError(error));id=null;
          return {retry:true,done:translated,error:asError(error)};
        }
        if(!chinese || typeof chinese!=="string"){
          store.fail(id,"TRANSLATION_INCOMPLETE");id=null;
          return {retry:true,done:translated};
        }
        const saved=store.saveVerifiedPart(id,hash,part,blocks.length,chinese);
        translated++;
        if(saved.complete){
          logger("HHBA_FULL_JD_COMPLETED",JSON.stringify({platform:job.platform,jobId:id,parts:blocks.length}));
          id=null;
          return {complete:true,done:translated};
        }
      }
      store.release(id);id=null;
      return {progress:true,done:translated,remainingBudget:store.remainingBudget(maxPartsDaily)};
    }catch(error){
      const reason=asError(error);
      if(id){try{store.fail(id,reason)}catch{}}
      logger("HHBA_FULL_JD_WORKER_RETRY",JSON.stringify({reason}));
      return {error:reason};
    }finally{busy=false;}
  }
  function stop(){stopped=true}
  return {tick,stop,coverage:()=>({...store.coverage(),daily_budget_remaining:store.remainingBudget(maxPartsDaily),worker_busy:busy})};
}
