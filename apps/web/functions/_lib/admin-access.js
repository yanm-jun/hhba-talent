// Validate the cryptographically signed Cloudflare Access identity before reading any private metrics.
// A spoofed request header is NEVER enough to authenticate an administrator.
function decode(part){
 const url=part.replace(/-/g,'+').replace(/_/g,'/');
 return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(url.padEnd(Math.ceil(url.length/4)*4,'=')),x=>x.charCodeAt(0))));
}
export async function verifyAdmin(request,env){
 const team=(env.HHBA_ACCESS_TEAM_DOMAIN||'').trim().toLowerCase();
 const aud=(env.HHBA_ACCESS_AUD||'').trim();
 const email=(env.HHBA_METRICS_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(team)||!aud||!email)return {ok:false,code:'ADMIN_ACCESS_NOT_CONFIGURED',status:503};
 const jwt=request.headers.get('cf-access-jwt-assertion')||'';
 const parts=jwt.split('.');
 if(parts.length!==3||parts.some(s=>s.length>16000))return {ok:false,code:'ADMIN_ACCESS_REQUIRED',status:403};
 try{
  const header=decode(parts[0]),payload=decode(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||!header.kid||payload.iss!=='https://'+team
   ||!(Array.isArray(payload.aud)?payload.aud.includes(aud):payload.aud===aud)
   ||typeof payload.exp!=='number'||payload.exp<=now
   ||typeof payload.iat!=='number'||payload.iat>now+60
   ||typeof payload.nbf==='number'&&payload.nbf>now+60
   ||String(payload.email||'').toLowerCase()!==email)return {ok:false,code:'ADMIN_ACCESS_DENIED',status:403};
  const response=await fetch('https://'+team+'/cdn-cgi/access/certs',{headers:{Accept:'application/json'},cf:{cacheTtl:300,cacheEverything:true}});
  if(!response.ok)return {ok:false,code:'ADMIN_ACCESS_CERTS_UNAVAILABLE',status:503};
  const certs=await response.json(),jwk=(certs.keys||[]).find(x=>x.kid===header.kid&&x.kty==='RSA');
  if(!jwk)return {ok:false,code:'ADMIN_ACCESS_KEY_UNKNOWN',status:403};
  const key=await crypto.subtle.importKey('jwk',{kty:'RSA',e:jwk.e,n:jwk.n,alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const raw=parts[2].replace(/-/g,'+').replace(/_/g,'/'),signature=Uint8Array.from(atob(raw.padEnd(Math.ceil(raw.length/4)*4,'=')),x=>x.charCodeAt(0));
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,new TextEncoder().encode(parts[0]+'.'+parts[1]));
  return valid?{ok:true,email}:{ok:false,code:'ADMIN_ACCESS_SIGNATURE_INVALID',status:403};
 }catch{return {ok:false,code:'ADMIN_ACCESS_DENIED',status:403}}
}
