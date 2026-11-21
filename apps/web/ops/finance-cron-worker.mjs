// HHBA retired the finance campaign. Keep the deployed worker inert until
// the infrastructure schedule itself can be removed; never call Pages API.
export default {
 async fetch(){
  return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 },
 async scheduled(){
  console.log('HHBA_FIN_CRON_RETIRED_NO_ACTION');
 }
};
