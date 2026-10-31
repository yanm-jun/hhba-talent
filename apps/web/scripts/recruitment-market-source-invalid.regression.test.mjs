import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const root='src/data/employerProfiles';
const files=readdirSync(root).filter(f=>/^cn-autumn-\\d{3}\\.json$/.test(f));
let total=0, hashRoutes=0;
const ids=new Set();
for(const file of files){
 const p=JSON.parse(readFileSync(root+'/'+file,'utf8'));
 const portal=new URL(p.recruitment.url);
 for(const job of p.jobs){
  const id='cn-v2-profile-'+p.id+'-'+job.id;
  assert(/^[A-Za-z0-9-]{2,70}$/.test(job.id),'Invalid official job identifier '+id);
  assert(!ids.has(id),'Duplicated source ID '+id);ids.add(id);
  const u=new URL(job.url),e=new URL(job.evidenceUrl);
  assert.equal(u.protocol,'https:');assert.equal(e.protocol,'https:');
  assert.equal(u.hostname,portal.hostname,'Job link cannot redirect to unreviewed host: '+id);
  assert(!u.username&&!u.password&&!u.port,'Credentials and nonstandard ports blocked: '+id);
  assert(!u.hash||(u.hostname==='app.mokahr.com'&&u.hash==='#/'&&u.href===p.recruitment.url),
    'Only exact pinned Moka #/ SPA landing routes can contain fragments: '+id);
  if(u.hash)hashRoutes++;
  assert(job.title&&job.summary&&job.requirements&&job.recruitmentSubject);
  assert(job.currentOpenVerified===false,'Unverified posts cannot be claimed open');
  total++;
 }
}
const minieye=JSON.parse(readFileSync(root+'/cn-autumn-035.json','utf8'));
const yingTong=JSON.parse(readFileSync(root+'/cn-autumn-047.json','utf8'));
assert(minieye.jobs.some(j=>j.id==='MJ000950'),'Screenshot source example must remain with ORIGINAL uppercase job ID');
assert(yingTong.jobs.some(j=>j.id==='rd'),'Short authentic role ID must remain stable');
const integrity=readFileSync('src/services/domesticRebuildJobs.ts','utf8');
const gate=readFileSync('src/services/employerProfiles.ts','utf8');
assert(integrity.includes('[A-Za-z0-9-]{2,70}'),'Integrity gate must support real IDs instead of halting entire market');
assert(gate.includes("u.hash==='#/'")&&gate.includes('u.href===record.profile.recruitment.url'),
 'Pinned exact ATS hash route only; do not disable origin/source validation');
assert(gate.includes('record.job.url!==url')&&gate.includes("u.hostname.toLowerCase()===new URL(record.profile.recruitment.url).hostname.toLowerCase()"));
assert(total>250,'Whole existing job source library, not just example #35, must be audited');
console.log('HHBA_RECRUITMENT_SOURCE_GATE_OK',{employers:files.length,jobs:total,mokaHashRoutes:hashRoutes});
