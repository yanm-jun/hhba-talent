// Optional lookup index stored ONLY inside the existing AES-GCM encrypted
// research checkpoint. The D1 work queue never stores URLs or resume text.
// This avoids re-hashing up to 500 candidate URLs for every leased JD worker.
// A missing/stale index always falls back to the original verified URL scan.
import {sha256Hex} from './real-auth.js';
const validTask=key=>typeof key==='string'&&/^[a-f0-9]{64}$/.test(key);
const jobKey=(taskKey,url)=>sha256Hex('HHBA_V4_JOB_WORK:'+taskKey+':'+url);
const urlsOf=rows=>rows.map(row=>typeof row?.[0]==='string'?row[0]:'');
const signature=urls=>sha256Hex('HHBA_V4_JOB_LOCATOR_V1:'+JSON.stringify(urls));
export async function v4VerifiedJobLocator(checkpoint,taskKey){
 const rows=checkpoint?.rows;
 if(!validTask(taskKey)||!Array.isArray(rows)||!Array.isArray(checkpoint?.jobLocator?.keys))return null;
 const keys=checkpoint.jobLocator.keys;
 if(keys.length!==rows.length||checkpoint.jobLocator.version!==1)return null;
 if(checkpoint.jobLocator.signature!==await signature(urlsOf(rows)))return null;
 return keys;
}
export async function stampV4JobLocator(checkpoint,taskKey){
 if(!validTask(taskKey)||!Array.isArray(checkpoint?.rows))return checkpoint;
 const urls=urlsOf(checkpoint.rows),sig=await signature(urls);
 const current=checkpoint.jobLocator;
 if(current?.version===1&&current.signature===sig&&Array.isArray(current.keys)&&current.keys.length===urls.length)return checkpoint;
 const keys=[];
 // WebCrypto hashing in small groups keeps Cloudflare invocation overhead
 // predictable. This does not restrict total candidates or research calls.
 for(let i=0;i<urls.length;i+=16){
  const batch=await Promise.all(urls.slice(i,i+16).map(url=>url?jobKey(taskKey,url):Promise.resolve(null)));
  keys.push(...batch);
 }
 return {...checkpoint,jobLocator:{version:1,signature:sig,keys}};
}
export async function locateV4ClaimCandidate(checkpoint,taskKey,claimKey){
 if(!validTask(taskKey)||! /^[a-f0-9]{64}$/.test(claimKey)||!Array.isArray(checkpoint?.rows))return null;
 const keys=await v4VerifiedJobLocator(checkpoint,taskKey);
 if(keys){
  const index=keys.indexOf(claimKey);
  if(index>=0){
   const [url,source]=checkpoint.rows[index]||[];
   // A single exact keyed check fences an incorrect or inconsistent index.
   if(url&&source&&await jobKey(taskKey,url)===claimKey)return {url,source,index};
  }
 }
 for(let i=0;i<checkpoint.rows.length;i++){
  const [url,source]=checkpoint.rows[i]||[];
  if(url&&source&&await jobKey(taskKey,url)===claimKey)return {url,source,index:i};
 }
 return null;
}
