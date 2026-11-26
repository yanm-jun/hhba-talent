import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createV4SearchSpeedTracker,recordV4SearchSpeed,readV4SearchSpeed,V4_SEARCH_MILESTONES} from '../functions/_lib/v4-search-speed.js';

const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const job=i=>({company:'真实公司'+i,title:'区域运营岗位',location:'上海',official_url:'https://careers.company'+i+'.cn/positions/'+i});
function database(){
 const raw=new DatabaseSync(':memory:');
 raw.exec(readFileSync(new URL('../d1/20261127_v4_search_speed_runs.sql',import.meta.url),'utf8'));
 return {raw,cloud:{prepare(sql){return {bind(...params){return {
  async run(){const r=raw.prepare(sql).run(...params);return {success:true,changes:r.changes}},
  async all(){return {results:raw.prepare(sql).all(...params)}}
 };}}}}};
}

test('observed, deduplicated 1/50/100/300/500 milestones survive task continuation',()=>{
 let time=100000;
 const tracker=createV4SearchSpeedTracker({now:()=>time,newId:()=>ID});
 assert.equal(tracker.snapshot().observed_unique,0);
 time+=1500;
 assert.equal(tracker.observe(job(1)),true);
 assert.equal(tracker.observe(job(1)),false);
 assert.equal(tracker.snapshot().milestones[1],1500);
 for(let i=2;i<=49;i++)tracker.observe(job(i));
 time+=3500;
 tracker.observe(job(50));
 assert.equal(tracker.snapshot().milestones[50],5000);
 const previous=tracker.snapshot();
 const resume=createV4SearchSpeedTracker({previous,savedJobs:Array.from({length:50},(_,i)=>job(i+1)),now:()=>time+9000,newId:()=>{throw Error('run ID must persist')}});
 assert.equal(resume.snapshot().run_id,ID);
 assert.equal(resume.snapshot().milestones[1],1500);
 assert.equal(resume.observe(job(50)),false);
 for(let i=51;i<=500;i++)resume.observe(job(i));
 const later=resume.snapshot();
 assert.deepEqual(V4_SEARCH_MILESTONES,[1,50,100,300,500]);
 assert.deepEqual(Object.keys(later.milestones).map(Number),V4_SEARCH_MILESTONES);
 assert.equal(later.observed_unique,500);
 assert.equal(later.milestones[50],5000);
 assert.equal(later.milestones[100],14000);
 assert.equal(later.milestones[500],14000);
 assert.doesNotMatch(JSON.stringify(later),/company|position|真实公司|上海|简历/i);
});

test('existing results have no invented first-milestone arrival time',()=>{
 const tracker=createV4SearchSpeedTracker({savedJobs:[job(1)],now:()=>30000,newId:()=>ID});
 assert.equal(tracker.snapshot().observed_unique,1);
 assert.equal(tracker.snapshot().milestones[1],undefined);
 tracker.observe(job(2));
 assert.equal(tracker.snapshot().milestones[1],undefined);
 assert.equal(tracker.snapshot().observed_unique,2);
 assert.equal(tracker.observe({...job(4),location:'未知'}),false);
 assert.equal(tracker.observe({...job(5),official_url:'http://localhost/x'}),false);
});

test('anonymous D1 task observations upsert idempotently and show no fake 500 timing',async()=>{
 const {raw,cloud}=database();
 const tracker=createV4SearchSpeedTracker({now:()=>1000,newId:()=>ID});
 tracker.observe(job(1));
 const first=tracker.snapshot();
 assert.equal(await recordV4SearchSpeed(cloud,first,'CONTINUE',5000),true);
 assert.equal(await recordV4SearchSpeed(cloud,first,'CONTINUE',5000),true);
 let observed=await readV4SearchSpeed(cloud,'1970-01-01','1970-01-01');
 assert.equal(observed.runs,1);
 assert.equal(observed.milestones[0].samples,1);
 assert.equal(observed.milestones.at(-1).samples,0);
 assert.equal(observed.milestones.at(-1).averageMs,null);
 assert.equal(observed.completed,0);
 const progressed={...first,observed_unique:50,milestones:{1:0,50:8500}};
 await recordV4SearchSpeed(cloud,progressed,'COMPLETE',12000);
 await recordV4SearchSpeed(cloud,first,'RETRYABLE_FAILURE',13000);
 observed=await readV4SearchSpeed(cloud,'1970-01-01','1970-01-01');
 assert.equal(observed.completed,1);
 assert.equal(observed.milestones[1].averageMs,8500);
 assert.equal(observed.milestones[1].reachRatePct,100);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM hhba_v4_search_speed_runs').get().n,1);
 const row=raw.prepare('SELECT * FROM hhba_v4_search_speed_runs').get();
 assert.equal(row.status,'COMPLETE');
 assert.ok(!JSON.stringify(row).includes('careers.company'));
 assert.equal((await readV4SearchSpeed(cloud,'1970-01-02','1970-01-02')).quality,'no_records');
 assert.equal((await readV4SearchSpeed({},'1970-01-01','1970-01-01')).quality,'unavailable');
});

test('the production matching route owns the actual milestone publication and private admin reader',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 const simple=readFileSync(new URL('../functions/_lib/simple-match-v4.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 assert.match(route,/const searchSpeed=createV4SearchSpeedTracker\(/);
 assert.match(route,/searchSpeed:searchSpeed\.snapshot\(\)/);
 assert.match(route,/searchSpeed\.observe\(/);
 assert.match(route,/await recordV4SearchSpeed\(/);
 assert.match(api,/await verifyAdmin\(request,env\)/);
 assert.match(api,/v4SearchSpeed:await readV4SearchSpeed\(/);
 assert.match(html,/id="v4-search-speed-milestones"/);
 const lane= simple.split("const lane=async lane=>")[1].split("tools:[{type:'web_search'}]")[0];
 assert.ok(lane.includes('discoveryLaneContext'));
 assert.ok(!lane.includes('resume_text:resume'),'secondary discovery gets the grounded profile, not a repeated raw CV');
 assert.match(simple,/createLiveVerificationCoordinator\(/);
});
