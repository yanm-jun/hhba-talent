import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
 cleanPeriodPayload,validPeriod,nowBeijing,priorMonth,isCurrentPublicationDay,
 publicReport,normalizeEmail,randomToken,sha256,unsubscribeToken,fromAddress
} from '../functions/_lib/transparency.js';
import {onRequest as publicApi} from '../functions/api/transparency/[[path]].js';
import {onRequestPost as dispatchApi,sendNextBatch} from '../functions/api/transparency/dispatch.js';
import {onRequest as retiredFinanceUI} from '../functions/transparency/manage.js';
import {publishReviewed} from '../functions/_lib/transparency-publish.js';
import financeCronWorker from '../ops/finance-cron-worker.mjs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const payload=(patch={})=>({
 period:'2026-10',revenueFen:100000,refundFen:4000,aiCostFen:13000,
 infrastructureFen:8000,personnelFen:17000,operationsFen:9000,taxesFen:5000,
 otherCostFen:4000,adjustmentsFen:0,netResultFen:40000,
 distributableProfitFen:0,openingPoolFen:0,poolReceivedFen:0,poolSpentFen:0,
 closingPoolFen:0,beneficiaries:0,basisNote:'已查看法定利润分配口径，不等同当月净利润。',
 methodNote:'实际账目、退款与第三方成本均以账簿核对为准。',
 poolNote:'本期未确认入池或实际支出，金额均需独立核对。',
 privacyReviewNote:'公开前已核实未披露个人身份及案件明细信息。',
 isAudited:false,...patch
});
test('validated monthly finance uses integer fen and never implies monthly income equals distributable profit',()=>{
 const data=cleanPeriodPayload(payload());
 assert.ok(data);
 assert.equal(data.netResultFen,40000);
 assert.equal(data.distributableProfitFen,0);
 assert.equal(data.poolAccrualFen,0);
 assert.equal(data.companyAllocationFen,0);
 assert.equal(cleanPeriodPayload(payload({refundFen:4999})),null,'inconsistent financial arithmetic must be rejected');
 assert.equal(cleanPeriodPayload(payload({revenueFen:10.5})),null,'no floating monetary fen');
 const loss=payload({revenueFen:10000,netResultFen:-50000});
 assert.equal(cleanPeriodPayload(loss).netResultFen,-50000,'real negative operating result must remain visible');
 const profit=cleanPeriodPayload(payload({distributableProfitFen:10001}));
 assert.equal(profit.poolAccrualFen,4000);
 assert.equal(profit.companyAllocationFen,6001);
 assert.equal(profit.poolAccrualFen+profit.companyAllocationFen,10001);
 assert.equal(cleanPeriodPayload(payload({closingPoolFen:500})),null,'opening + received - spent must equal closing');
});
test('dates are monthly in Beijing; publication never occurs early',()=>{
 assert.ok(validPeriod('2026-10'));assert.ok(!validPeriod('2026-13'));
 assert.deepEqual(nowBeijing(new Date('2026-11-20T16:00:00Z')),
 {year:2026,month:11,day:21,hour:0});
 assert.equal(priorMonth(new Date('2026-01-21T02:00:00Z')),'2025-12');
 assert.equal(isCurrentPublicationDay(new Date('2026-11-21T02:00:00Z')),true);
 assert.equal(isCurrentPublicationDay(new Date('2026-11-21T01:59:00Z')),false);
 assert.equal(isCurrentPublicationDay(new Date('2026-11-20T02:00:00Z')),false);
});
test('public API returns only published reports, not draft, and subscriptions fail closed',async()=>{
 assert.equal(publicReport({status:'draft',published_json:JSON.stringify(payload())}),null);
 assert.equal(publicReport({status:'reviewed',published_json:JSON.stringify(payload())}),null);
 assert.equal(publicReport({status:'published',period:'2026-10',revision:1,published_at:'2026-11-21T02:00:00Z',published_json:JSON.stringify(payload())}).period,'2026-10');
 const status=await publicApi({request:new Request('https://hhba.work/api/transparency/status'),env:{}});
 assert.equal(status.status,200);assert.equal((await status.json()).subscriptionEnabled,false);
 const list=await publicApi({request:new Request('https://hhba.work/api/transparency/reports'),env:{}});
 assert.deepEqual((await list.json()).reports,[]);
 const sub=await publicApi({request:new Request('https://hhba.work/api/transparency/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://hhba.work'},body:JSON.stringify({email:'a@example.com',consent:true})}),env:{}});
 assert.equal(sub.status,410);
});
test('no dispatch secret, unapproved report or admin identity can leak financial data',async()=>{
 const request=new Request('https://hhba.work/api/transparency/dispatch',{method:'POST'});
 const result=await dispatchApi({request,env:{}});
 assert.equal(result.status,401);
 assert.equal((await result.json()).code,'UNAUTHORIZED');
 const redirect=retiredFinanceUI({request:new Request('https://hhba.work/transparency/manage')});
 assert.equal(redirect.status,307);
 assert.equal(redirect.headers.get('Location'),'https://admin.hhba.work/admin-preview/');
 const pub=await publishReviewed({prepare:()=>{throw Error('should not publish');}},{period:'bad',actor:'bot'});
 assert.equal(pub.ok,false);
 const legacyAccess=read('../functions/_lib/admin-access.js');
 assert.match(legacyAccess,/if\(!fromOriginalAdmin&&!fromLegacyApi\)return/);
 assert.doesNotMatch(legacyAccess,/HHBA_FINANCE_ACCESS_AUD|fromFinance/);
});
test('newsletter email requires explicit opt-in, domain verification and recoverable HMAC unsubscribe token',async()=>{
 assert.equal(normalizeEmail(' Test@Example.Com '),'test@example.com');
 assert.equal(normalizeEmail('foo'),null);
 assert.equal(fromAddress({HHBA_FIN_FROM_EMAIL:'onboarding@resend.dev'}),null);
 assert.ok(/^[a-f0-9]{64}$/.test(randomToken()));
 const id=await sha256('test@example.com');
 const env={HHBA_FIN_UNSUBSCRIBE_SECRET:'example-secure-long-key-not-for-production-123456789'};
 const a=await unsubscribeToken(env,id),b=await unsubscribeToken(env,id);
 assert.equal(a,b);
 assert.equal(a?.length,64);
 assert.notEqual(a,id);
 assert.equal(await unsubscribeToken({},id),null);
 const pub=read('../functions/api/transparency/[[path]].js');
 assert.match(pub,/HUMAN_VERIFICATION_REQUIRED/);
 assert.match(pub,/last_verification_sent_at/);
 assert.match(pub,/status='verified'/);
 assert.match(pub,/status='unsubscribed'/);
 assert.match(pub,/email=NULL/);
});
test('the new brand wall is public and the old financial campaign is disconnected',()=>{
 const main=read('../src/main.tsx');
 const shell=read('../src/components/Shell.tsx');
 const home=read('../src/components/HomeWorkplacePromise.tsx');
 const sql=read('../d1/0020_financial_transparency.sql');
 const cron=read('../../../.github/workflows/hhba-finance-monthly-dispatch.yml');
 const worker=read('../ops/finance-cron-worker.mjs');
 assert.match(main,/route==='\/commitment'/);
 assert.match(main,/route\.startsWith\('\/transparency\/'\)/);
 assert.doesNotMatch(main,/TransparencyManagePage|return <TransparencyReportsPage/);
 assert.match(shell,/to="\/commitment"/);
 assert.match(home,/className="hhba-home-transparency-link" to="\/commitment"/);
 assert.doesNotMatch(home,/api\/transparency\/reports/);
 assert.match(sql,/hhba_fin_publication_revisions/);
 assert.match(sql,/hhba_fin_deliveries/);
 assert.doesNotMatch(worker,/fetch\(TARGET/);
 assert.match(worker,/HHBA_FIN_CRON_RETIRED_NO_ACTION/);
 assert.doesNotMatch(cron,/curl|HHBA_FIN_DISPATCH_SECRET/);
 assert.match(cron,/workflow_dispatch/);
});

test('editorial wall does not expose financial dashboard or obsolete policy',()=>{
 const wall=read('../src/pages/TransparencyPage.tsx');
 const css=read('../src/styles/commitment-wall.css');
 assert.match(wall,/commitmentGallery\.map/);
 assert.match(wall,/我们希望让信息更加清晰/);
 for(const old of ['workerDemoTotals','权益帮扶池','60%','40%','financial-allocation'])assert.ok(!wall.includes(old),old);
 assert.match(css,/@media\(max-width:720px\)/);
});

test('RFC 8058 one-click unsubscribe revokes a verified address without requiring a body token',async()=>{
 const token='b'.repeat(64);
 let observed=null;
 const db={prepare(sql){return {bind(...args){return {async run(){observed={sql,args};return {meta:{changes:1}};}};}};}};
 const request=new Request('https://hhba.work/api/transparency/unsubscribe?token='+token,{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:'List-Unsubscribe=One-Click'
 });
 const response=await publicApi({request,env:{HHBA_TRANSPARENCY_DB:db}});
 assert.equal(response.status,200);
 assert.match(await response.text(),/已完成退订/);
 assert.ok(observed,'One-click request must perform an unsubscribe update');
 assert.match(observed.sql,/status='unsubscribed'/);
 assert.match(observed.sql,/email=NULL/);
 assert.equal(observed.args[2],await sha256(token));
});
test('monthly finance dispatch is unconditionally retired even with valid credentials',async()=>{
 const secret='test-only-valid-old-finance-secret-abcdefghijklmnopqrstuvwxyz';
 const dispatch=read('../functions/api/transparency/dispatch.js');
 assert.doesNotMatch(dispatch,/deliverEmail|publishReviewed|HHBA_FIN_AUTO_PUBLISH_ENABLED/);
 const request=new Request('https://hhba.work/api/transparency/dispatch',{
  method:'POST',headers:{Authorization:'Bearer '+secret}
 });
 const response=await dispatchApi({request,env:{HHBA_FIN_DISPATCH_SECRET:secret,HHBA_FIN_SEND_ENABLED:'1'}});
 assert.equal(response.status,410);
 assert.equal((await response.json()).code,'FINANCE_DISPATCH_RETIRED');
});

test('retired campaign never sends to previously subscribed people',async()=>{
 const db={prepare(){throw Error('retired dispatcher must not read email data');}};
 const result=await sendNextBatch(db,{RESEND_API_KEY:'test'},'2026-10',{});
 assert.deepEqual(result,{attempted:0,sent:0,failed:0});
});

test('isolated SQLite finance lifecycle preserves first publication, corrections and immutable audit history',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  sqlite.exec(read('../d1/0020_financial_transparency.sql'));
  const db={
   prepare(sql){return {
    bind(...values){
     const stmt=sqlite.prepare(sql);
     return {
      async first(){return stmt.get(...values)||null;},
      async all(){return {results:stmt.all(...values)};},
      async run(){const info=stmt.run(...values);return {meta:{changes:Number(info.changes)}};}
     };
    }
   };},
   async batch(queries){
    const result=[];
    sqlite.exec('BEGIN');
    try{
     for(const q of queries)result.push(await q.run());
     sqlite.exec('COMMIT');
     return result;
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
   }
  };
  const original=cleanPeriodPayload(payload());
  assert.ok(original,'the fabricated numbers exist only in this in-memory unit-test database');
  const initialTime='2026-11-21T02:00:00Z';
  sqlite.prepare("INSERT INTO hhba_fin_reports(period,status,draft_json,reviewed_json,revision,prepared_by,reviewed_by,reviewed_at,created_at,updated_at) VALUES(?,'reviewed',?,?,0,'test-only','test-reviewer',?,?,?)")
   .run('2026-10',JSON.stringify(original),JSON.stringify(original),initialTime,initialTime,initialTime);
  const first=await publishReviewed(db,{period:'2026-10',actor:'test-reviewer',at:initialTime});
  assert.equal(first.ok,true);
  assert.equal(first.report.revision,1);
  assert.equal(first.report.netResultFen,40000);
  const secondTime='2026-11-22T02:00:00Z';
  const corrected=cleanPeriodPayload(payload({methodNote:'Correction in isolated unit test only, no real financial amount changed.'}));
  sqlite.prepare("UPDATE hhba_fin_reports SET draft_json=?,reviewed_json=?,reviewed_at=?,reviewed_by='test-reviewer',correction_reason=? WHERE period=?")
   .run(JSON.stringify(corrected),JSON.stringify(corrected),secondTime,'Unit-test clarification only; not a real financial correction.','2026-10');
  const second=await publishReviewed(db,{period:'2026-10',actor:'test-reviewer',at:secondTime});
  assert.equal(second.ok,true);
  assert.equal(second.report.revision,2);
  assert.equal(second.report.correctedAt,secondTime);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM hhba_fin_publication_revisions WHERE period=?").get('2026-10').n,2);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM hhba_fin_audit WHERE period=?").get('2026-10').n,2);
  assert.throws(()=>sqlite.exec("UPDATE hhba_fin_publication_revisions SET correction_reason='tampered' WHERE period='2026-10' AND revision=1"),/IMMUTABLE_PUBLICATION_HISTORY/);
  assert.throws(()=>sqlite.exec("DELETE FROM hhba_fin_publication_revisions WHERE period='2026-10' AND revision=1"),/IMMUTABLE_PUBLICATION_HISTORY/);
  assert.throws(()=>sqlite.exec("DELETE FROM hhba_fin_audit WHERE period='2026-10'"),/IMMUTABLE_FINANCE_AUDIT/);
  const firstHistory=sqlite.prepare('SELECT published_json FROM hhba_fin_publication_revisions WHERE period=? AND revision=1').get('2026-10');
  assert.equal(JSON.parse(firstHistory.published_json).methodNote,original.methodNote);
 }finally{sqlite.close();}
});

test('old finance opt-in and confirmations cannot restart the retired campaign',async()=>{
 const env={HHBA_FIN_SUBSCRIPTIONS_ENABLED:'1',RESEND_API_KEY:'old-key',
  HHBA_FIN_TURNSTILE_SECRET:'fake-secret',HHBA_FIN_TURNSTILE_SITE_KEY:'fake-key',
  HHBA_FIN_FROM_EMAIL:'HHBA Finance <finance@notify.hhba.work>'};
 const req=new Request('https://hhba.work/api/transparency/subscribe',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:'https://hhba.work'},
  body:JSON.stringify({email:'fixture@example.org',consent:true})
 });
 const sub=await publicApi({request:req,env});
 assert.equal(sub.status,410);
 assert.equal((await sub.json()).code,'FINANCE_SUBSCRIPTIONS_RETIRED');
 const verify=await publicApi({request:new Request('https://hhba.work/api/transparency/confirm?token='+('b'.repeat(64))),env});
 assert.equal(verify.status,200);
 assert.match(await verify.text(),/订阅服务已停止/);
 const status=await publicApi({request:new Request('https://hhba.work/api/transparency/status'),env});
 const body=await status.json();
 assert.equal(body.subscriptionEnabled,false);
 assert.equal(body.plan,null);
 assert.equal(body.reportStatus,'retired');
});

test('retired Cloudflare cron never calls the finance endpoint',async()=>{
 const originalFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(...args)=>{calls.push(args);throw Error('retired worker must not perform fetch');};
 try{
  const response=await financeCronWorker.fetch();
  assert.equal(response.status,404);
  await financeCronWorker.scheduled({scheduledTime:Date.now(),cron:'*/5 2-15 21 * *'},{HHBA_FIN_DISPATCH_SECRET:'old-secret'});
  assert.equal(calls.length,0);
 }finally{globalThis.fetch=originalFetch;}
});

test('old finance subscription is retired while prior opt-out endpoints stay functional',()=>{
 const src=read('../functions/api/transparency/[[path]].js');
 assert.match(src,/FINANCE_SUBSCRIPTIONS_RETIRED/);
 assert.match(src,/return donePage\('财务报告邮件订阅服务已停止'\)/);
 assert.match(src,/path==='\/api\/transparency\/unsubscribe'/);
 assert.match(src,/email=NULL/);
});

test('retired admin shortcut cannot expose finance data through the public website',()=>{
 const target=retiredFinanceUI({request:new Request('https://hhba.work/transparency/manage')});
 assert.equal(target.status,307);
 assert.equal(target.headers.get('Location'),'https://admin.hhba.work/admin-preview/');
 assert.match(target.headers.get('Cache-Control'),/no-store/);
 const write=retiredFinanceUI({request:new Request('https://hhba.work/transparency/manage',{method:'POST'})});
 assert.equal(write.status,405);
 const app=read('../src/main.tsx');
 assert.doesNotMatch(app,/TransparencyManagePage/);
 assert.match(app,/route==='\/commitment'/);
});

