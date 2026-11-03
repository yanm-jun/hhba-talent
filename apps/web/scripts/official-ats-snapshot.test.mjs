import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {endpoint} from '../../../ops/jobs-indexer/catalog.mjs';
import {normalizeOfficialJobs,buildOfficialSnapshot,MIN_SUCCESSFUL_BOARDS,MIN_VERIFIED_JOBS} from './prepare-pages-jobs.mjs';
import {auditSnapshot} from './audit-all-official-jds.mjs';

const registry=JSON.parse(readFileSync(new URL('../../../ops/jobs-indexer/boards.json',import.meta.url),'utf8'));
const boards=registry.boards.slice(0,10);
function fixture(board,n=6){
 const jobs=Array.from({length:n},(_,i)=>{
  const id=String(65432100+i),title='Verified job '+String(i+1);
  const u=board.platform==='greenhouse'?'https://job-boards.greenhouse.io/'+board.slug+'/jobs/'+id:
    board.platform==='ashby'?'https://jobs.ashbyhq.com/'+board.slug+'/'+id:
    'https://jobs.lever.co/'+board.slug+'/'+id;
  return {id,title,text:title,absolute_url:u,jobUrl:u,hostedUrl:u,
    location:{name:'Remote'},categories:{location:'Remote'}};
 });
 return board.platform==='lever'?jobs:{jobs};
}
function mockRemote(failingSlugs=new Set()){
 const byEndpoint=new Map(boards.map(b=>[endpoint(b),b]));
 return async url=>{
  const board=byEndpoint.get(url);
  assert.ok(board,'unexpected URL or unofficial source '+url);
  const down=failingSlugs.has(board.slug);
  return {ok:!down,status:down?404:200,headers:{get:()=> 'application/json'},
    text:async()=>JSON.stringify(fixture(board))};
 };
}

test('official sources produce fresh per-job identifiers and a transparent incomplete-board count',async()=>{
 const down=new Set([boards[0].slug]);
 const feed=await buildOfficialSnapshot(boards,{fetchFn:mockRemote(down),workerCount:3});
 assert.equal(feed.boards,9);
 assert.equal(feed.failures,1);
 assert.equal(feed.configured_boards,10);
 assert.equal(feed.source_failures.length,1);
 assert.equal(feed.source_failures[0].source,boards[0].slug);
 assert.equal(feed.total,54);
 assert.ok(feed.total>=MIN_VERIFIED_JOBS&&feed.boards>=MIN_SUCCESSFUL_BOARDS);
 assert.equal(feed.jobs.every(j=>j.id.startsWith(j.platform+'-'+j.source+'-')),true);
 assert.equal(feed.jobs.every(j=>j.url.startsWith('https://')&&j.currentApplicationVerified===false),true);
 assert.equal(feed.jobs.every(j=>!('titleZh' in j)&&!('locationZh' in j)),true,'do not invent Chinese translations');
 const audit=await auditSnapshot(feed,{fetchFn:async url=>{
  const b=boards.find(b=>url.includes('/'+b.slug));
  return {ok:true,headers:{get:()=>null},json:async()=>fixture(b)};
 }});
 assert.equal(audit.summary.total_indexed_jobs,54);
 assert.equal(audit.summary.index_source_failures,1);
 assert.equal(audit.summary.index_successful_boards,9);
});

test('reject malformed and non-official links, hidden talent pools and unsafe records',()=>{
 const board=boards.find(b=>b.platform==='greenhouse');
 const valid=fixture(board).jobs[0];
 const unsafe={...valid,absolute_url:'https://evil.example/'+board.slug+'/jobs/65432100'};
 assert.equal(normalizeOfficialJobs(board,{jobs:[valid,unsafe]} ,new Date().toISOString()).length,1);
 assert.throws(()=>normalizeOfficialJobs(board,{jobs:[{...valid,title:'General Application'}]},new Date().toISOString()),/NO_VALID_OFFICIAL_JOB_URLS/);
 assert.throws(()=>normalizeOfficialJobs(board,{jobs:[unsafe]},new Date().toISOString()),/NO_VALID_OFFICIAL_JOB_URLS/);
});

test('fails closed when the true ATS coverage is insufficient rather than using fabricated/stale jobs',async()=>{
 const down=new Set(boards.slice(0,4).map(x=>x.slug));
 await assert.rejects(buildOfficialSnapshot(boards,{fetchFn:mockRemote(down)}),/OFFICIAL_SOURCE_COVERAGE_INSUFFICIENT/);
 const script=readFileSync(new URL('./prepare-pages-jobs.mjs',import.meta.url),'utf8');
 assert.ok(!script.includes('up.railway.app'));
});

test('frontend displays official English title/location when translation is absent',()=>{
 const source=readFileSync(new URL('../src/services/liveRecruitment.ts',import.meta.url),'utf8');
 assert.ok(source.includes("return original || '职位名称待核验';"));
 assert.ok(source.includes("if(lang==='zh')return zh&&han.test(zh)?zh:original||'地点待核验';"));
});
