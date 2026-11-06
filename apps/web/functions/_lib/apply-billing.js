// Merchant credentials belong to Cloudflare Secrets, never Pages assets or extension.
export const APPLY_PACKAGES=Object.freeze([10,20,50,100]);
export const APPLY_UNIT_FEN=30;
export const packagePriceFen=uses=>APPLY_PACKAGES.includes(uses)?uses*APPLY_UNIT_FEN:null;
export function alipayCredentialsConfigured(env){
 return   ['ALIPAY_APP_ID','ALIPAY_SELLER_ID','ALIPAY_PRIVATE_KEY_PKCS8','ALIPAY_PUBLIC_KEY','HHBA_ALIPAY_NOTIFY_URL']
   .every(key=>typeof env[key]==='string'&&env[key].trim().length>0)&&
  env.HHBA_ALIPAY_NOTIFY_URL==='https://hhba.work/api/apply/alipay/notify';
}
export const alipayConfigured=env=>env?.HHBA_APPLY_PAYMENTS_ENABLED==='1'&&alipayCredentialsConfigured(env);
// The task engine remains disabled until an authenticated plugin handshake and
// trusted settlement endpoint pass their own security acceptance tests.
export const tasksConfigured=()=>false;

function pemBytes(value){
 const encoded=String(value||'').replace(/-----BEGIN [^-]+-----/g,'').replace(/-----END [^-]+-----/g,'').replace(/\s+/g,'');
 if(!/^[A-Za-z0-9+/=]+$/.test(encoded)||encoded.length<200)throw Error('INVALID_PAYMENT_KEY');
 return Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));
}
function base64(data){return btoa(String.fromCharCode(...new Uint8Array(data)))}
export const canonical=params=>Object.entries(params).filter(([k,v])=>k!=='sign'&&k!=='sign_type'&&v!==null&&v!==undefined&&v!=='').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+String(v)).join('&');
async function privateKey(pem){
 return crypto.subtle.importKey('pkcs8',pemBytes(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
}
async function publicKey(pem){
 return crypto.subtle.importKey('spki',pemBytes(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
}
export async function rsaSign(params,pem){
 const key=await privateKey(pem);
 return base64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(canonical(params))));
}
export async function verifyAlipayNotification(rawParams,pem){
 const params=Object.fromEntries(rawParams);
 if(params.sign_type!=='RSA2'||typeof params.sign!=='string'||params.sign.length<100)return false;
 // For async notifications, Alipay signs all non-empty parameters except sign and sign_type.
 try{
  const key=await publicKey(pem);
  const signature=Uint8Array.from(atob(params.sign.replace(/ /g,'+')),x=>x.charCodeAt(0));
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,new TextEncoder().encode(canonical(params)));
 }catch{return false}
}
// Extract the exact JSON object bytes signed by Alipay. JSON.stringify(parsed)
// changes spacing/escaping and would invalidate a valid gateway signature.
export function signedResponseBody(raw,key){
 const label='"'+key+'"',at=raw.indexOf(label);
 if(at<0)return null;
 let i=at+label.length;
 while(/\s/.test(raw[i]||''))i++;
 if(raw[i++]!==':')return null;
 while(/\s/.test(raw[i]||''))i++;
 if(raw[i]!=='{')return null;
 const start=i;
 let depth=0,inString=false,escaped=false;
 for(;i<raw.length;i++){
  const ch=raw[i];
  if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue}
  if(ch==='"'){inString=true;continue}
  if(ch==='{')depth++;
  if(ch==='}'&&--depth===0)return raw.slice(start,i+1);
 }
 return null;
}
export async function verifyGatewayResponse(raw,method,pem){
 try{
  const parsed=JSON.parse(raw),key=method.replace(/\./g,'_')+'_response';
  const body=signedResponseBody(raw,key);
  if(!body||typeof parsed.sign!=='string')return null;
  const pub=await publicKey(pem);
  const bytes=Uint8Array.from(atob(parsed.sign.replace(/ /g,'+')),x=>x.charCodeAt(0));
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,bytes,new TextEncoder().encode(body));
  return ok?parsed[key]:null;
 }catch{return null}
}

function alipayTime(){
 const d=new Date(Date.now()+8*3600*1000);
 return d.toISOString().slice(0,19).replace('T',' ');
}
export async function gatewayRequest(env,method,bizContent){
 const params={
  app_id:env.ALIPAY_APP_ID,method,format:'JSON',charset:'utf-8',sign_type:'RSA2',
  timestamp:alipayTime(),version:'1.0',biz_content:JSON.stringify(bizContent),
 };
 if(method==='alipay.trade.precreate')params.notify_url=env.HHBA_ALIPAY_NOTIFY_URL;
 const sign=await rsaSign(params,env.ALIPAY_PRIVATE_KEY_PKCS8);
 const body=new URLSearchParams({...params,sign});
 const response=await fetch('https://openapi.alipay.com/gateway.do',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
  body:body.toString(),redirect:'error'
 });
 if(!response.ok)throw Error('PAYMENT_GATEWAY_UNAVAILABLE');
 const raw=await response.text();
 if(raw.length>65536)throw Error('PAYMENT_GATEWAY_INVALID_RESPONSE');
 const data=await verifyGatewayResponse(raw,method,env.ALIPAY_PUBLIC_KEY);
 if(!data||data.code!=='10000')throw Error('PAYMENT_GATEWAY_REJECTED');
 return data;
}
export function amountFen(amount){
 if(typeof amount!=='string'||!/^\d{1,5}\.\d{2}$/.test(amount))return null;
 const [whole,cents]=amount.split('.');
 const value=Number(whole)*100+Number(cents);
 return Number.isSafeInteger(value)?value:null;
}
