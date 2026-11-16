// Legacy private finance UI retired. HHBA has ONE finance management console.
// Keep the public responsibility /transparency page and API untouched.
export function onRequest({request}){
 if(request.method!=='GET'&&request.method!=='HEAD')
  return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 return new Response(null,{status:307,headers:{
  Location:'https://admin.hhba.work/admin-preview/',
  'Cache-Control':'no-store, max-age=0',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff'
 }});
}
