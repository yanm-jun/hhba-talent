import {ADMIN_HOST,verifyPasswordAdmin,authError,noStore} from './_lib/console-password.js';

// This middleware is inert on the existing HHBA public Pages project.
// Only the separate hhba-admin-console project sets HHBA_ADMIN_CONSOLE_ENABLED.
export async function onRequest(context){
 const {request,env,next}=context;
 if(env.HHBA_ADMIN_CONSOLE_ENABLED!=='1')return next();
 const u=new URL(request.url);
 // Do not host the password console on the default *.pages.dev hostname.
 if(u.hostname!==ADMIN_HOST){
  return new Response(null,{status:307,headers:{Location:'https://'+ADMIN_HOST+u.pathname+u.search,...noStore}});
 }
 const path=u.pathname;
 const open=path==='/login/'||path==='/login/index.html'||
  path==='/setup/'||path==='/setup/index.html'||
  path==='/admin-login.css'||path==='/admin-login-brand-v2.css'||
  path==='/admin-login.js'||path==='/favicon.svg';
 if(open){
  // Public login assets must be revalidated so a changed SVG does not load
  // with an obsolete login stylesheet from the browser cache.
  const response=await next();
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','no-store, max-age=0, must-revalidate');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
 if(path.startsWith('/api/console-auth/'))return next();
 if(path==='/')return Response.redirect('https://'+ADMIN_HOST+'/admin-preview/',302);
 const api=path.startsWith('/admin-preview/api/');
 if(path==='/admin-preview'||path.startsWith('/admin-preview/')){
  const session=await verifyPasswordAdmin(request,env);
  if(!session.ok){
   if(session.status===503){
    if(api)return authError('ADMIN_SESSION_STORE_UNAVAILABLE',503);
    // Never expose a raw JSON error as the whole management page.
    return new Response(
     '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
     '<meta name="robots" content="noindex,nofollow"><title>管理后台暂时不可用 · 汇方职场 HHBA</title>'+
     '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f8ff;color:#183656;font-family:system-ui,Arial,sans-serif">'+
     '<main style="max-width:420px;margin:20px;padding:32px;border:1px solid #dbe6f6;border-radius:16px;background:#fff">'+
     '<h1 style="font-size:22px">管理员验证暂时不可用</h1>'+
     '<p style="line-height:1.9;color:#647891">后台登录服务暂时无法确认会话。你的企业资料不会因此丢失。请刷新页面或重新登录。</p>'+
     '<p><a href="/login/" style="color:#176bdc">返回管理员登录页</a></p></main></body></html>',
     {status:503,headers:{...noStore,'Content-Type':'text/html; charset=utf-8'}}
    );
   }
   if(api)return authError('ADMIN_PASSWORD_LOGIN_REQUIRED',401);
   return new Response(null,{status:303,headers:{Location:'/login/',...noStore}});
  }
  const response=await next();
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, no-store, no-cache, must-revalidate');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('X-Frame-Options','DENY');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
 return new Response('Not Found',{status:404,headers:{...noStore,'Content-Type':'text/plain; charset=utf-8'}});
}
