/**
 * Preview-only, strictly opt-in Browser Rendering snapshot for public single
 * vacancies already discovered by HHBA Search. This does NOT bypass logins,
 * bot protection, authentication, captchas, or site restrictions.
 *
 * Cloudflare snapshot is separately metered; callers MUST mark total cost
 * estimates incomplete and cap calls. No account credentials are ever logged.
 */
export function previewJobBrowserRenderer(env,{fetcher=fetch}={}){
 if(env?.HHBA_AUTH_ROLLOUT!=='preview'||
    env?.HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED!=='1')return null;
 const id=env.HHBA_BROWSER_ACCOUNT_ID,token=env.HHBA_BROWSER_RENDER_TOKEN;
 if(typeof id!=='string'||!/^[a-f0-9]{32}$/i.test(id)||
    typeof token!=='string'||token.length<20)return null;
 return async function renderPublicJob(url){
  if(typeof url!=='string'||url.length>420)throw Error('BROWSER_BAD_URL');
  let parsed;
  try{parsed=new URL(url);}catch{throw Error('BROWSER_BAD_URL');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||
     parsed.port||parsed.hash||parsed.hostname.includes('xn--')||
     !/^[a-z0-9-]+(?:\.[a-z0-9-]+){1,5}$/i.test(parsed.hostname)||
     /^(?:localhost|127\.|10\.|192\.168\.)/i.test(parsed.hostname))
   throw Error('BROWSER_BAD_URL');
  let reply;
  try{
   reply=await fetcher('https://api.cloudflare.com/client/v4/accounts/'+id+
    '/browser-rendering/snapshot?cacheTTL=0',{
    method:'POST',redirect:'manual',cache:'no-store',
    signal:AbortSignal.timeout(27000),
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({url:parsed.href,formats:['content','markdown'],
     gotoOptions:{waitUntil:'domcontentloaded',timeout:18000},
     waitForTimeout:1200,rejectResourceTypes:['image','font','media']})
   });
  }catch{throw Error('BROWSER_NETWORK_UNAVAILABLE');}
  if(!reply.ok||reply.status>=300&&reply.status<400)throw Error('BROWSER_UPSTREAM_UNAVAILABLE');
  if(!(reply.headers.get('content-type')||'').toLowerCase().includes('json')||
     Number(reply.headers.get('content-length')||0)>650000)
   throw Error('BROWSER_RESPONSE_INVALID');
  let obj;
  try{const raw=await reply.text();if(raw.length>650000)throw Error('too large');obj=JSON.parse(raw);}
  catch{throw Error('BROWSER_RESPONSE_INVALID');}
  if(obj?.success===false)throw Error('BROWSER_UPSTREAM_UNAVAILABLE');
  const data=obj?.result&&typeof obj.result==='object'?obj.result:obj;
  const markdown=typeof data?.markdown==='string'?data.markdown.slice(0,120000):'';
  const html=typeof data?.content==='string'?data.content.slice(0,200000):'';
  if(markdown.length<190)return null;
  // Only fetched, visible page output. Never trust Search snippets, use
  // arbitrary JS execution, add cookies, or submit application forms.
  const front=markdown.slice(0,350).match(/^---\s*\n\s*title:\s*["']?([^"'\n]{3,130})/m);
  return {title:front?.[1]||'',content:markdown,html};
 };
}
