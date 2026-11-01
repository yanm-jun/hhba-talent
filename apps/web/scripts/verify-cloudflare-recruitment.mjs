// Build-time regression guard: a static Pages deployment must contain
// the three matched, source-audited job JSON files plus archived/curated data.
// Prevent a green Cloudflare deploy whose /data/*.json routes become HTML.
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
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
assert(Array.isArray(snapshot.jobs)&&snapshot.jobs.length>0&&snapshot.jobs.length<=20000);
assert(snapshot.total===snapshot.jobs.length&&snapshot.failures===0);
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
  overseasArchive:archived.jobs.length,updated:snapshot.updated
}));
