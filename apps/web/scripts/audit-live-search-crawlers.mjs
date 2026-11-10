#!/usr/bin/env node
/**
 * Public, read-only crawlability test from a GitHub-hosted runner.
 * User-agent tests are simulations; they cannot prove a verified search bot IP is allowed.
 */
import assert from 'node:assert/strict';
const BASE='https://hhba.work';
const UAS=[
 ['browser','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'],
 ['Baiduspider','Mozilla/5.0 (compatible; Baiduspider/2.0; +https://www.baidu.com/search/spider.html)'],
 ['Googlebot','Mozilla/5.0 (compatible; Googlebot/2.1; +https://www.google.com/bot.html)'],
 ['bingbot','Mozilla/5.0 (compatible; bingbot/2.0; +https://www.bing.com/bingbot.htm)']
];
const checks=[
 ['/','html'],['/companies/discover/','html'],['/companies/autumn/cn-autumn-034/','html'],
 ['/talent-service/cities/','html'],['/robots.txt','robots'],['/sitemap.xml','sitemap']
];
async function check(path,kind,name,ua){
 const r=await fetch(BASE+path,{headers:{'User-Agent':ua,'Accept':'text/html,application/xml,text/plain;q=0.9,*/*;q=0.8'},signal:AbortSignal.timeout(25000)});
 const text=await r.text();
 const challenge=/cf-challenge|cf-browser-verification|Just a moment\.{0,3}|Attention Required! \| Cloudflare/i.test(text);
 const noindex=/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex|<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots/i.test(text)||/noindex/i.test(r.headers.get('x-robots-tag')||'');
 console.log('CRAWLER_AUDIT',JSON.stringify({agent:name,path,status:r.status,length:text.length,challenge,noindex,contentType:r.headers.get('content-type'),cfRay:!!r.headers.get('cf-ray')}));
 assert.equal(r.status,200,name+' '+path+' HTTP '+r.status);
 assert(!challenge,name+' '+path+' received Cloudflare challenge');
 if(kind==='html'){
  assert(/<h1[\s>]/i.test(text),name+' '+path+' is missing static public H1');
  assert(!noindex,name+' '+path+' has a public noindex directive');
  assert(text.includes('汇方职场'),name+' '+path+' missing Chinese brand in HTML');
 }else if(kind==='robots'){
  assert(text.includes('Sitemap: https://hhba.work/sitemap.xml'),'Sitemap directive missing');
  assert(!/Disallow:\s*\/$/m.test(text),'Site-wide crawl denial found');
 }else{
  assert(/<urlset\b/.test(text),'Published sitemap is invalid');
  assert(text.includes('/companies/autumn/cn-autumn-034/'),'Published sitemap lacks company URLs');
 }
}
let issues=[];
for(const [name,ua] of UAS){
 const list=name==='browser'?checks:[checks[0],checks[4]];
 for(const [path,kind] of list){
  try{await check(path,kind,name,ua)}catch(e){issues.push(String(e.message));console.error('CRAWLER_AUDIT_FAIL',name,path,String(e.message))}
 }
}
assert.equal(issues.length,0,'Failed crawler diagnostics: '+issues.join('; '));
console.log('CRAWLER_AUDIT_PASS public pages reachable under tested user agents (not verified bot identities)');
