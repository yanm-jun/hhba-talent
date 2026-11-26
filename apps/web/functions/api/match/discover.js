// Retired independent search route: V4 owns live job discovery.
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
export function onRequest({request}){
 if(request.method==='GET')return new Response(JSON.stringify({kind:'HHBA_DOMESTIC_DISCOVERY_V1',enabled:false,mode:'RETIRED',scope:'CN_MAINLAND_ONLY'}),{status:200,headers});
 return new Response(JSON.stringify({ok:false,error:'MATCH_BACKEND_RETIRED',message:'旧版站外搜索已停止，请使用 V4。'}),{status:410,headers});
}
