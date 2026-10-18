// Public Tencent recruitment endpoint pilot; no login, no HTML crawling and
// no collection of resume data. Results are official listing observations, NOT
// verified current application status or permission to reproduce the full JD.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const HOST='careers.tencent.com';
const entries=new Map(),pages=[];
const size=30;
for(let p=1;p<=4;p++){
 const u=new URL('https://'+HOST+'/tencentcareer/api/post/Query');
 for(const [k,v] of Object.entries({timestamp:String(Date.now()),countryId:'',cityId:'',bgIds:'',productId:'',categoryId:'',parentCategoryId:'',attrId:'',keyword:'',pageIndex:String(p),pageSize:String(size),language:'zh-cn',area:'cn'}))u.searchParams.set(k,v);
 let response;
 try{response=await fetch(u,{headers:{Accept:'application/json','User-Agent':'HHBA-official-public-recruitment-review/0.1'},redirect:'error',signal:AbortSignal.timeout(25000)});}
 catch(err){throw Error('Tencent official API unavailable: '+(err?.message||'unknown'));}
 if(!response.ok)throw Error('Tencent official API HTTP '+response.status);
 const body=await response.json();const source=body.Data||body.data||null;
 const items=source?.Posts||source?.posts||null;
 if(!Array.isArray(items)||typeof source.Count!=='number')throw Error('Unrecognized Tencent public API schema '+JSON.stringify(Object.keys(body)));
 const batch=[];
 for(const item of items){
  const id=String(item.PostId||item.PostID||item.postId||'');
  const title=String(item.RecruitPostName||'').trim();
  const city=String(item.LocationName||'').trim();
  const nation=String(item.CountryName||'').trim();
  const modified=String(item.LastUpdateTime||'').trim();
  const original=String(item.PostURL||'');
  if(!/^\d{12,23}$/.test(id)||!title||title.length>220||!city||city.length>95)continue;
  if(nation&&!/中国|China|CN/i.test(nation))continue;
  const safe='https://careers.tencent.com/zh-cn/jobdesc.html?postId='+id;
  if(original){try{const u=new URL(original, 'https://careers.tencent.com');if(u.hostname!==HOST||u.protocol!=='https:'||!u.pathname.includes('jobdesc'))continue;}catch{continue;}}
  const job={id,title,city,observedAt:new Date().toISOString().slice(0,10),originalUpdated:modified||null,recruitmentType:'UNKNOWN',officialDetailUrl:safe,recordKind:'OFFICIAL_LIST_OBSERVED',currentApplicationVerified:false};
  batch.push(job);
  if(!entries.has(id))entries.set(id,job);
 }
 pages.push({page:p,returned:items.length,validChinese:batch.length,reported:source.Count});
 console.log('HHBA_TENCENT_PUBLIC_PAGE',JSON.stringify(pages.at(-1)));
 if(!items.length||entries.size>=120)break;
 await new Promise(done=>setTimeout(done,900));
}
if(entries.size<8)throw Error('Tencent pilot did not produce sufficient verifiable Chinese official job entries');
const rows=[...entries.values()];
const output={schema:1,company:'Tencent',nameZh:'腾讯',sourceHost:HOST,capturedAt:new Date().toISOString().slice(0,10),recordKind:'OFFICIAL_LIST_OBSERVED',currentApplicationVerified:0,directApplicationsVerified:0,detailsCopied:false,pages,records:rows};
const filepath='deploy/railway/domestic_tencent_observed.json';
mkdirSync('deploy/railway',{recursive:true});
writeFileSync(filepath,JSON.stringify(output,null,2)+'\n');
console.log('HHBA_TENCENT_PUBLIC_SNAPSHOT',JSON.stringify({rows:rows.length,source:HOST,capturedAt:output.capturedAt,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),types:'UNKNOWN_UNTIL_VERIFIED',currentApplicationsVerified:0}));
