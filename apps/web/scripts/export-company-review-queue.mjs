#!/usr/bin/env node
// Generate a human review queue from a verified local jobs snapshot.
// No scraping, invented domains, generated logos, or fabricated descriptions.
// Usage: node scripts/export-company-review-queue.mjs jobs.json job-sync-status.json output.json
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const [, ,snapshotPath,auditPath,outputPath]=process.argv;
if(!snapshotPath||!auditPath||!outputPath){
 console.error('Usage: node export-company-review-queue.mjs jobs.json job-sync-status.json output.json');
 process.exit(2);
}
function parse(p){return JSON.parse(readFileSync(resolve(p),'utf8'))}
const snapshot=parse(snapshotPath),audit=parse(auditPath);
if(!Array.isArray(snapshot.jobs)||!Array.isArray(audit.jobs)||
 !snapshot.updated||audit.summary?.indexed_as_of!==snapshot.updated)
 throw Error('ABORT: official job snapshot and source audit versions mismatch');
const approved=new Set(audit.jobs.filter(x=>x.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND')
 .map(x=>x.job_id));
const active=new Map();
const allowedHosts={
 ashby:['jobs.ashbyhq.com'],
 greenhouse:['boards.greenhouse.io','boards.eu.greenhouse.io','job-boards.greenhouse.io'],
 lever:['jobs.lever.co','jobs.eu.lever.co']
};
const brandedGreenhouse={
 stripe:{host:'stripe.com',path:'/jobs/search'},
 coinbase:{host:'www.coinbase.com',path:'/careers/positions/'},
 airbnb:{host:'careers.airbnb.com',path:'/positions/'},
 databricks:{host:'databricks.com',path:'/company/careers/open-positions/job'}
};
const domesticHosts={
 'xiaomi-official':'xiaomi.jobs.f.mioffice.cn',
 'meituan-official':'zhaopin.meituan.com',
 'tencent-official':'careers.tencent.com',
 'baidu-official':'talent.baidu.com'
};
function identityForJob(job){
 if(!job.company||!job.platform||!job.source||typeof job.company!=='string')return null;
 const company=job.company.trim();
 if(company.length>120||!(/^[A-Za-z0-9_-]{2,80}$/).test(job.platform)||
    !(/^[A-Za-z0-9_-]{1,110}$/).test(job.source))return null;
 return [job.platform,job.source,company];
}
function verifiedUrl(job){
 try{
  const u=new URL(job.url);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(job.domestic)return u.hostname===domesticHosts[job.platform];
  if((allowedHosts[job.platform]||[]).includes(u.hostname)&&
    u.pathname.split('/').includes(job.source))return true;
  const branded=job.platform==='greenhouse'?brandedGreenhouse[job.source]:null;
  const prefix='greenhouse-'+job.source+'-';
  const native=job.id?.startsWith(prefix)?job.id.slice(prefix.length):'';
  return !!branded&&/^[0-9]{5,20}$/.test(native)&&
    u.hostname===branded.host&&
    (branded.path.endsWith('/')?u.pathname.startsWith(branded.path):u.pathname===branded.path)&&
    u.searchParams.get('gh_jid')===native;
 }catch{return false}
}
for(const job of snapshot.jobs){
 if(!approved.has(job.id)||!verifiedUrl(job))continue;
 const identity=identityForJob(job);
 if(!identity)continue;
 const bytes=Buffer.from(JSON.stringify(identity),'utf8');
 if(bytes.length>420)continue;
 const id=bytes.toString('base64url');
 const row=active.get(id);
 if(row){row.jobCount++;continue}
 active.set(id,{
   id,platform:identity[0],source:identity[1],company:identity[2],
   jobCount:1,exampleJobId:job.id,exampleSourceUrl:job.url,
   editorialStatus:'NEEDS_REVIEW',companyWebsite:null,companyLogo:null,
   founded:null,industry:null,overviewZh:null,overviewEn:null,
   reviewedAt:null
 });
}
const result={
 schemaVersion:1,sourceIndexUpdated:snapshot.updated,
 generatedBy:'HHBA official source audit',generatedAt:new Date().toISOString(),
 caveat:'A verified recruitment board is not yet a verified corporate biography.',
 count:active.size,companies:[...active.values()].sort((a,b)=>b.jobCount-a.jobCount||
  a.company.localeCompare(b.company))
};
writeFileSync(resolve(outputPath),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({companies:result.count,records:snapshot.jobs.length,approved:approved.size,
 output:outputPath}));
