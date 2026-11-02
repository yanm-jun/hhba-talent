export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const bad=(code,status=503)=>json({ok:false,error:code},status);
export const isoDay=(date=new Date())=>date.toISOString().slice(0,10);
export const sameOrigin=request=>{
 const origin=request.headers.get('origin');
 return !!origin&&origin===new URL(request.url).origin&&request.headers.get('sec-fetch-site')!=='cross-site';
};
export function parseCookie(request,name){
 const item=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
 return item?item.slice(name.length+1):'';
}
export const hex=bytes=>Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
export const randomHex=(n=24)=>hex(crypto.getRandomValues(new Uint8Array(n)));
export async function hmac(secret,value){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}
export const cookie=(name,value)=>name+'='+value+'; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax';
export const metricDb=env=>env.HHBA_METRICS_DB&&typeof env.HHBA_METRICS_SECRET==='string'&&env.HHBA_METRICS_SECRET.length>=32?env.HHBA_METRICS_DB:null;
export async function assetJson(env,request,path){
 if(!env.ASSETS)throw Error('STATIC_ASSETS_MISSING');
 const res=await env.ASSETS.fetch(new Request(new URL(path,request.url),{headers:{Accept:'application/json'}}));
 if(!res.ok||!(res.headers.get('content-type')||'').includes('json'))throw Error('STATIC_METRIC_SOURCE_UNAVAILABLE');
 return res.json();
}
