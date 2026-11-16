// Retired duplicate finance management endpoint. Admin functions are now handled
// by admin.hhba.work under the original password session and finance D1 binding.
// Public reporting, subscriptions, unsubscribe and dispatch remain on hhba.work.
export async function onRequest(){
 return new Response(JSON.stringify({ok:false,code:'FINANCE_MANAGEMENT_MOVED',adminUrl:'https://admin.hhba.work/admin-preview/'}),{
  status:410,
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 });
}
