// Retired pre-V4 matching route: no model calls or access to credentials or data.
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
export function onRequest({request}){
 const tail=new URL(request.url).pathname.slice('/api/match'.length).replace(/\/$/,'');
 if(request.method==='GET'&&tail==='/status')return new Response(JSON.stringify({kind:"HHBA_RESUME_MATCH_CLOUDFLARE_V1",enabled:false,mode:'RETIRED',scope:'CN_MAINLAND_ONLY',formats:['pdf','docx']}),{status:200,headers});
 return new Response(JSON.stringify({ok:false,error:'MATCH_BACKEND_RETIRED',message:'旧版智能匹配已停止，请使用 V4。'}),{status:410,headers});
}
