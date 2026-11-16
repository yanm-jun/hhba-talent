/** Fail-closed membership API guard.
 * No paid membership product, recurring charge or case-evidence ingestion exists yet.
 * This catch-all does not read, store or forward request bodies or sensitive information.
 * Any future commerce endpoint MUST replace this with reviewed server-side checks.
 */
export async function onRequest(){
 return new Response(JSON.stringify({
  ok:false,
  code:'HHBA_MEMBERSHIP_NOT_OPEN',
  message:'会员收费、自动续费和案件材料上传暂未开放；请先阅读完整服务规则。'
 }),{
  status:503,
  headers:{
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store, private',
   'X-Content-Type-Options':'nosniff',
  }
 });
}
