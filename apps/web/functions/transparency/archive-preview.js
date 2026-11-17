// Dedicated response policy for the fictional public-archive demonstration.
// Google and other crawlers must be allowed to fetch the page to see noindex.
// This is discovery control, not authentication or access control.
export async function onRequest({next}){
 const response=await next();
 const headers=new Headers(response.headers);
 headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 headers.set('Cache-Control','no-store, max-age=0');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
