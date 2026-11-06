// Trusted server-side credit settlement primitives (not exposed by public API).
// Each reservation is a single SQLite INSERT...SELECT, with an available-credit
// predicate evaluated inside the write. Concurrent requests cannot both spend
// a final remaining use. Replaying a task ID does not double reserve.
const taskPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const reserveSql=
 "INSERT OR IGNORE INTO hhba_apply_tasks(id,phone,status,created_at) "+
 "SELECT ?,?,'reserved',? WHERE "+
 "(SELECT COALESCE(SUM(package_uses),0) FROM hhba_apply_orders WHERE phone=? AND status='paid')>"+
 "(SELECT COUNT(*) FROM hhba_apply_tasks WHERE phone=? AND status IN ('reserved','completed'))";
const settleSql=
 "UPDATE hhba_apply_tasks SET status=?,finished_at=? WHERE id=? AND phone=? AND status='reserved'";
export async function reserveCredit(db,phone,taskId,now=new Date().toISOString()){
 if(!taskPattern.test(taskId)||typeof phone!=='string'||!/^1[3-9]\d{9}$/.test(phone))
  return {ok:false,error:'INVALID_TASK_REQUEST'};
 const result=await db.prepare(reserveSql).bind(taskId,phone,now,phone,phone).run();
 if(result?.success&&result?.meta?.changes===1)return {ok:true,status:'reserved',created:true};
 const row=await db.prepare('SELECT phone,status FROM hhba_apply_tasks WHERE id=?').bind(taskId).first();
 if(row?.phone===phone)return {ok:true,status:row.status,created:false};
 if(row)return {ok:false,error:'TASK_NOT_FOUND'};
 return {ok:false,error:'INSUFFICIENT_USES'};
}
export async function settleCredit(db,phone,taskId,outcome,now=new Date().toISOString()){
 if(!taskPattern.test(taskId)||!['completed','released'].includes(outcome))
  return {ok:false,error:'INVALID_TASK_REQUEST'};
 const result=await db.prepare(settleSql).bind(outcome,now,taskId,phone).run();
 if(result?.success&&result?.meta?.changes===1)return {ok:true,status:outcome,changed:true};
 const row=await db.prepare('SELECT status FROM hhba_apply_tasks WHERE id=? AND phone=?').bind(taskId,phone).first();
 if(!row)return {ok:false,error:'TASK_NOT_FOUND'};
 return {ok:row.status===outcome,status:row.status,changed:false,
  ...(row.status!==outcome?{error:'TASK_ALREADY_SETTLED'}:{})};
}
