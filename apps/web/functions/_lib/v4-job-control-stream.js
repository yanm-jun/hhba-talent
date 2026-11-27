// Control-only heartbeat stream for long-running, revision-fenced JD jobs.
// No resume, JD, model response, URL or prompt is ever sent to the Workflow.
// Cloudflare's proxy may return 524 if background-job-step waits silently
// for a slow provider before writing its first response byte.
const safeError=value=>typeof value==='string'&&/^AI_[A-Z0-9_]{4,90}$/.test(value)?value:'AI_BACKGROUND_EXECUTION_FAILED';
export function streamV4JobControl(execute,{heartbeatMs=12000}={}){
 const encoder=new TextEncoder();
 let cancelled=false,interval;
 const stream=new ReadableStream({
  start(controller){
   const emit=(kind,payload)=>{
    if(cancelled)return;
    try{controller.enqueue(encoder.encode('event: '+kind+'\ndata: '+JSON.stringify(payload)+'\n\n'));}
    catch{cancelled=true;}
   };
   // Send headers and the first body bytes BEFORE starting any paid model
   // call. Later frames keep the Cloudflare-to-Workflow connection alive.
   emit('heartbeat',{status:'running'});
   interval=setInterval(()=>emit('heartbeat',{status:'running'}),Math.max(1000,heartbeatMs));
   void Promise.resolve().then(execute).then(result=>{
    if(result?.ok)emit('complete',result.body);
    else emit('failure',{error:safeError(result?.error)});
   },()=>emit('failure',{error:'AI_BACKGROUND_EXECUTION_FAILED'})).finally(()=>{
    clearInterval(interval);
    if(!cancelled)try{controller.close();}catch{}
   });
  },
  cancel(){cancelled=true;if(interval)clearInterval(interval);}
 });
 return new Response(stream,{status:200,headers:{
  'Content-Type':'text/event-stream; charset=utf-8',
  'Cache-Control':'private, no-store, no-transform',
  'X-Content-Type-Options':'nosniff',
  'X-Accel-Buffering':'no'
 }});
}
