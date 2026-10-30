import {createHash} from "node:crypto";

/**
 * Single-process bounded background reader. All callbacks use the same
 * official JD extraction + validated semantic translator as live user reads.
 *
 * Only starts if a private persistent SQLite volume is mounted and enabled.
 * One official JD chunk per tick. There is no uncontrolled parallel crawl.
 */
export function startOverseasJdWorker({store,load,boardsCount,officialDetail,
 jdChunks,translateVerifiedChunk,maxCharacters=100000,dailyChunks=180,
 intervalMs=90000,initialDelayMs=30000,logger=console,now=()=>Date.now()}){
 if(!store)throw Error("REQUIRES_PRIVATE_DURABLE_STORE");
 if(typeof load!=="function"||typeof officialDetail!=="function"||
    typeof jdChunks!=="function"||typeof translateVerifiedChunk!=="function")
   throw Error("MISSING_TRANSLATION_DEPENDENCY");
 let busy=false,stopped=false,lastCatalogRefresh=0;
 let currentId=null;
 async function tick(){
  if(stopped||busy)return {status:"BUSY_OR_STOPPED"};
  busy=true;currentId=null;
  try{
   const feed=await load();
   if(!feed?.rows?.length)return {status:"EMPTY_FEED"};
   if(now()-lastCatalogRefresh>10*60000){
    const complete=feed.failures===0&&feed.boards===boardsCount;
    const synced=store.catalogSync(feed.rows,{complete});
    store.cleanup();
    lastCatalogRefresh=now();
    logger.log("HHBA_JD_SYNC_CATALOG",JSON.stringify({discovered:synced.discovered,
     completeIndex:complete,completed:store.coverage().complete}));
   }
   if(store.remainingBudget(dailyChunks)<=0)return {status:"DAILY_BUDGET_EXHAUSTED"};
   const leased=store.claim();
   if(!leased)return {status:"QUEUE_EMPTY"};
   currentId=leased.id;
   const job=feed.rows.find(j=>j.id===currentId&&!j.domestic);
   if(!job){
    store.fail(currentId,"SOURCE_JOB_NOT_IN_CURRENT_FEED",{
      permanent:feed.failures===0&&feed.boards===boardsCount});
    return {status:"SOURCE_MISSING"};
   }
   const detail=await officialDetail(job);
   if(!detail||detail.status!=="LIVE_CONTENT"){
    store.fail(currentId,"OFFICIAL_DETAIL_UNAVAILABLE");
    return {status:"DETAIL_UNAVAILABLE"};
   }
   const original=detail.description;
   if(!original||original.length>maxCharacters){
    store.fail(currentId,"JD_SOURCE_OVERSIZED_OR_EMPTY",{permanent:true});
    return {status:"SOURCE_UNSUPPORTED"};
   }
   const hash=createHash("sha256").update(original).digest("hex");
   const chunks=jdChunks(original);
   if(!chunks.length||chunks.length>150){
    store.fail(currentId,"JD_PARTS_UNSUPPORTED",{permanent:true});
    return {status:"SOURCE_UNSUPPORTED"};
   }
   const source=store.sourceVersion(job.id,hash,chunks.length,original);
   if(source.complete)return {status:"COMPLETE_ALREADY",id:job.id};
   for(let part=0;part<chunks.length;part++){
    if(store.cachedPart(job.id,hash,part,chunks.length))continue;
    if(!store.reserveBudget(dailyChunks)){
     store.release(job.id);
     return {status:"DAILY_BUDGET_EXHAUSTED"};
    }
    const translated=await translateVerifiedChunk(job,chunks[part]);
    if(!translated?.text){
      store.fail(job.id,translated?.error||"TRANSLATION_UNVERIFIED",
        {permanent:translated?.error==="invalid_layout"});
      return {status:"TRANSLATION_RETRY",reason:translated?.error||"unknown"};
    }
    const progress=store.saveVerifiedPart(job.id,hash,part,chunks.length,translated.text);
    logger.log("HHBA_JD_SYNC_PART",JSON.stringify({
      platform:job.platform,part:part+1,total:chunks.length,
      complete:progress.complete,budgetRemaining:store.remainingBudget(dailyChunks)
    }));
    if(!progress.complete)store.release(job.id);
    return {status:progress.complete?"COMPLETED_JOB":"STORED_PART",id:job.id,done:progress.done,total:chunks.length};
   }
   store.release(job.id);
   return {status:"NO_MISSING_PART"};
  }catch(e){
    logger.warn("HHBA_JD_SYNC_FAILURE",e instanceof Error?e.message:"unknown");
    if(currentId)try{store.fail(currentId,e instanceof Error?e.message:"UNKNOWN_FAILURE")}catch{}
    return {status:"WORKER_ERROR"};
  }finally{busy=false;currentId=null;}
 }
 const initial=setTimeout(()=>{void tick()},initialDelayMs);
 const interval=setInterval(()=>{void tick()},intervalMs);
 logger.log("HHBA_JD_SYNC_STARTED",JSON.stringify({intervalMs,dailyChunks,
  mode:"PRIVATE_DURABLE_BACKGROUND_TRANSLATION"}));
 return {tick,stop:()=>{stopped=true;clearTimeout(initial);clearInterval(interval);},isBusy:()=>busy};
}
