import {createServer as httpServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {getPublicOverview} from './metrics.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const PUBLIC_PREVIEW=process.env.HHBA_ADMIN_PUBLIC_PREVIEW==='1';
const LOCAL_HOST=/^(?:127\.0\.0\.1|localhost)(?::\d{2,5})?$/;
const RAILWAY_PREVIEW_HOST=/^[a-z0-9-]+\.up\.railway\.app(?::\d{2,5})?$/;
const FILES=new Map([
 ['/','index.html'],['/index.html','index.html'],
 ['/styles.css','styles.css'],['/dashboard.js','dashboard.js'],
 ['/favicon.svg','favicon.svg']
]);
const MIME={'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8',
 'js':'text/javascript; charset=utf-8','svg':'image/svg+xml'};
const COMMON={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Cache-Control':'no-store',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
const send=(res,status,body,kind='text/plain; charset=utf-8',method='GET')=>{
 res.writeHead(status,{...COMMON,'Content-Type':kind});
 res.end(method==='HEAD'?undefined:body);
};
export function createPreviewServer({overview=getPublicOverview}={}){
 return httpServer(async(req,res)=>{
  const method=req.method||'GET';
  const host=req.headers.host||'';
  // Preview serves only static UI and publicly available aggregate data.
  // Railway public host is allowed only in explicit preview mode.
  if(!LOCAL_HOST.test(host)&&!(PUBLIC_PREVIEW&&RAILWAY_PREVIEW_HOST.test(host))){
   send(res,403,'Preview domain not allowed','text/plain; charset=utf-8',method);return;
  }
  if(!['GET','HEAD'].includes(method)){
   res.setHeader('Allow','GET, HEAD');
   send(res,405,'Read only preview','text/plain; charset=utf-8',method);return;
  }
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  if(url.pathname==='/health'){
   send(res,200,JSON.stringify({ok:true,kind:'HHBA_ADMIN_PUBLIC_READONLY_PREVIEW_V1'}),'application/json; charset=utf-8',method);return;
  }
  if(url.pathname==='/api/overview'){
   try{
    const data=await overview();
    send(res,200,JSON.stringify(data),'application/json; charset=utf-8',method);
   }catch(err){
    // Never expose full remote response, credentials, or stack traces.
    send(res,503,JSON.stringify({kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_UNAVAILABLE',
      message:'真实招聘索引暂不可用，未使用模拟数据'}),
     'application/json; charset=utf-8',method);
   }
   return;
  }
  const file=FILES.get(url.pathname);
  if(!file){send(res,404,'Not found','text/plain; charset=utf-8',method);return;}
  try{
   const data=await readFile(join(ROOT,file));
   const type=MIME[file.split('.').pop()]||'application/octet-stream';
   send(res,200,data,type,method);
  }catch{send(res,500,'Unable to load preview','text/plain; charset=utf-8',method)}
 });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const requested=Number(process.env.PORT||4318);
 const port=Number.isInteger(requested)&&requested>=1024&&requested<=65535?requested:4318;
 createPreviewServer().listen(port,PUBLIC_PREVIEW?'0.0.0.0':'127.0.0.1',()=>{
  console.log('HHBA_ADMIN_PREVIEW_LISTEN '+port+' public='+PUBLIC_PREVIEW);
  console.log('No admin authentication, candidate data, privileged API or write routes are enabled.');
 });
}
