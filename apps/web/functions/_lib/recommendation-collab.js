// Item-to-item co-save collaborative signal. Never expose peer identities.
export const RECOMMENDATION_VERSION='HHBA_HOME_HYBRID_V1';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(id);
export async function optInStatus(db,phone){
 const row=await db.prepare('SELECT enabled FROM hhba_recommendation_consents WHERE phone=?').bind(phone).first();
 return row?.enabled===1;
}
export async function coSavedJobs(db,phone){
 const enabled=await optInStatus(db,phone);
 if(!enabled)return {mode:'CONTENT_ONLY',jobs:[]};
 const mine=await db.prepare('SELECT job_id FROM hhba_candidate_saved_jobs WHERE phone=? ORDER BY saved_at DESC LIMIT 25')
  .bind(phone).all();
 const ids=(mine.results||[]).map(row=>row.job_id).filter(validId);
 if(!ids.length)return {mode:'CONTENT_ONLY',jobs:[]};
 const marks=ids.map(()=>'?').join(',');
 // Only peers who explicitly opted into collaborative use of their bookmarks.
 // Minimum 3 distinct peers protects against inference from an individual.
 const query=`SELECT other.job_id AS jobId,COUNT(DISTINCT peer.phone) AS supporters
 FROM hhba_candidate_saved_jobs peer
 JOIN hhba_recommendation_consents consent ON consent.phone=peer.phone AND consent.enabled=1
 JOIN hhba_candidate_saved_jobs other ON other.phone=peer.phone
 WHERE peer.job_id IN (${marks}) AND peer.phone<>? AND other.job_id NOT IN (${marks})
 GROUP BY other.job_id HAVING COUNT(DISTINCT peer.phone)>=3
 ORDER BY supporters DESC, other.job_id ASC LIMIT 30`;
 const results=await db.prepare(query).bind(...ids,phone,...ids).all();
 return {mode:(results.results||[]).length?'COLLABORATIVE_READY':'CONTENT_ONLY',jobs:(results.results||[])
   .filter(row=>validId(row.jobId)&&Number.isSafeInteger(row.supporters)&&row.supporters>=3)
   .map(row=>({id:row.jobId,score:Math.min(10,Number(row.supporters))}))};
}
