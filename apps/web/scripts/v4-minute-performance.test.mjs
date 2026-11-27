import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {v4MinuteSamples,recordV4MinuteOps,readV4MinuteOps} from '../functions/_lib/v4-minute-performance.js';
const sql=readFileSync(new URL('../d1/20261127_v4_minute_ops.sql',import.meta.url),'utf8');
function fixture(){
 const local=new DatabaseSync(':memory:');local.exec(sql);
 const db={prepare(q){return {bind(...args){return {
  async run(){const r=local.prepare(q).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},
  async all(){return {results:local.prepare(q).all(...args)};}
 }}}}};
 return {local,db};
}
test('real per-minute throughput separates search from independently completed JD, score and report',async()=>{
 const {db,local}=fixture(),start=Date.parse('2026-11-27T04:05:15Z');
 const phase=[
  {kind:'candidate',url:'https://careers.private.example/1',at:start},
  {kind:'candidate',url:'https://careers.private.example/2',at:start+25000},
  {kind:'jd',url:'https://careers.private.example/1',at:start+60000},
  {kind:'report',at:null},
  {kind:'score',at:start+120000}
 ];
 const samples=v4MinuteSamples(phase,{source:'phase'});
 assert.equal(samples.reduce((v,x)=>v+x.events,0),4,'untimed report must not be counted in an invented minute');
 assert.ok(!JSON.stringify(samples).includes('careers.private.example'));
 assert.equal(await recordV4MinuteOps(db,phase,{source:'phase'}),true);
 assert.equal(await recordV4MinuteOps(db,[{kind:'jd',at:start+60000},{kind:'score',at:start+60000},{kind:'report',at:start+150000}],{source:'independent'}),true);
 const rows=(await readV4MinuteOps(db,'2026-11-27','2026-11-27')).rows;
 const by=(minute,source)=>rows.find(x=>x.minute_utc===minute&&x.source===source);
 assert.equal(by('2026-11-27T04:05Z','phase').candidates,2);
 assert.equal(by('2026-11-27T04:06Z','phase').jds,1);
 assert.equal(by('2026-11-27T04:06Z','independent').jds,1);
 assert.equal(by('2026-11-27T04:06Z','independent').scores,1);
 assert.equal(by('2026-11-27T04:07Z','independent').reports,1);
 assert.equal(local.prepare('SELECT COUNT(*) n FROM hhba_v4_minute_ops').get().n,6);
});
test('no records, missing database and no observed timestamp are reported explicitly',async()=>{
 const {db}=fixture();
 assert.equal((await readV4MinuteOps(db,'2026-11-27','2026-11-27')).quality,'no_records');
 assert.equal((await readV4MinuteOps(null,'2026-11-27','2026-11-27')).quality,'unavailable');
 assert.equal(v4MinuteSamples([{kind:'jd'}]).length,0);
 assert.equal(v4MinuteSamples([{kind:'profile',at:Date.now()}]).length,0);
});
test('admin metrics are session-protected and token cost is never guessed',()=>{
 const route=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 const match=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 assert.ok(route.indexOf('await verifyAdmin(request,env)')<route.indexOf('readV4MinuteOps(db,since,until)'));
 assert.ok(match.includes('await recordV4MinuteOps(env.HHBA_METRICS_DB,newEvidence'));
 assert.ok(match.includes("{source:'independent'}"));
 assert.ok(admin.includes('renderV4MinuteOps()'));
 assert.ok(page.includes('id="v4-minute-ops-details"'));
 assert.ok(page.includes('id="ai-usage-total"'));
});
