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
  path==='/admin-login.css'||path==='/admin-login.js'||path==='/favicon.svg';
 if(open||path.startsWith('/api/console-auth/'))return next();
 if(path==='/')return Response.redirect('https://'+ADMIN_HOST+'/admin-preview/',302);
 if(path.startsWith('/admin-preview/api/'))return next(); // functions enforce verifyAdmin independently
 if(path==='/admin-preview'||path.startsWith('/admin-preview/')){
  const session=await verifyPasswordAdmin(request,env);
  if(!session.ok){
   if(session.status===503)return authError('ADMIN_SESSION_STORE_UNAVAILABLE',503);
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
