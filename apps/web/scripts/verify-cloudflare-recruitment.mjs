// Build-time regression guard: a static Pages deployment must contain
// the three matched, source-audited job JSON files plus archived/curated data.
// Prevent a green Cloudflare deploy whose /data/*.json routes become HTML.
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {officialLink} from '../../../ops/jobs-indexer/catalog.mjs';
import {MIN_SUCCESSFUL_BOARDS,MIN_VERIFIED_JOBS} from './prepare-pages-jobs.mjs';
const root=resolve('dist');
async function json(path) {
  const file=resolve(root,path);
  assert(file.startsWith(root+'/'),'unsafe path');
  const metadata=await stat(file);
  assert(metadata.size>100, 'empty recruitment artifact '+path);
  const raw=await readFile(file,'utf8');
  assert(!/^\s*</.test(raw), 'HTML served as job JSON '+path);
  try {return JSON.parse(raw);}catch{throw new Error('Malformed job JSON '+path);}
}
const snapshot=await json('data/jobs.json');
const audit=await json('data/job-sync-status.json');
const facets=await json('data/job-search-facets.json');
const archived=await json('curated/v1/jobs.json');
assert(Array.isArray(snapshot.jobs)&&snapshot.jobs.length>=MIN_VERIFIED_JOBS&&snapshot.jobs.length<=20000,
 'too few independently verified current official jobs');
assert.equal(snapshot.total,snapshot.jobs.length,'published jobs count mismatch');
assert(Number.isInteger(snapshot.boards)&&snapshot.boards>=MIN_SUCCESSFUL_BOARDS,
 'insufficient successfully checked official ATS boards');
assert(Number.isInteger(snapshot.failures)&&snapshot.failures>=0,'unreported index failures');
assert(Number.isInteger(snapshot.configured_boards)&&
 snapshot.configured_boards===snapshot.boards+snapshot.failures,'board health totals inconsistent');
assert(Array.isArray(snapshot.source_failures)&&snapshot.source_failures.length===snapshot.failures,
 'source failures must be disclosed, not labelled as zero');
assert(snapshot.source_failures.every(x=>x&&typeof x.platform==='string'&&
 typeof x.source==='string'&&typeof x.reason==='string'),'source failure health details invalid');
const indexIds=new Set();
for(const job of snapshot.jobs){
 assert(job&&typeof job.id==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(job.id)&&
   !indexIds.has(job.id),'duplicate or invalid job ID');
 indexIds.add(job.id);
 assert(['greenhouse','ashby','lever'].includes(job.platform),'unsupported ATS platform');
 assert(job.id.startsWith(job.platform+'-'+job.source+'-'),'untraceable source job ID');
 const parsed=new URL(job.url);
 assert(parsed.protocol==='https:'&&!parsed.port&&!parsed.username&&!parsed.password,
   'unsafe official URL');
 assert(officialLink(job.url,{platform:job.platform,slug:job.source})===job.url,
   'job link not on its official source board');
 const observed=Date.parse(job.observedAt);
 assert(Number.isFinite(observed)&&observed<=Date.now()+5*60000&&
   Date.now()-observed<24*3600_000,'unverified or stale per-job observation');
 assert(job.currentApplicationVerified===false,'cannot claim employer application availability');
}
assert(Number.isFinite(Date.parse(snapshot.updated)),'missing snapshot date');
assert(Date.now()-Date.parse(snapshot.updated)<24*3600_000,'stale snapshot must not publish as live');
assert(Date.parse(snapshot.updated)<=Date.now()+5*60000,'future-dated snapshot');
assert(audit.summary?.indexed_as_of===snapshot.updated,'audit and snapshot mismatch');
assert(audit.summary?.total_indexed_jobs===snapshot.jobs.length,'job-count mismatch');
assert(audit.jobs?.length===snapshot.jobs.length,'audit count mismatch');
assert(facets.indexed_as_of===snapshot.updated,'search facets and snapshot mismatch');
assert(facets.total_indexed_jobs===snapshot.jobs.length,'facet job count mismatch');
assert(Array.isArray(facets.jobs),'missing search facets');
assert(Array.isArray(archived.jobs)&&archived.jobs.length>=100,'missing historical overseas archive');
console.log('HHBA_CLOUDFLARE_JOB_MARKET_READY',JSON.stringify({
  jobs:snapshot.total,checked:audit.jobs.length,facets:facets.jobs.length,
  overseasArchive:archived.jobs.length,successfulBoards:snapshot.boards,
  failedBoards:snapshot.failures,updated:snapshot.updated
}));
