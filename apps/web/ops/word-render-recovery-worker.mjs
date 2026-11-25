// Private scheduled recovery for Word PDF conversions.
// Deploy independently from Pages; no public application endpoint.
// Bind HHBA_PNVS_AUTH_DB, HHBA_PRIVATE_RESUMES and the existing renderer secrets.
// Schedule every minute; only abandoned leases older than five minutes are reclaimed.
import {recoverInterruptedWordRenders} from '../functions/api/resume-word.js';
export default {
 async fetch(){return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});},
 async scheduled(event,env){
  if(env.HHBA_WORD_RENDER_RECOVERY_ENABLED!=='1')return;
  try{
   const report=await recoverInterruptedWordRenders(env,{limit:4});
   console.log('HHBA_WORD_RENDER_RECOVERY',JSON.stringify(report));
  }catch{console.error('HHBA_WORD_RENDER_RECOVERY_FAILED');}
 }
};
