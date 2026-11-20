// Real SQLite + Cloudflare-style D1 adapter: no actual candidate data or API spend.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
 AGENT_SKILL_IDS,readAgentPolicy,changeAgentPolicy,validateAgentPolicyChange,
 recordAnonymousAgentRun,readAnonymousAgentRunSummary
} from '../functions/_lib/candidate-agent-policy.js';

function isolatedDb(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../d1/0031_candidate_agent_policy.sql',import.meta.url),'utf8'));
 function prepared(query,args=[]){
  const p=sql.prepare(query);
  return {bind:(...x)=>prepared(query,x),
   async first(){return p.get(...args)??null},
   async all(){return {success:true,results:p.all(...args)}},
   async run(){const r=p.run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
  };
 }
 const db={
  prepare:query=>prepared(query),
  async batch(stmts){
   sql.exec('BEGIN IMMEDIATE');
   try{const rs=[];for(const s of stmts)rs.push(await s.run());sql.exec('COMMIT');return rs;}
   catch(e){sql.exec('ROLLBACK');throw e;}
  }
 };
 return {db,sql};
}

test('migration initializes a disabled, explicit policy without candidate data',async()=>{
 const {db,sql}=isolatedDb();
 const first=await readAgentPolicy(db);
 assert.equal(first.configured,true);
 assert.equal(first.enabled,false);
 assert.equal(first.revision,1);
 assert.deepEqual(first.skills,AGENT_SKILL_IDS);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_agent_runs').get().n,0);
 sql.close();
});

test('admin revision CAS and audit are atomic; stale concurrent update rejected',async()=>{
 const {db,sql}=isolatedDb();
 const payload={enabled:true,skills:[...AGENT_SKILL_IDS],expectedRevision:1};
 const updated=await changeAgentPolicy(db,payload);
 assert.equal(updated.revision,2);
 assert.equal((await readAgentPolicy(db)).enabled,true);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_agent_policy_audit').get().n,1);
 await assert.rejects(changeAgentPolicy(db,{...payload,enabled:false}),/AGENT_POLICY_CONFLICT/);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_agent_policy_audit').get().n,1);
 const paused=await changeAgentPolicy(db,{...payload,enabled:false,expectedRevision:2});
 assert.equal(paused.revision,3);
 assert.equal((await readAgentPolicy(db)).enabled,false);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_agent_policy_audit').get().n,2);
 sql.close();
});

test('invalid, unknown, duplicated or incomplete active skills are rejected',()=>{
 for(const value of [
  {enabled:true,skills:['resume_evidence'],expectedRevision:1},
  {enabled:true,skills:[...AGENT_SKILL_IDS,'shell_access'],expectedRevision:1},
  {enabled:true,skills:['fit_scoring','fit_scoring'],expectedRevision:1},
  {enabled:false,skills:[],expectedRevision:1},
  {enabled:true,skills:[...AGENT_SKILL_IDS],expectedRevision:0},
  {enabled:true,skills:[...AGENT_SKILL_IDS],expectedRevision:1,secret:'no'},
 ]){
  assert.throws(()=>validateAgentPolicyChange(value),/AGENT_POLICY_INVALID/);
 }
});

test('missing/malformed D1 policy refuses to enable the Agent',async()=>{
 assert.equal((await readAgentPolicy(null)).enabled,false);
 const {db,sql}=isolatedDb();
 sql.exec("UPDATE hhba_candidate_agent_policy SET skills_json='not json' WHERE id='default'");
 const read=await readAgentPolicy(db);
 assert.equal(read.enabled,false);
 assert.equal(read.reason,'CORRUPT_POLICY');
 sql.close();
});

test('anonymous execution logging stores status/aggregates, never CV or URL',async()=>{
 const {db,sql}=isolatedDb();
 assert.equal(await recordAnonymousAgentRun(db,{
   status:'complete',skills:3,matchedCount:4,elapsedMs:1320
 }),true);
 assert.equal(await recordAnonymousAgentRun(db,{
   status:'failed',skills:1,matchedCount:0,elapsedMs:900
 }),true);
 const report=await readAnonymousAgentRunSummary(db);
 assert.equal(report.counters.find(x=>x.status==='complete').count,1);
 assert.equal(report.counters.find(x=>x.status==='failed').count,1);
 assert.equal(report.recent.length,2);
 assert.doesNotMatch(JSON.stringify(report),/电话|简历|手机号|@|https?:\/\//);
 sql.close();
});
