import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSnapshot,compareFeeds,compareAudits} from './audit-all-official-jds.mjs';
const clock=Date.parse('2026-10-19T09:00:00Z');
const greenhouse=(id,more={})=>({
 id:'greenhouse-airtable-'+id,platform:'greenhouse',source:'airtable',company:'Airtable',
 title:'Software Engineer',location:'Remote',url:'https://job-boards.greenhouse.io/airtable/jobs/'+id,domestic:false,
 ...more
});
const lever=(id)=>({id:'lever-spotify-'+id,platform:'lever',source:'spotify',company:'Spotify',
 title:'Data Engineer',location:'New York',url:'https://jobs.lever.co/spotify/'+id,domestic:false});
const ashby=(id)=>({id:'ashby-openai-'+id,platform:'ashby',source:'openai',company:'OpenAI',
 title:'Research Engineer',location:'San Francisco',url:'https://jobs.ashbyhq.com/openai/'+id,domestic:false});
const records=[greenhouse('11'),greenhouse('12'),greenhouse('13'),lever('abc'),ashby('de'),{
 id:'xiaomi-S-123123123123',platform:'xiaomi-official',source:'SOCIAL',company:'Xiaomi',title:'Sales',
 location:'济南',url:'https://xiaomi.jobs.f.mioffice.cn/index/',domestic:true}];
const snapshot={jobs:records,total:records.length,failures:0,updated:'2026-10-19T08:35:00Z',boards:3};
const fixtures={
 greenhouse:[
   {id:11,title:'Software Engineer',absolute_url:'https://job-boards.greenhouse.io/airtable/jobs/11',
    content:'<h3>Responsibilities</h3><ul><li>Build application systems and develop reliable customer experiences.</li></ul><h3>Qualifications</h3><p>5 years of experience. Proficiency in TypeScript, React and software architecture, with strong teamwork and design skills.</p>'},
   {id:12,title:'Software Engineer',absolute_url:'https://job-boards.greenhouse.io/airtable/jobs/12',
    content:'<h3>Responsibilities</h3><p>Work closely with team members to deliver successful customer experiences, solve problems, and perform regular product reviews.</p>'},
 ],
 lever:[{id:'abc',text:'Data Engineer',hostedUrl:'https://jobs.lever.co/spotify/abc',
    description:'Role: we are building a new platform. Responsibilities: improve data pipelines and design reports.',
    lists:[{text:'Requirements',content:'SQL, Python and at least three years of technical experience and teamwork.'}]}],
 ashby:{jobs:[{id:'de',title:'Research Engineer',jobUrl:'https://jobs.ashbyhq.com/openai/de',descriptionHtml:
 '<h3>Requirements</h3><p>Research and engineering experience with Python. Build systems, collaborate with people and conduct scientific experiments on large scale models.</p>'}]}
};
const calls=[];
const fetchFn=async(url)=>{
 calls.push(String(url));
 const u=String(url);
 let body;
 if(u.includes('greenhouse'))body={jobs:fixtures.greenhouse};
 else if(u.includes('lever.co'))body=fixtures.lever;
 else if(u.includes('ashbyhq'))body=fixtures.ashby;
 else throw Error('UNKNOWN_FIXTURE');
 return {ok:true,headers:{get:()=>''},json:async()=>body};
};
test('checks every indexed record against grouped official board APIs, not sample records',async()=>{
 calls.length=0;
 const {summary,jobs,source_failures}=await auditSnapshot(snapshot,{fetchFn,now:clock});
 assert.equal(summary.total_indexed_jobs,6);
 assert.equal(jobs.length,6);
 assert.equal(summary.official_ats_boards_checked,3);
 assert.equal(calls.length,3,'batch official ATS requests by board');
 assert.equal(jobs[0].status,'OFFICIAL_JD_AND_REQUIREMENTS_FOUND');
 assert.equal(jobs[0].full_original_jd_verified,true);
 assert.equal(jobs[0].search.cityKey,null,'missing city must stay unknown');
 assert.equal(jobs[0].search.education,null,'unmentioned degree must stay unknown');
 assert.equal(jobs[0].search.experienceMinYears,5);
 assert.ok(jobs[0].search.skills.includes('typescript'));
 assert.ok(jobs[0].search.skills.includes('react'));
 assert.equal(jobs[2].search,undefined,'missing official JD must not emit requirements metadata');

 assert.match(jobs[0].jd_sha256,/^[a-f0-9]{64}$/);
 assert.equal(jobs[1].status,'OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED');
 assert.equal(jobs[2].status,'MISSING_FROM_OFFICIAL_BOARD');
 assert.equal(jobs[3].full_original_jd_verified,true);
 assert.equal(jobs[4].full_original_jd_verified,true);
 assert.equal(jobs[5].status,'DOMESTIC_CHANNEL_ONLY');
 assert.equal(summary.verified_complete_chinese_jd,0);
 assert.equal(summary.blocked_and_incomplete,3);
 assert.equal(source_failures.length,0);
 assert.ok(!('raw_jd' in jobs[0]),'never write copyrighted JD into report');
});
test('fails closed on old or partial source snapshots',async()=>{
 await assert.rejects(auditSnapshot({...snapshot,failures:1},{fetchFn,now:clock}),/INVALID_OR_INCOMPLETE/);
 await assert.rejects(auditSnapshot({...snapshot,updated:'2026-10-18T01:00:00Z'},{fetchFn,now:clock}),/NOT_RECENT/);
});
test('failed board leaves affected jobs marked instead of silently reporting complete',async()=>{
 const {summary,jobs,source_failures}=await auditSnapshot(snapshot,{now:clock,retries:0,
   fetchFn:async(url)=>{
     if(String(url).includes('ashby'))throw Error('HTTP_429');
     return fetchFn(url);
   }});
 assert.equal(summary.official_ats_board_failures,1);
 assert.equal(jobs[4].status,'OFFICIAL_SOURCE_READ_FAILED');
 assert.equal(source_failures[0].affected_jobs,1);
});
test('tracks added, disappeared, changed IDs but does not equate missing with confirmed closed',()=>{
 const prev={jobs:[{...greenhouse('11'),title:'Old'},{...greenhouse('14')}]};
 const now={jobs:[greenhouse('11'),greenhouse('15')]};
 const x=compareFeeds(prev,now);
 assert.equal(x.added,1);
 assert.equal(x.absent_from_current_feed,1);
 assert.equal(x.changed,1);
 assert.deepEqual(x.absent_ids,['greenhouse-airtable-14']);
});

test('compares exact official JD hashes instead of relying on list title changes',()=>{
 const previous={jobs:[
 {job_id:'j1',jd_sha256:'old-hash',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND'},
 {job_id:'j2',jd_sha256:'same',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND'},
 ]};
 const current={jobs:[
 {job_id:'j1',jd_sha256:'new-hash',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND'},
 {job_id:'j2',jd_sha256:'same',status:'OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED'},
 {job_id:'j3',jd_sha256:'third',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND'},
 ]};
 const changes=compareAudits(previous,current);
 assert.equal(changes.jd_content_changes,1);
 assert.equal(changes.status_changes,1);
 assert.equal(changes.newly_audited,1);
 assert.deepEqual(changes.jd_content_changed_ids,['j1']);
});
