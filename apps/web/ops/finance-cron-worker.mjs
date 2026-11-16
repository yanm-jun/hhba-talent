// HHBA finance scheduler (Cloudflare Worker Cron Trigger, UTC).
// Production-only; never contains keys, report amounts, or subscriber data.
// Financial disclosure and sending both fail closed in hhba.work Pages Functions.
const TARGET='https://hhba.work/api/transparency/dispatch';
const CRON='*/5 2-15 21 * *';
export default {
 async fetch(){
  return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 },
 async scheduled(controller,env){
  const date=new Date(controller.scheduledTime);
  if(controller.cron!==CRON||date.getUTCDate()!==21||date.getUTCHours()<2||date.getUTCHours()>15){
   console.log('HHBA_FIN_CRON_SKIPPED_OUTSIDE_WINDOW');return;
  }
  const secret=String(env.HHBA_FIN_DISPATCH_SECRET||'');
  if(secret.length<40){console.error('HHBA_FIN_CRON_MISSING_SECRET');return;}
  try{
   const response=await fetch(TARGET,{
    method:'POST',
    headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
    body:'{}'
   });
   // The finance API itself enforces sendEnabled, publication window,
   // published-report-only, double opt-in, 30 item batches and idempotency.
   if(response.status===503){console.log('HHBA_FIN_CRON_DISABLED_OR_UNAVAILABLE');return;}
   if(!response.ok){console.error('HHBA_FIN_CRON_HTTP_FAILURE',response.status);return;}
   let result=null;
   try{result=await response.json();}catch{}
   console.log('HHBA_FIN_CRON_DISPATCH',String(result?.code||'UNKNOWN').slice(0,70),{
    attempted:Number(result?.attempted||0),
    sent:Number(result?.sent||0),
    failed:Number(result?.failed||0)
   });
  }catch{console.error('HHBA_FIN_CRON_NETWORK_ERROR');}
 }
};
