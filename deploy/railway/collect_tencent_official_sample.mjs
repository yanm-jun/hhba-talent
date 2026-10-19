// Official employer board ingestion: read-only, bounded, no auth or anti-bot bypass.
// Results are *observations* requiring provenance review, not automatically live openings.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const origin='https://careers.tencent.com';
const location='/tencentcareer/api/post/Query';
const output='domestic-discovery-evidence';
const entries=[],seen=new Set(),pageProof=[];
const size=40,maxPages=3,maxRecords=120;
for(let pageIndex=1;pageIndex<=maxPages;pageIndex++){
 const url=new URL(location,origin);
 for(const [k,v] of Object.entries({pageIndex,pageSize:size,keyword:'',language:'zh-cn',area:'cn'}))url.searchParams.set(k,String(v));
 const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('TENCENT_API_HTTP_'+response.status);
 if(!(response.headers.get('content-type')||'').toLowerCase().includes('json'))throw Error('TENCENT_NON_JSON_RESPONSE');
 const data=await response.json();
 const rows=data?.Data?.Posts;
 const total=Number(data?.Data?.Count);
 if(!Array.isArray(rows)||!Number.isFinite(total)||total<1||total>1000000)throw Error('TENCENT_API_SCHEMA_MISMATCH');
 pageProof.push({pageIndex,returned:rows.length,declaredTotal:total});
 for(const item of rows){
  const postId=String(item?.PostId??'');
  const title=String(item?.RecruitPostName??'').trim();
  const locationName=String(item?.LocationName??'').trim();
  if(!/^\d{8,24}$/.test(postId)||!title||title.length>220||!locationName||locationName.length>150)continue;
  if(seen.has(postId))continue;
  seen.add(postId);
  const rawUrl=String(item?.PostURL??'');
  let exactOfficialUrl=null;
  if(rawUrl){try{const parsed=new URL(rawUrl,origin);if(parsed.protocol==='https:'&&parsed.hostname==='careers.tencent.com'&&parsed.searchParams.get('postId')===postId)exactOfficialUrl=parsed.href}catch{}}
  // No synthesis of unverified job-specific URLs. Official board remains source fallback.
  entries.push({company:'Tencent',companyZh:'腾讯',id:postId,title,city:locationName,source:'TENCENT_OFFICIAL_JSON_LIST',officialUrl:exactOfficialUrl,officialBoard:'https://careers.tencent.com/',observedAt:new Date().toISOString(),jobType:'UNCLASSIFIED',currentApplicationVerified:false,directApplicationVerified:false,fullJdStored:false});
  if(entries.length>=maxRecords)break;
 }
 if(entries.length>=maxRecords||rows.length<size||pageIndex*size>=total)break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!entries.length)throw Error('TENCENT_ZERO_VALID_OFFICIAL_POSTINGS');
mkdirSync(output,{recursive:true});
const canonical=JSON.stringify(entries);
const summary={schema:1,checkedAt:new Date().toISOString(),source:'https://careers.tencent.com/tencentcareer/api/post/Query',evidence:'OFFICIAL_JSON_LIST_OBSERVED',currentApplicationVerified:0,fullJobDescriptionStored:0,confirmedDirectLinks:entries.filter(x=>x.officialUrl).length,jobCount:entries.length,sha256:createHash('sha256').update(canonical).digest('hex'),pages:pageProof,jobs:entries};
writeFileSync(output+'/tencent-public-observations.json',JSON.stringify(summary,null,2)+'\n');
console.log('HHBA_TENCENT_OFFICIAL_OBSERVATIONS',JSON.stringify({count:summary.jobCount,digest:summary.sha256,pages:pageProof,verifiedDirectLinks:summary.confirmedDirectLinks,applicationVerified:0}));
