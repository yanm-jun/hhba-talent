// Deploy as a dedicated preview Worker with a cron trigger. No CV, provider
// key, or user credentials cross this scheduler, only a scoped internal secret.
export default {async scheduled(_event,env,ctx){
 ctx.waitUntil((async()=>{
  if(!env.HHBA_BACKGROUND_TARGET||!env.HHBA_V4_BACKGROUND_SECRET)return;
  const response=await fetch(env.HHBA_BACKGROUND_TARGET,{method:'POST',headers:{'X-HHBA-Background-Secret':env.HHBA_V4_BACKGROUND_SECRET},redirect:'error'});
  console.info('HHBA_V4_BACKGROUND_TICK',JSON.stringify({status:response.status}));
  if(!response.ok)throw Error('BACKGROUND_TICK_UNAVAILABLE');
 })());
},fetch(){return new Response('Not found',{status:404});}};
