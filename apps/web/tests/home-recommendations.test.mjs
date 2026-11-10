import test from 'node:test';
import assert from 'node:assert/strict';
import {rankHomeJobs,HOME_RECOMMENDATION_VERSION} from '../src/services/homeRecommendations.ts';
import {coSavedJobs} from '../functions/_lib/recommendation-collab.js';
const job=(id,title,company='A',extra={})=>({
 id,domestic:true,title,titleZh:title,company,location:'上海',locationZh:'上海',
 recruitmentType:'SOCIAL',currentApplicationVerified:true,...extra
});
test('Different roles get different rankings and relevant explanation',()=>{
 const jobs=[job('j1','软件开发工程师'),job('j2','视觉设计师','B')];
 const a=rankHomeJobs(jobs,{preferred_role:'软件开发'},new Set(),new Map());
 const b=rankHomeJobs(jobs,{preferred_role:'视觉设计'},new Set(),new Map());
 assert.equal(a[0].job.id,'j1');
 assert.equal(b[0].job.id,'j2');
 assert.match(a[0].reasons.join(' '),/岗位方向/);
 assert.equal(HOME_RECOMMENDATION_VERSION,'HHBA_HOME_HYBRID_V1');
});
test('Domestic-only, saved job suppression, stage switch and company diversity',()=>{
 const jobs=[job('a','数据分析','AA',{domestic:false}),
 job('b','产品经理','BB',{recruitmentType:'INTERNSHIP'}),
 job('c','算法实习生','BB',{recruitmentType:'INTERNSHIP'}),
 job('d','软件实习生','BB',{recruitmentType:'INTERNSHIP'}),
 job('e','行政管理','CC',{recruitmentType:'SOCIAL'})];
 const ranked=rankHomeJobs(jobs,null,new Set(['b']),new Map(),'INTERNSHIP');
 assert.deepEqual(new Set(ranked.map(x=>x.job.id)),new Set(['c','d']));
 assert.equal(ranked.length,2);
 assert.equal(ranked.some(x=>x.job.company==='AA'),false);
});
test('Collaboration remains off without explicit consent',async()=>{
 let sqlCalls=0;
 const db={prepare(sql){sqlCalls++;return {bind(){return {first:async()=>({enabled:0}),all:async()=>({results:[]})}}}}};
 assert.deepEqual(await coSavedJobs(db,'test-user'),{mode:'CONTENT_ONLY',jobs:[]});
 assert.equal(sqlCalls,1);
});
test('Collaborative results require opted-in peer query with a three-peer threshold',async()=>{
 const sql=[];
 const db={prepare(query){
  sql.push(query);
  return {bind(){return {
   first:async()=>({enabled:1}),
   all:async()=>({results:sql.length===2?[{job_id:'saved-1'}]:[{jobId:'recommended-1',supporters:3}]})
  }}};
 }};
 const result=await coSavedJobs(db,'test-user');
 assert.equal(result.mode,'COLLABORATIVE_READY');
 assert.deepEqual(result.jobs,[{id:'recommended-1',score:3}]);
 assert.match(sql[2],/consent.enabled=1/);
 assert.match(sql[2],/COUNT\(DISTINCT peer.phone\)>=3/);
 assert.ok(!('phone' in result.jobs[0]));
});

test('Selected major ranks documented related roles ahead of unrelated roles',()=>{
 const jobs=[job('a','通用分析师','A',{majorNames:['金融学']}),job('b','计算机技术专员','B',{majorNames:['计算机科学与技术']})];
 const ranked=rankHomeJobs(jobs,null,new Set(),new Map(),'all',8,'computer-science');
 assert.equal(ranked[0].job.id,'b');
 assert.match(ranked[0].reasons.join(' '),/专业/);
});
