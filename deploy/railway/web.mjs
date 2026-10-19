import { createServer as httpServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'
};
const LIVE_API_PATH=/^\/live-recruitment\/api\/jobs(?:\/page|\/[A-Za-z0-9_-]{1,180})?\/?$/;
const LIVE_MARKET_HOSTS=new Set([
  'hhba-web-production-024c.up.railway.app',
  'hhba-live-jobs-preview-production.up.railway.app'
]);
function liveOrigin(value){
  if(!value)return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||
     url.pathname!=='/'||url.search||url.hash||!LIVE_MARKET_HOSTS.has(url.hostname))
    throw Error('HHBA_LIVE_RECRUITMENT_URL is not an allowed read-only source');
  return url.origin;
}
const API_PATH=/^\/recruitment\/api\/v1\/(?:marketplace|stats|health|jobs(?:\/[A-Za-z0-9_-]{1,64}(?:\/original-jd)?)?)\/?$/;

const json = (res,code,data)=>{
  res.writeHead(code,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(data));
};

function upstream(value){
  if(!value)return null;
  const u=new URL(value);
  if(u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||
     u.search||u.hash||!u.hostname ||
     !(u.hostname.endsWith('.railway.internal')||['localhost','127.0.0.1','[::1]','::1'].includes(u.hostname)))
    throw Error('HHBA_RECRUITMENT_API_URL must be the private HTTP API service');
  return u.origin;
}
async function upstreamHealth(backend){
  if(!backend)return false;
  try{
    const response=await fetch(backend+'/api/v1/health',{
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(3000),redirect:'manual'});
    return response.ok;
  }catch{return false;}
}
function secure(res){
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('referrer-policy','no-referrer');
  res.setHeader('x-frame-options','DENY');
  res.setHeader('permissions-policy','camera=(),microphone=(),geolocation=(self)');
}
export function makeServer({dist=resolve('dist'),apiUrl=process.env.HHBA_RECRUITMENT_API_URL,
  liveUrl=process.env.HHBA_LIVE_RECRUITMENT_URL}={}){
  const root=resolve(dist);
  const backend=upstream(apiUrl);
  const liveBackend=liveOrigin(liveUrl);
  return httpServer(async(req,res)=>{
    secure(res);
    let url;
    try{url=new URL(req.url||'/', 'http://hhba.local');}
    catch{return json(res,400,{error:'bad_request'});}
    if(url.pathname==='/health'){
      return json(res,await upstreamHealth(backend)?200:503,
        {ok:await upstreamHealth(backend),role:'hhba-public-readonly'});
    }
    if(url.pathname.startsWith('/live-recruitment/')){
      if(!['GET','HEAD'].includes(req.method||'')||!LIVE_API_PATH.test(url.pathname))
        return json(res,404,{error:'route_not_found'});
      if(!liveBackend)return json(res,503,{error:'recruitment_preview_not_configured'});
      try{
        const path=url.pathname.replace(/^\/live-recruitment/,'')+url.search;
        const response=await fetch(liveBackend+path,{
          method:'GET',headers:{Accept:'application/json'},
          redirect:'manual',signal:AbortSignal.timeout(15000)
        });
        const data=await response.arrayBuffer();
        if(data.byteLength>2*1024*1024)return json(res,502,{error:'preview_response_too_large'});
        if(!response.headers.get('content-type')?.includes('application/json'))
          return json(res,502,{error:'unexpected_response_type'});
        res.writeHead(response.status,{'content-type':'application/json; charset=utf-8',
          'cache-control':'no-store','x-content-type-options':'nosniff'});
        return res.end(req.method==='HEAD'?undefined:Buffer.from(data));
      }catch{return json(res,502,{error:'recruitment_preview_unavailable'});}
    }
    if(url.pathname.startsWith('/api/')){
      // Candidate/recruiter auth and user data are NOT enabled in the
      // recruitment-only public MVP. Never fake account success.
      return json(res,url.pathname==='/api/v1/auth/me'?401:503,
        {detail:'此公开招聘市场版本暂未开放用户账户服务。'});
    }
    if(url.pathname.startsWith('/recruitment/')){
      if(!['GET','HEAD'].includes(req.method||'')||!API_PATH.test(url.pathname))
        return json(res,404,{error:'route_not_found'});
      if(!backend)return json(res,503,{error:'recruitment_backend_not_configured'});
      try{
        const path=url.pathname.replace(/^\/recruitment/,'')+url.search;
        const response=await fetch(backend+path,{method:'GET',
          headers:{Accept:'application/json'},redirect:'manual',
          signal:AbortSignal.timeout(10000)});
        const data=await response.arrayBuffer();
        if(data.byteLength>2*1024*1024)return json(res,502,{error:'upstream_response_too_large'});
        res.writeHead(response.status,{'content-type':'application/json; charset=utf-8',
          'cache-control':'no-store','x-content-type-options':'nosniff'});
        return res.end(req.method==='HEAD'?undefined:Buffer.from(data));
      }catch{return json(res,502,{error:'recruitment_service_unavailable'});}
    }
    if(!['GET','HEAD'].includes(req.method||''))return json(res,405,{error:'method_not_allowed'});
    let location;
    try{
      const pathname=decodeURIComponent(url.pathname);
      if(pathname.includes('\\')||pathname.includes('\0'))return json(res,400,{error:'invalid_path'});
      location=resolve(root,'.'+pathname);
    }catch{return json(res,400,{error:'bad_path'});}
    if(location!==root&&!location.startsWith(root+sep))
      return json(res,403,{error:'invalid_path'});
    const ext=extname(location).toLowerCase();
    let file=location;
    try{
      if(!ext || url.pathname==='/')file=resolve(root,'index.html');
      else{
        const info=await stat(file);
        if(!info.isFile())return json(res,404,{error:'not_found'});
      }
      const data=await readFile(file);
      res.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]||'application/octet-stream',
         'cache-control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});
      return res.end(req.method==='HEAD'?undefined:data);
    }catch{return json(res,404,{error:'static_file_not_found'});}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid PORT');
  const server=makeServer({dist:'/app/dist'});
  server.listen(port,'0.0.0.0',()=>console.log('HHBA public recruitment site listening',port));
}
