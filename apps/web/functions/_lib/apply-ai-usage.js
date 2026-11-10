// A D1-only quota and token ledger. Stores NO form labels, applicant values,
// model responses, provider raw errors, cookies or access tokens.
const hour=60*60*1000;
const MAX_PER_USER_HOUR=3;
const MAX_GLOBAL_UTC_DAY=100; // temporary hard cap pending production cost QA
const iso=d=>new Date(d).toISOString();
export function boundedAIUsage(usage){
 const num=(v,limit=10000000)=>Number.isSafeInteger(v)&&v>=0&&v<=limit?v:0;
 return {prompt:num(usage?.promptTokens),cached:num(usage?.cacheHitTokens),
  completion:num(usage?.completionTokens),costUpper:num(usage?.estimatedPeakMicroUsd,100000000)};
}
export async function reserveAIUsage(db,phone,id,now=Date.now()){
 const created=iso(now),cutoff=iso(now-hour),day=created.slice(0,10)+'T00:00:00.000Z';
 const sql="INSERT INTO hhba_apply_ai_requests(id,phone,created_at,status,model) "+
  "SELECT ?,?,?,'reserved','deepseek-flash' "+
  "WHERE (SELECT COUNT(*) FROM hhba_apply_ai_requests WHERE phone=? AND created_at>=?)<? "+
  "AND (SELECT COUNT(*) FROM hhba_apply_ai_requests WHERE created_at>=?)<?";
 const result=await db.prepare(sql).bind(id,phone,created,phone,cutoff,MAX_PER_USER_HOUR,day,MAX_GLOBAL_UTC_DAY).run();
 return result?.success===true&&result?.meta?.changes===1;
}
export async function recordAIUsage(db,phone,id,run,started=Date.now(),now=Date.now()){
 const usage=boundedAIUsage(run?.usage);
 const attempts=Number.isInteger(run?.attempts)?Math.max(0,Math.min(run.attempts,2)):0;
 const duration=Math.max(0,Math.min(60000,now-started));
 const status=run?.ok?'ok':'failed',error=run?.ok?null:String(run?.error||'AI_PROVIDER_UNAVAILABLE').slice(0,60);
 const sql="UPDATE hhba_apply_ai_requests SET status=?,attempts=?,prompt_tokens=?,cached_tokens=?,completion_tokens=?,"+
  "estimated_peak_microusd=?,duration_ms=?,error_code=?,completed_at=? "+
  "WHERE id=? AND phone=? AND status='reserved'";
 const result=await db.prepare(sql).bind(status,attempts,usage.prompt,usage.cached,usage.completion,
  usage.costUpper,duration,error,iso(now),id,phone).run();
 return result?.success===true&&result?.meta?.changes===1;
}
export async function AIUsageSummary(db,phone,now=Date.now()){
 const day=iso(now).slice(0,10)+'T00:00:00.000Z',hourAgo=iso(now-hour);
 const own=await db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(prompt_tokens),0) AS inputTokens,"+
  "COALESCE(SUM(cached_tokens),0) AS cacheHitTokens,COALESCE(SUM(completion_tokens),0) AS outputTokens,"+
  "COALESCE(SUM(estimated_peak_microusd),0) AS upperMicroUsd,"+
  "COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) AS completed "+
  "FROM hhba_apply_ai_requests WHERE phone=? AND created_at>=?").bind(phone,day).first();
 const hourly=await db.prepare('SELECT COUNT(*) AS n FROM hhba_apply_ai_requests WHERE phone=? AND created_at>=?')
  .bind(phone,hourAgo).first();
 return {todayCalls:Number(own?.total||0),todaySuccess:Number(own?.completed||0),
  todayPromptTokens:Number(own?.inputTokens||0),todayCachedTokens:Number(own?.cacheHitTokens||0),
  todayCompletionTokens:Number(own?.outputTokens||0),
  estimatedPeakCostUpperMicroUsd:Number(own?.upperMicroUsd||0),
  remainingThisHour:Math.max(0,MAX_PER_USER_HOUR-Number(hourly?.n||0))};
}
