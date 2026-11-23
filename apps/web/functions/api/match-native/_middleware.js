/**
 * Hard retirement of HHBA's old CV-matching engine.
 *
 * Cloudflare Pages Functions middleware is evaluated on live requests before
 * the old [[path]] handler, regardless of whether build-time CF_PAGES_BRANCH
 * was supplied to the runtime. Never execute legacy DeepSeek Search/Agent.
 *
 * This does NOT touch account, resume, history or JD archive data.
 */
export async function onRequest({request}){
 const url=new URL(request.url);
 const tail=url.pathname.slice('/api/match-native'.length).replace(/\/$/,'')||'/';
 const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
 };
 if(request.method==='GET'&&tail==='/status'){
  return new Response(JSON.stringify({
   kind:'HHBA_NATIVE_WEB_MATCH_V1',
   enabled:false,mode:'RETIRED_REBUILD_IN_PROGRESS',
   formats:['pdf','docx'],scope:'CN_MAINLAND_ONLY'
  }),{status:200,headers});
 }
 return new Response(JSON.stringify({
  ok:false,error:'MATCH_BACKEND_RETIRED',
  message:'HHBA 岗位匹配后台正在重新开发，旧服务已停止。'
 }),{status:410,headers});
}
