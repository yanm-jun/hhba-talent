/**
 * Read-only weekly URL accessibility monitor for HHBA original labor-rights references.
 * A successful HTTP response DOES NOT establish that a legal text is current or applicable.
 * No tokens, personal records, user queries, or paid APIs are accessed.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=JSON.parse(readFileSync(resolve(ROOT,'src/data/laborRightsTopics.json'),'utf8'));
const sub=JSON.parse(readFileSync(resolve(ROOT,'src/data/laborRightsSubtopics.json'),'utf8'));
const dryRun=process.argv.includes('--dry-run');
const knownHosts=new Set([
 'www.mohrss.gov.cn','www.samr.gov.cn','www.court.gov.cn',
 'fgk.chinatax.gov.cn','know.12348.gov.cn',
 'www.beijing.gov.cn','rsj.beijing.gov.cn','shanghai.chinatax.gov.cn',
 'chinajob.mohrss.gov.cn','www.nhsa.gov.cn','xzfg.moj.gov.cn'
]);
const records=new Map();
function add(url,kind,slug,title){
 const u=new URL(url);
 if(u.protocol!=='https:'||!knownHosts.has(u.hostname))throw Error('Unknown or non-HTTPS legal source: '+url);
 const entry=records.get(url)||{url,references:[]};
 entry.references.push({kind,slug,title});
 records.set(url,entry);
}
for(const topic of base.topics){
 for(const law of topic.laws)add(law.url,'law',topic.slug,law.name);
 add(topic.case.url,'case',topic.slug,topic.case.title);
}
for(const topic of sub.topics)for(const law of topic.laws)add(law.url,'law',topic.slug,law.name);
const entries=[...records.values()];
if(entries.length<10)throw Error('Suspiciously few sources: '+entries.length);

const timeout=Number(process.env.HHBA_RIGHTS_SOURCE_TIMEOUT_MS||10000);
const timeoutMs=Math.min(Math.max(timeout,2000),20000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function classify(status,contentType,url){
 const u=new URL(url);
 if(u.protocol!=='https:'||!knownHosts.has(u.hostname))return 'review_redirect';
 if([404,410].includes(status))return 'broken';
 if([401,403,429,451].includes(status))return 'blocked';
 if(status>=500)return 'transient';
 if(status>=300)return 'review_redirect';
 if(status>=200&&status<300){
  if(!contentType||/text\/html|application\/pdf|text\/plain|octet-stream|application\/x-pdf/i.test(contentType))return 'reachable';
  return 'review_type';
 }
 return 'review_other';
}
async function single(url){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{method:'GET',redirect:'follow',signal:controller.signal,headers:{'User-Agent':'HHBA-Source-Link-Monitor/1.0 (read-only accessibility checks)','Accept':'text/html,application/pdf;q=0.9,*/*;q=0.2'}});
  const contentType=response.headers.get('content-type')||'';
  const result={httpStatus:response.status,contentType:contentType.slice(0,100),finalUrl:response.url,classification:classify(response.status,contentType,response.url)};
  await response.body?.cancel();
  return result;
 }catch(e){
  return {classification:'transient',error:String(e).slice(0,180)};
 }finally{clearTimeout(timer)}
}
async function check(entry){
 if(dryRun)return {...entry,classification:'not_checked',note:'Dry run validated URLs and metadata only; no live request was made'};
 let first=await single(entry.url);
 if(first.classification==='broken'){
  await sleep(600);
  const second=await single(entry.url);
  if(second.classification!=='broken')first={...second,classification:'transient',note:'First response was 404/410; confirmation differed. Manual check needed'};
 }
 return {...entry,...first};
}
let results=[];
let next=0;
async function worker(){
 while(next<entries.length){
  const index=next++;
  results[index]=await check(entries[index]);
 }
}
await Promise.all(Array.from({length:Math.min(3,entries.length)},worker));
const counts={};
for(const record of results)counts[record.classification]=(counts[record.classification]||0)+1;
const output={
 generatedAt:new Date().toISOString(),mode:dryRun?'dry_run':'live_http',
 baseEditorialReviewDate:base.reviewedOn,subtopicEditorialReviewDate:sub.reviewedOn,
 limitation:'HTTP link accessibility only: not a legal-text version audit, fact check, case verification, or legal advice.',
 checked:results.length,counts,results
};
const dest=resolve(ROOT,'tmp/rights-source-health.json');
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(output,null,2)+'\n');
const heading='HHBA 劳动权益知识来源：链接可访问性巡检';
const summary=[
 '### '+heading,
 '',
 '- 检查模式：'+(dryRun?'仅本地元数据校验（没有请求网络）':'联网只读访问检查'),
 '- 去重来源：'+results.length,
 '- 结果分类：'+Object.entries(counts).map(([k,v])=>k+'='+v).join('，'),
 '- 原有深度专题资料核对日期：'+base.reviewedOn,
 '- 细分专题资料核对日期：'+sub.reviewedOn,
 '- **重要：链接可访问，不表示法规现行有效，也不表示文章解释准确。**',
 '',
 '| 分类 | URL | 受影响专题 |',
 '|---|---|---|',
 ...results.filter(r=>r.classification!=='reachable').map(r=>
  '| '+r.classification+' | '+r.url+' | '+[...new Set(r.references.map(x=>x.slug))].join(', ')+' |')
].join('\n')+'\n';
const summaryPath=process.env.GITHUB_STEP_SUMMARY;
if(summaryPath){
 const {appendFileSync}=await import('node:fs');
 appendFileSync(summaryPath,summary);
}
console.log('HHBA_RIGHTS_SOURCE_HEALTH',JSON.stringify({mode:output.mode,total:output.checked,counts,report:'tmp/rights-source-health.json'}));
if(results.some(r=>r.classification==='broken')){
 console.error('One or more sources returned 404/410 twice. Review the attached report and replace only with verified official legal texts.');
 process.exitCode=1;
}
