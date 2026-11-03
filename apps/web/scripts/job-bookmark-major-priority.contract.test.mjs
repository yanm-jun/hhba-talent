import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('every unified list and detail job uses the same save component',()=>{
 const market=read('src/components/UnifiedJobMarket.tsx');
 const buttons=market.match(/<SaveJobButton jobId=\{job\.id\}\/>/g)||[];
 assert.equal(buttons.length,2,'Both list card and detail must expose account bookmarks');
 assert.doesNotMatch(market,/job\.recordKind\s*!==\s*'DOMESTIC_REBUILT'\s*&&\s*<SaveJobButton/,
  'Future domestic records must never be excluded from saving');
 assert.doesNotMatch(read('src/components/SaveJobButton.tsx'),/if\(!savedAvailable\)return null/,
  'Even unauthenticated and GitHub preview users should see a login-gated save action');
});
test('selected or typed major is ranked across the entire filtered list before pagination',()=>{
 const list=read('src/services/liveRecruitment.ts');
 const match=read('src/services/majorJobMatching.ts');
 const start=list.indexOf('export async function listDomesticRebuildMarket');
 const next=list.indexOf('export async function listJobs',start);
 const section=list.slice(start,next);
 const filter=section.indexOf('const allowed=combined.filter');
 const ranking=section.indexOf('allowed.sort(');
 const pagination=section.indexOf('jobs:allowed.slice(offset,offset+30)');
 assert(filter>=0&&ranking>filter&&pagination>ranking,
  'Ranking must precede batching, or unrestricted roles win page one');
 assert.match(section,/majorSlugForQuery\(filters\.q\)/);
 assert.match(list,/const relevant=major\?matches\.rows\.filter/);
 assert.match(list,/relevant\.sort\(/);
 assert.match(match,/if\(fields\.some\(x=>equivalent\(x,chosen\.name\)\)\)return 'related'/);
 assert.match(match,/if\(job\.majorUnrestricted===true/);
 assert(match.indexOf("return 'related';")<match.indexOf("return 'unrestricted';"),
  'Known relevant subjects must rank ahead of unrestricted claims');
 assert.match(match,/majorExactEvidence/);
});
test('real account API verifies source-built domestic and archived source indexes',()=>{
 const api=read('functions/api/account/[[path]].js');
 const generator=read('scripts/prepare-saveable-job-index.mjs');
 const packageJson=JSON.parse(read('package.json'));
 assert.match(api,/HHBA_SAVEABLE_DOMESTIC_JOBS_V1/);
 assert.match(api,/HHBA_CURATED_JOBS_V1/);
 assert.match(api,/JOB_NOT_IN_VERIFIED_INDEX/);
 assert.match(generator,/domesticV2Records/);
 assert.match(generator,/assertDomesticRebuildIntegrity/);
 assert.match(packageJson.scripts.prebuild,/prepare-saveable-job-index/);
});
