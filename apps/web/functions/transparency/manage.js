// Legacy duplicate finance UI is retired. The only private management UI now
// lives under the original password-authenticated admin.hhba.work console.
export async function onRequest({request}){
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{'Cache-Control':'no-store'}});
 return new Response(null,{status:302,headers:{Location:'https://admin.hhba.work/admin-preview/','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
