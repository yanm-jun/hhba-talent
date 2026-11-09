/**
 * HHBA V8: preview-only Cloudflare Browser Run binding, no API token.
 *
 * Browser Run is billed separately from DeepSeek. Callers enforce the
 * two-render limit and write a separate count-only D1 audit record. This
 * helper NEVER receives resumes, cookies, passwords or user identifiers.
 * It does not solve CAPTCHAs, bypass website restrictions or submit forms.
 */
export function previewJobBrowserRenderer(env){
 if(env?.HHBA_AUTH_ROLLOUT!=='preview'||
    env?.HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED!=='1'||
    typeof env?.BROWSER?.quickAction!=='function')return null;
 const browser=env.BROWSER;
 return async function renderPublicJob(url){
  if(typeof url!=='string'||url.length>420)throw Error('BROWSER_BAD_URL');
  let parsed;
  try{parsed=new URL(url);}catch{throw Error('BROWSER_BAD_URL');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||
     parsed.port||parsed.hash||parsed.hostname.includes('xn--')||
     !/^[a-z0-9-]+(?:\.[a-z0-9-]+){1,5}$/i.test(parsed.hostname)||
     /^\d+(?:\.\d+){3}$/u.test(parsed.hostname)||
     parsed.hostname.split('.').some(x=>/^(?:localhost|local|internal|test|invalid|example)$/i.test(x)))
   throw Error('BROWSER_BAD_URL');
  let response;
  try{
   response=await browser.quickAction('snapshot',{
    url:parsed.href,formats:['content','markdown'],
    gotoOptions:{waitUntil:'domcontentloaded',timeout:18000},
    waitForTimeout:1200,
    rejectResourceTypes:['image','font','media']
   });
  }catch{throw Error('BROWSER_NETWORK_UNAVAILABLE');}
  // The first-party binding returns a Response. Stay compatible with typed
  // envelope objects, but never accept oversized bodies or non-JSON errors.
  let obj;
  if(response&&typeof response.text==='function'){
   if(!response.ok)throw Error('BROWSER_UPSTREAM_UNAVAILABLE');
   if(!(response.headers.get('content-type')||'').toLowerCase().includes('json')||
      Number(response.headers.get('content-length')||0)>650000)
    throw Error('BROWSER_RESPONSE_INVALID');
   try{
    const raw=await response.text();
    if(raw.length>650000)throw Error('BROWSER_RESPONSE_INVALID');
    obj=JSON.parse(raw);
   }catch{throw Error('BROWSER_RESPONSE_INVALID');}
  }else if(response&&typeof response==='object')obj=response;
  else throw Error('BROWSER_RESPONSE_INVALID');
  if(obj.success===false)throw Error('BROWSER_UPSTREAM_UNAVAILABLE');
  const data=obj.result&&typeof obj.result==='object'?obj.result:obj;
  const markdown=typeof data.markdown==='string'?data.markdown.slice(0,120000):'';
  const html=typeof data.content==='string'?data.content.slice(0,200000):'';
  if(markdown.length<190)return null;
  const front=markdown.slice(0,350).match(/^---\s*\n\s*title:\s*["']?([^"'\n]{3,130})/m);
  return {title:front?.[1]||'',content:markdown,html};
 };
}
