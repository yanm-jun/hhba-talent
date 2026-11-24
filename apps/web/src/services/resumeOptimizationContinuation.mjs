// Acknowledged progress belongs to the current exact document/JD only.
// Keep it in the editor session; no resume contents are persisted by this helper.
export async function continueDocumentOptimization({blockIds,wanted,request,wait,signal,onCheckpoint,onQueued,onPaused}){
 const ids=new Set(blockIds);
 let pending=[...new Set(wanted??blockIds)].filter(id=>ids.has(id));
 const initialCount=pending.length, suggestions=new Map();
 let previousStall='';
 const emit=()=>onCheckpoint?.({pending:[...pending],suggestions:[...suggestions.values()]});
 const paused=error=>{
  emit();
  if(pending.length===initialCount&&initialCount===ids.size)throw error;
  onPaused?.(error);
  return [...suggestions.values()];
 };
 emit();
 while(pending.length){
  if(signal?.aborted)throw signal.reason;
  let result;
  try{result=await request([...pending]);}
  catch(error){if(signal?.aborted)throw signal.reason;return paused(error);}
  if(signal?.aborted)throw signal.reason;
  if(result.queued){
   onQueued?.();await wait(signal);continue;
  }
  // A malformed response cannot prove that a section was reviewed.
  if(!Array.isArray(result.suggestions)||!Array.isArray(result.pending)||
     result.pending.some(id=>!pending.includes(id)))
   return paused(result.invalidError??new Error('INVALID_OPTIMIZATION_RESPONSE'));
  const requested=new Set(pending);
  for(const item of result.suggestions){
   if(item&&requested.has(item.blockId))suggestions.set(item.blockId,item);
  }
  const next=[...new Set(result.pending)];
  const stalled=next.length===pending.length;
  pending=next;emit();
  if(!pending.length)break;
  if(result.pauseError){onPaused?.(result.pauseError);break;}
  if(stalled){
   const signature=JSON.stringify([...pending].sort());
   if(previousStall===signature){
    onPaused?.(new Error('本轮研究暂未取得进一步进展，请继续处理剩余段落。'));
    break;
   }
   previousStall=signature;onQueued?.();await wait(signal);
  }else previousStall='';
 }
 return [...suggestions.values()];
}
