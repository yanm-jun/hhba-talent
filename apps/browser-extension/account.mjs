// Explicit, read-only account pairing. No website bearer, cookie or wallet
// mutation capability is ever exposed to the browser helper.
export const HHBA_SITE='https://hhba.work';
export const HHBA_PERMISSION='https://hhba.work/*';
export const HHBA_EXTENSION_API=HHBA_SITE+'/api/apply/extension';
export const EXTENSION_SESSION_KEY='hhba.apply.extension.session.v1';
export function cleanPairCode(v){
 const code=String(v||'').trim().replace(/[\s-]+/g,'').toUpperCase();
 return /^[A-HJ-NP-Z2-9]{12}$/.test(code)?code:null;
}
export function validDeviceSession(v,now=Date.now()){
 return !!v&&typeof v.token==='string'&&/^hhbaext_[a-f0-9]{64}$/.test(v.token)&&
 typeof v.expiresAt==='string'&&Date.parse(v.expiresAt)>now;
}
export async function accountApi(fetchFn,path,token,body){
 if(!['/claim','/wallet','/disconnect','/ai/map','/profile/claim'].includes(path))throw Error('此插件没有操作该接口的权限');
 if(path!=='/claim'&&!validDeviceSession(token))throw Error('连接已失效，请重新连接');
 let payload=path==='/claim'?{code:cleanPairCode(body?.code)}:undefined;
 if(path==='/claim'&&!payload.code)throw Error('请输入正确的12位连接码');
 if(path==='/ai/map'){
  if(body?.consentToExternalAi!==true||!Array.isArray(body?.profileKeys)||!Array.isArray(body?.fields))
   throw Error('先确认 AI 字段分析范围再提交');
  // Whitelist only label text + key names. Never serialize the local profile.
  payload={consentToExternalAi:true,profileKeys:body.profileKeys,
   fields:body.fields.map(f=>({id:f.id,label:f.label,kind:f.kind}))};
  if(JSON.stringify(payload).length>6000)throw Error('页面字段过多，请缩小分析范围');
 }
 const response=await fetchFn(HHBA_EXTENSION_API+path,{
  method:path==='/wallet'?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',
  headers:{...(payload?{'Content-Type':'application/json'}:{}),
   ...(token?.token&&path!=='/claim'?{Authorization:'Bearer '+token.token}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 let output;
 try{output=await response.json()}catch{throw Error('连接服务返回了异常数据')}
 if(!response.ok||output?.ok!==true)
  throw Error(String(output?.error||'连接服务尚未启用，请稍后再试').slice(0,100));
 return output;
}
