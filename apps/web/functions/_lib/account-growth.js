// Private aggregate report: registered counts and opt-in account activity remain separate.
const n=v=>Number(v||0);
export const rate=(returned,eligible)=>eligible>0?Math.round(returned/eligible*10000)/100:null;
const dateDays=(utcDay,offset)=>new Date(Date.parse(utcDay+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
export async function queryAccountGrowth({metricsDb,authDb,since,until,today,series}){
 let accounts={quality:'not_connected',registeredUsers:null,newRegistered:null,signupSeries:null,
  savedJobs:null,accountsWithSavedJobs:null,dau:null,wau:null,mau:null,
  scope:'VERIFIED_PNVS_CANDIDATES_ONLY',reason:'真实账号库尚未连接'};
 if(authDb){
  try{
   const [total,signups]=await Promise.all([
    authDb.prepare("SELECT COUNT(*) AS n FROM hhba_auth_users WHERE role='candidate'").first(),
    authDb.prepare("SELECT substr(created_at,1,10) AS day,COUNT(*) AS n FROM hhba_auth_users WHERE role='candidate' AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=? GROUP BY day ORDER BY day").bind(since,until).all()
   ]);
   const map=new Map((signups.results||[]).map(row=>[row.day,n(row.n)]));
   const signupSeries=series.map(row=>({day:row.day,count:map.get(row.day)||0}));
   accounts={quality:'collected',registeredUsers:n(total?.n),newRegistered:signupSeries.reduce((sum,row)=>sum+row.count,0),
    signupSeries,savedJobs:null,accountsWithSavedJobs:null,dau:null,wau:null,mau:null,
    scope:'VERIFIED_PNVS_CANDIDATES_ONLY',reason:'仅实际注册候选人，排除匿名设备和模拟账号'};
   try{
    const saves=await authDb.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT phone) AS users FROM hhba_candidate_saved_jobs').first();
    accounts.savedJobs=n(saves?.n);
    accounts.accountsWithSavedJobs=n(saves?.users);
   }catch(e){console.warn('HHBA_REAL_ACCOUNT_SAVES_NOT_READY',e?.name||'error')}
  }catch(e){console.warn('HHBA_REAL_USER_REGISTRATION_NOT_READY',e?.name||'error')}
 }
 let activity={quality:'not_connected',dau:null,wau:null,mau:null,periodActive:null,
  areaUsers:null,series:null,firstSeenRetention:null,collectedFrom:null,
  scope:'CONSENTED_VERIFIED_ACCOUNTS_ONLY',reason:'账号行为 D1 迁移尚未应用或数据连接不可用'};
 try{
  const [daily,areas,summary,started,retained]=await Promise.all([
   metricsDb.prepare('SELECT day,COUNT(DISTINCT account_hash) AS n FROM hhba_account_activity WHERE day>=? AND day<=? GROUP BY day ORDER BY day').bind(since,until).all(),
   metricsDb.prepare('SELECT area,COUNT(DISTINCT account_hash) AS n FROM hhba_account_activity WHERE day>=? AND day<=? GROUP BY area').bind(since,until).all(),
   metricsDb.prepare('SELECT COUNT(DISTINCT CASE WHEN day=? THEN account_hash END) AS dau,COUNT(DISTINCT CASE WHEN day>=? AND day<=? THEN account_hash END) AS wau,COUNT(DISTINCT CASE WHEN day>=? AND day<=? THEN account_hash END) AS mau,COUNT(DISTINCT CASE WHEN day>=? AND day<=? THEN account_hash END) AS period_active FROM hhba_account_activity')
    .bind(today,dateDays(today,-6),today,dateDays(today,-29),today,since,until).first(),
   metricsDb.prepare("SELECT value FROM hhba_metrics_metadata WHERE key='account_activity_installed_at'").first(),
   metricsDb.prepare(
    "WITH first_seen AS (SELECT account_hash,MIN(day) AS first_day FROM hhba_account_activity GROUP BY account_hash) "+
    "SELECT SUM(CASE WHEN first_day<=date(?,'-1 day') THEN 1 ELSE 0 END) AS d1_eligible,"+
    "SUM(CASE WHEN first_day<=date(?,'-1 day') AND EXISTS (SELECT 1 FROM hhba_account_activity x WHERE x.account_hash=f.account_hash AND x.day=date(f.first_day,'+1 day')) THEN 1 ELSE 0 END) AS d1_returned,"+
    "SUM(CASE WHEN first_day<=date(?,'-7 day') THEN 1 ELSE 0 END) AS d7_eligible,"+
    "SUM(CASE WHEN first_day<=date(?,'-7 day') AND EXISTS (SELECT 1 FROM hhba_account_activity x WHERE x.account_hash=f.account_hash AND x.day=date(f.first_day,'+7 day')) THEN 1 ELSE 0 END) AS d7_returned "+
    "FROM first_seen f WHERE first_day>=? AND first_day<=?"
   ).bind(until,until,until,until,since,until).first()
  ]);
  // When the migration is not installed, do not report an empty chart as verified zero.
  if(!started?.value)throw Error('ACCOUNT_COLLECTOR_METADATA_MISSING');
  const map=new Map((daily.results||[]).map(row=>[row.day,n(row.n)]));
  const d1=n(retained?.d1_eligible),d7=n(retained?.d7_eligible);
  const d1Back=n(retained?.d1_returned),d7Back=n(retained?.d7_returned);
  activity={quality:'collected',dau:n(summary?.dau),wau:n(summary?.wau),mau:n(summary?.mau),
   periodActive:n(summary?.period_active),
   areaUsers:Object.fromEntries((areas.results||[]).map(row=>[row.area,n(row.n)])),
   series:series.map(row=>({day:row.day,active:map.get(row.day)||0})),
   firstSeenRetention:{d1:{eligible:d1,returned:d1Back,rate:rate(d1Back,d1)},
    d7:{eligible:d7,returned:d7Back,rate:rate(d7Back,d7)},
    definition:'首个经同意的账号活跃日作为分组起点；仅计算成熟分组。并非注册次日或注册七日留存。'},
   collectedFrom:started.value,scope:'CONSENTED_VERIFIED_ACCOUNTS_ONLY',
   reason:'按登录账号稳定匿名映射与 UTC 日期去重，未同意统计的用户不在活跃分母内'};
 }catch(e){console.warn('HHBA_ACCOUNT_ACTIVITY_NOT_READY',e?.name||'error')}
 if(accounts.quality==='collected'&&activity.quality==='collected'){
  accounts.dau=activity.dau;accounts.wau=activity.wau;accounts.mau=activity.mau;
 }
 return {accounts,activity};
}
