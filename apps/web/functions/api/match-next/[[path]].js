// Permanently retired Clean Match V2. Keep a stable tombstone for old clients.
// No model, credential, database, or user-data access on any route.
export function onRequest({request}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 const tail=new URL(request.url).pathname.slice('/api/match-next'.length).replace(/\/$/,'')||'/';
 if(request.method==='GET'&&tail==='/status')return new Response(JSON.stringify({kind:'HHBA_NATIVE_WEB_MATCH_V1',engine:'HHBA_MATCH_CLEAN_V2',enabled:false,mode:'RETIRED',preflight_available:false,formats:['pdf','docx'],scope:'CN_MAINLAND_ONLY'}),{status:200,headers});
 return new Response(JSON.stringify({ok:false,error:'MATCH_BACKEND_RETIRED',message:'旧版岗位匹配已停止服务，请使用 HHBA V4。'}),{status:410,headers});
}
