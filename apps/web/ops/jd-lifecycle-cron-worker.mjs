/**
 * HHBA JD lifecycle Cron Worker.
 * Schedule: 0 2 * * * (02:00 UTC / 10:00 China / 11:00 Japan).
 * Deploy SEPARATELY as a Cloudflare Cron Worker; Pages does not run scheduled.
 *
 * Environment bindings:
 *   HHBA_JOB_JD_DB         existing public index/metrics D1 (read/write)
 *   HHBA_JOB_JD_R2         PRIVATE official JDs R2
 *   HHBA_PNVS_AUTH_DB      existing auth/history D1 (SELECT only)
 *
 * Plain-text config:
 *   HHBA_JD_MAINTENANCE_ENABLED=1
 *   HHBA_JD_RETENTION_DELETE_ENABLED=0  (default dry-run; no deletions)
 * No DeepSeek API key, no candidate resume access, no public HTTP endpoints.
 */
import {runJdLifecycleMaintenance,JD_MAINTENANCE_KIND}
 from '../functions/_lib/jd-lifecycle-maintenance.js';

const DAILY='0 2 * * *';
export default {
 async fetch(){
  return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 },
 async scheduled(event,env){
  if(event.cron!==DAILY||env?.HHBA_JD_MAINTENANCE_ENABLED!=='1'){
   console.log('HHBA_JD_MAINTENANCE_DISABLED');return;
  }
  try{
   const result=await runJdLifecycleMaintenance(env,{now:new Date(event.scheduledTime)});
   // Logs contain COUNTS ONLY, never candidate details or employer URLs.
   console.log(JD_MAINTENANCE_KIND,JSON.stringify({
    checked:result.checked,
    verified:result.statuses?.ACTIVE||0,
    to_recheck:result.statuses?.RECHECK||0,
    closed:result.statuses?.CLOSED||0,
    reopened:result.reopened||0,
    gc_dry_run:result.retention?.dry_run!==false,
    gc_eligible:result.retention?.eligible||0,
    gc_pinned:result.retention?.pinned||0,
    gc_deleted:result.retention?.purged||0,
    gc_blocked:result.retention?.blocked||0
   }));
  }catch{
   console.error('HHBA_JD_MAINTENANCE_FAILED'); // fail closed
  }
 }
};
