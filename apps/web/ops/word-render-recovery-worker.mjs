// Private scheduled trigger. Only Pages has access to the actual renderer
// secrets, candidate data and private R2. This Worker holds a recovery-only token.
export default {
 async fetch(){return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});},
 async scheduled(event,env){
  if(env.HHBA_WORD_RENDER_RECOVERY_ENABLED!=='1')return;
  const token=env.HHBA_WORD_RECOVERY_TOKEN;
  if(typeof token!=='string'||!(/^[a-f0-9]{64}$/).test(token)){
   console.error('HHBA_WORD_RENDER_RECOVERY_NOT_CONFIGURED');return;
  }
  try{
   const response=await fetch('https://hhba.work/api/resume-word?action=recover-interrupted',{
    method:'POST',headers:{Authorization:'Bearer '+token},redirect:'manual'
   });
   if(!response.ok)throw Error('RECOVERY_HTTP_FAILED');
   const result=await response.json();
   if(result.ok!==true)throw Error('RECOVERY_RESPONSE_FAILED');
   console.log('HHBA_WORD_RENDER_RECOVERY',JSON.stringify({
    checked:Number(result.checked)||0,reclaimed:Number(result.reclaimed)||0,
    skipped:Number(result.skipped)||0,errors:Number(result.errors)||0
   }));
  }catch{console.error('HHBA_WORD_RENDER_RECOVERY_FAILED');}
 }
};
