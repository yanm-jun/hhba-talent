// Dedicated Cloudflare Worker: scheduled ciphertext janitor for the
// encrypted one-time Edge resume handoffs. DO NOT attach this schedule to the
// Pages Function itself: Pages Functions do not run Cron Triggers.
// Bind only the intended D1 and explicitly opt in after isolated approval.
import {purgeExpiredProfileTransfers} from '../functions/_lib/apply-profile-sync.js';
export default {
 async scheduled(event,env){
  if(env?.HHBA_APPLY_CLEANUP_ENABLED!=='1'||!env?.HHBA_PNVS_AUTH_DB)return;
  // Deliberately omit any personal identifier or decrypted content from logs.
  // D1 SQL removes rows whose five-minute claim window has elapsed, plus
  // any already claimed rows, without requiring an AI or payment secret.
  await purgeExpiredProfileTransfers(env.HHBA_PNVS_AUTH_DB,event?.scheduledTime||Date.now());
 }
};
