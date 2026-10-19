import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('railway-function-20261018.ts','utf8');
const boards=[
 {name:'Stripe',slug:'stripe',host:'stripe.com',path:'/jobs/search'},
 {name:'Coinbase',slug:'coinbase',host:'www.coinbase.com',path:'/careers/positions/'},
 {name:'Airbnb',slug:'airbnb',host:'careers.airbnb.com',path:'/positions/'},
 {name:'Databricks',slug:'databricks',host:'databricks.com',path:'/company/careers/open-positions/job'}
];
for(const b of boards){
 assert(source.includes('company:"'+b.name+'",slug:"'+b.slug+'"'));
 assert(source.includes(b.slug+':{host:"'+b.host+'",path:"'+b.path+'"}'));
}
assert(source.includes('u.searchParams.get("gh_jid")===native')&&
       source.includes('/^[0-9]{5,20}$/.test(native)')&&
       source.includes('urlOK(url,board.slug,board.platform,native)')&&
       source.includes('urlOK(original,board.slug,board.platform,native)'));
let total=0;
for(const b of boards){
 const u='https://boards-api.greenhouse.io/v1/boards/'+b.slug+'/jobs?content=true';
 const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(25000)});
 assert(response.ok,b.slug+' official API not reachable');
 const raw=await response.json();const rows=raw.jobs;
 assert(Array.isArray(rows)&&rows.length>0);
 for(const job of rows){
   const url=new URL(job.absolute_url);
   assert(url.protocol==='https:');
   assert.equal(url.hostname,b.host,b.slug+' custom domain unexpected');
   assert(b.path.endsWith('/')?url.pathname.startsWith(b.path):url.pathname===b.path);
   assert.equal(url.searchParams.get('gh_jid'),String(job.id));
   assert(typeof job.content==='string'&&job.content.length>100);
 }
 total+=rows.length;
 console.log('BRANDED_OFFICIAL_JOBS_RECONFIRMED',JSON.stringify({company:b.name,platform:'greenhouse',board:b.slug,positions:rows.length}));
}
console.log('HHBA_BRANDED_GREENHOUSE_ACCEPTED',JSON.stringify({boards:boards.length,positions:total,
   direct_link_rule:'exact company domain + job path + matching gh_jid; no broad third-party redirects'}));
