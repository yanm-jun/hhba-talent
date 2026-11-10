#!/usr/bin/env node
/**
 * Submit the *deployed* public sitemap URLs to the IndexNow shared endpoint.
 * Only published, canonical, same-host public URLs can be sent.
 * IndexNow notifies participating engines; it does NOT guarantee indexing.
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const HOST='hhba.work';
const ORIGIN='https://'+HOST;
const KEY='9a3c3cf5a998f8d7e916078a3e4255efee04cc25';
const SITEMAP=ORIGIN+'/sitemap.xml';
const KEY_LOCATION=ORIGIN+'/'+KEY+'.txt';
const EXCLUDED=/^\/(?:admin-preview|preview-admin|api|candidate\/(?:login|register|resume|profile|match)|employer\/workspace)(?:\/|$)/i;

export function parsePublicSitemap(xml){
 assert(typeof xml==='string'&&xml.length>0&&xml.length<5_000_000,'Invalid sitemap size');
 assert(/<urlset\b/.test(xml)&&!/<html\b/i.test(xml),'Expected XML URL sitemap');
 const matches=[...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)];
 assert(matches.length>0&&matches.length<=10000,'Expected 1–10000 sitemap URLs');
 const urls=[];
 const seen=new Set();
 for(const match of matches){
  const raw=match[1].replaceAll('&amp;','&').trim();
  let url;
  try{url=new URL(raw)}catch{throw new Error('Invalid sitemap URL: '+raw.slice(0,160))}
  assert(url.protocol==='https:'&&url.hostname===HOST&&url.port===''&&url.username===''&&url.password==='','Wrong sitemap origin');
  assert(url.search===''&&url.hash==='','Sitemap URL contains query/fragment');
  assert(!EXCLUDED.test(url.pathname),'Private route in sitemap: '+url.pathname);
  assert(url.pathname==='/'||url.pathname.endsWith('/'),'Expected canonical trailing slash');
  if(!seen.has(url.href)){urls.push(url.href);seen.add(url.href);}
 }
 return urls;
}
async function getText(url){
 const res=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 assert(res.ok,url+' responded HTTP '+res.status);
 return res.text();
}
export async function submitIndexNow(){
 const [publishedKey,xml]=await Promise.all([getText(KEY_LOCATION),getText(SITEMAP)]);
 assert.equal(publishedKey.trim(),KEY,'Published IndexNow ownership key mismatch');
 const urlList=parsePublicSitemap(xml);
 const response=await fetch('https://api.indexnow.org/indexnow',{
  method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
  body:JSON.stringify({host:HOST,key:KEY,keyLocation:KEY_LOCATION,urlList}),
  signal:AbortSignal.timeout(30000)
 });
 assert([200,202].includes(response.status),'IndexNow rejected URL batch: HTTP '+response.status+' '+(await response.text()).slice(0,400));
 console.log('HHBA_INDEXNOW_BATCH_ACCEPTED',JSON.stringify({status:response.status,count:urlList.length,sitemap:SITEMAP}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 submitIndexNow().catch(e=>{console.error(e);process.exitCode=1;});
}
