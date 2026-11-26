// Coalesce encrypted progress snapshots, not discovery itself. Reports take
// precedence over new candidate counts, and both take precedence over routine
// activity. No additional model requests or limits on discovered jobs.
const priority={routine:1,candidate:2,report:3};
const interval={routine:20000,candidate:3000,report:1000};
export function createV4ProgressPublisher({publish,canPublish=()=>true,now=Date.now,schedule=setTimeout,cancel=clearTimeout,initialLastWrite=now()-17000}){
 let lastWrite=initialLastWrite,timer=null,armedKind=null,pending=null,dirty=null,closed=false;
 const clear=()=>{if(timer!==null){cancel(timer);timer=null;}armedKind=null;};
 function arm(){
  if(closed||pending||!dirty)return;
  const kind=dirty;
  // Bursts of same-priority candidates reuse the existing deadline rather
  // than allocating/cancelling a timer for each arrival.
  if(timer!==null&&armedKind===kind)return;
  clear();
  if(!canPublish(kind))return; // existing phase-end flush retains the latest snapshot
  armedKind=kind;
  timer=schedule(()=>{
   timer=null;armedKind=null;
   if(closed||!dirty||!canPublish(dirty))return;
   const sending=dirty;dirty=null;
   pending=Promise.resolve().then(()=>publish(sending)).then(ok=>{
    // Even a failed optional write is paced; a later observation or the
    // mandatory phase-end checkpoint can deliver the current snapshot.
    lastWrite=now();return ok;
   },()=>{lastWrite=now();}).finally(()=>{pending=null;arm();});
  },Math.max(0,interval[kind]-(now()-lastWrite)));
 }
 return {
  queue(kind='routine'){
   if(closed||!priority[kind])return;
   if(!dirty||priority[kind]>priority[dirty])dirty=kind;
   arm();
  },
  async stop(){closed=true;clear();if(pending)await pending;}
 };
}
