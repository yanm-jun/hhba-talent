// HHBA private finance analysis scheduler. Does not post accounting entries.
// No external GET route. Token bound only as encrypted Worker secret.
// Daily at UTC 02:00 = Beijing 10:00.
const TARGET='https://admin.hhba.work/admin-preview/api/finance-ai-cron';
const EXPECTED='0 2 * * *';
export default {
 async fetch(){return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});},
 async scheduled(event,env){
  const now=new Date(event.scheduledTime);
  if(event.cron!==EXPECTED||now.getUTCHours()!==2||now.getUTCMinutes()!==0)return;
  const secret=String(env.HHBA_FIN_AI_CRON_SECRET||'');
  if(secret.length<64){console.error('HHBA_FIN_AI_CRON_SECRET_NOT_CONFIGURED');return;}
  try{
   const response=await fetch(TARGET,{
    method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
    body:'{}'
   });
   console.log('HHBA_FIN_AI_DAILY_REVIEW',response.ok?'accepted':'not_accepted',response.status);
  }catch{console.error('HHBA_FIN_AI_CRON_TRANSPORT_ERROR');}
 }
};
