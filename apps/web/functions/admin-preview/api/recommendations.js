// Cloudflare Access protected, aggregate-only recommendation diagnostics.
import {verifyAdmin} from '../../../_lib/admin-access.js';
import {bad,json} from '../../../_lib/metric-utils.js';
import {RECOMMENDATION_VERSION} from '../../../_lib/recommendation-collab.js';
export async function onRequestGet({request,env}){
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return bad(actor.code,actor.status);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!db)return bad('AUTH_DATABASE_NOT_CONNECTED');
 try{
  const [consents,saves,participants]=await Promise.all([
   db.prepare('SELECT COUNT(*) AS n FROM hhba_recommendation_consents WHERE enabled=1').first(),
   db.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_saved_jobs').first(),
   db.prepare('SELECT COUNT(DISTINCT s.phone) AS n FROM hhba_candidate_saved_jobs s JOIN hhba_recommendation_consents c ON c.phone=s.phone AND c.enabled=1').first()
  ]);
  return json({kind:'HHBA_RECOMMENDATION_ADMIN_V1',asOf:new Date().toISOString(),
   version:RECOMMENDATION_VERSION,collection:'EXPLICIT_CONSENT_ONLY',
   optedInAccounts:Number(consents?.n||0),optedInAccountsWithSaves:Number(participants?.n||0),
   existingAccountSaves:Number(saves?.n||0),
   collaborativeReady:Number(participants?.n||0)>=4,
   impressions:null,opens:null,saveRate:null,applyRate:null,
   note:'上线时按已迁移的真实数据读取。未接入曝光事件、点击事件与投递归因，不能估算点击率或录用率。'});
 }catch(e){console.error('HHBA_RECOMMENDATION_ADMIN_READ_FAILED',e?.name||'error');return bad('RECOMMENDATION_MIGRATION_NOT_READY')}
}
