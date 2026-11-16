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
 assert.equal(sub.status,503);
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
 assert.match(read('../functions/_lib/admin-access.js'),/HHBA_FINANCE_ACCESS_AUD/);
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
test('front, admin, cron and immutable correction are all wired to same route',()=>{
 const main=read('../src/main.tsx'),shell=read('../src/components/Shell.tsx'),home=read('../src/components/HomeWorkplacePromise.tsx');
 const page=read('../src/pages/TransparencyPage.tsx');
 const sql=read('../d1/0020_financial_transparency.sql');
 const publish=read('../functions/_lib/transparency-publish.js');
 const cron=read('../../../.github/workflows/hhba-finance-monthly-dispatch.yml');
 assert.match(main,/if\(route==='\/transparency'\)return <TransparencyPage user=\{user\}\/>/);
 assert.doesNotMatch(main,/TransparencyManagePage|route==='\/transparency\/manage'/);
 assert.match(shell,/to="\/transparency"/);
 assert.match(home,/className="hhba-home-report-details hhba-home-transparency-link" to="\/transparency"/);
 assert.match(page,/subscriptionEnabled/);
 assert.match(page,/首期财务报告尚未发布/);
 assert.match(page,/reports\.map/);
 assert.match(sql,/hhba_fin_publication_revisions/);
 assert.match(sql,/hhba_fin_deliveries/);
 assert.match(publish,/INSERT INTO hhba_fin_publication_revisions/);
 const cloudflareCron=read('../ops/finance-cron-worker.mjs');
 assert.match(cloudflareCron,/\*\/5 2-15 21 \* \*/);
 assert.match(cloudflareCron,/HHBA_FIN_DISPATCH_SECRET/);
 assert.doesNotMatch(cron,/^\s+schedule:\s*$/m);
 assert.match(cron,/workflow_dispatch/);
});

test('responsibility page is three-part, sober and keeps real finance interfaces',()=>{
 const page=read('../src/pages/TransparencyPage.tsx');
 const css=read('../src/styles/transparency.css');
 const home=read('../src/components/HomeWorkplacePromise.tsx');
 const shell=read('../src/components/Shell.tsx');
 assert.match(page,/<h1>责任与透明<\/h1>/);
 assert.match(page,/公开信息 \/ 责任与透明/);
 assert.match(page,/id="responsibility-support"/);
 assert.match(page,/id="financial-allocation"/);
 assert.match(page,/id="fin-latest-title"/);
 assert.match(page,/¥600,000/);
 assert.match(page,/企业自主披露/);
 assert.match(page,/尚未经独立第三方鉴证/);
 assert.match(page,/不代表任何基金或 ESG 机构的官方认证/);
 assert.match(page,/投资资金与营业收入、可分配利润分别核算/);
 assert.match(page,/个人投资支持/);
 assert.match(page,/INDIVIDUAL BACKING/);
 assert.match(page,/人民币 60 万元资金支持/);
 assert.match(page,/不属于投资人任职机构或任何 ESG 基金的机构投资/);
 assert.match(page,/未经独立第三方鉴证/);
 assert.match(page,/个人投资资金与营业收入、可分配利润分别核算/);
 assert.doesNotMatch(page,/officialPartnerMark|partnerMark|VITE_HHBA_PARTNER_LOGO_AUTHORIZED/);
 assert.match(page,/60%/);
 assert.match(page,/40%/);
 assert.match(page,/最新财务报告/);
 assert.match(page,/首期财务报告尚未发布/);
 assert.match(page,/未披露的数据不代表零收入、零支出或零帮扶/);
 assert.match(page,/历史披露档案/);
 assert.match(page,/财务报告邮件订阅/);
 assert.match(page,/aria-label="已公开的历史月度财务报告"/);
 assert.match(page,/scope="col"/);
 assert.match(page,/reports\.map\(item=><tr/);
 assert.match(page,/yuan\(available\.revenueFen\)/);
 assert.match(page,/yuan\(available\.netResultFen\)/);
 assert.match(page,/\['实际入池','poolReceivedFen'\]/);
 assert.match(page,/\['实际帮扶支出','poolSpentFen'\]/);
 assert.match(page,/poolOperations\.map\(/);
 assert.match(page,/settings\?\.subscriptionEnabled/);
 assert.match(page,/captchaToken/);
 assert.match(page,/未经独立财务审计/);
 assert.match(page,/<details className="hhba-resp-disclosure-detail">/);
 assert.ok(page.indexOf('id="responsibility-support"')<page.indexOf('id="financial-allocation"'),'funding precedes distribution');
 assert.ok(page.indexOf('id="financial-allocation"')<page.indexOf('id="fin-latest-title"'),'distribution precedes monthly report');
 assert.ok(page.indexOf('id="fin-latest-title"')<page.indexOf('id="hhba-fin-history-title"'),'report precedes archive');
 assert.ok(page.indexOf('id="hhba-fin-history-title"')<page.indexOf('id="fin-subscribe-title"'),'archive precedes opt-in');
 assert.match(home,/查看责任与透明/);
 assert.match(shell,/财务公开|责任与透明/);
 assert.doesNotMatch(css,/linear-gradient\(/,'disclosure should not use decorative gradients');
 assert.match(css,/\.hhba-resp-capital/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/@media print/);
 assert.doesNotMatch(page,/<main className="hhba-transparency"/,'Shell already supplies main landmark');
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
test('monthly dispatch has an explicit human-publication safeguard and bounded batches',()=>{
 const dispatch=read('../functions/api/transparency/dispatch.js');
 assert.match(dispatch,/HHBA_FIN_SEND_ENABLED/);
 assert.match(dispatch,/HHBA_FIN_AUTO_PUBLISH_ENABLED/);
 assert.match(dispatch,/REVIEWED_PENDING_MANUAL_PUBLICATION_NO_EMAIL/);
 assert.match(dispatch,/LIMIT 30/);
 assert.match(dispatch,/d\.attempts<3/);
 assert.match(dispatch,/s\.status='verified'/);
 assert.match(dispatch,/List-Unsubscribe-Post/);
 const publicRoute=read('../functions/api/transparency/[[path]].js');
 assert.match(publicRoute,/url\.searchParams\.get\('token'\)/);
});

test('isolated batch delivery sends only verified recipients once and records the provider result',async()=>{
 const email='fixture@example.org';
 const hash=await sha256(email);
 let sent=false,claimed=0,recordedProviderId=null;
 let calls=[];
 const db={prepare(sql){return {bind(...params){return {
  async all(){
   assert.match(sql,/s\.status='verified'/);
   assert.match(sql,/LIMIT 30/);
   return {results:sent?[]:[{email_hash:hash,email,status:'pending',attempts:0}]};
  },
  async run(){
   if(sql.includes("status='sending'")){claimed++;return {meta:{changes:1}};}
   if(sql.includes("status='sent'")){sent=true;recordedProviderId=params[0];return {meta:{changes:1}};}
   return {meta:{changes:1}};
  }
 };}};}};
 const env={
  HHBA_FIN_UNSUBSCRIBE_SECRET:'temporary-unit-test-only-secret-not-for-production-123456789',
  RESEND_API_KEY:'test-only-not-real',HHBA_FIN_FROM_EMAIL:'HHBA Finance <finance@notify.hhba.work>'
 };
 const mockReport={period:'2026-10',revenueFen:0,netResultFen:0,
  distributableProfitFen:0,poolAccrualFen:0,closingPoolFen:0};
 const priorFetch=globalThis.fetch;
 globalThis.fetch=async (url,options)=>{
  assert.equal(String(url),'https://api.resend.com/emails');
  assert.equal(options.headers.Authorization,'Bearer test-only-not-real');
  calls.push({key:options.headers['Idempotency-Key'],payload:JSON.parse(options.body)});
  return new Response(JSON.stringify({id:'mock-only-resend-message-id'}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 };
 try{
  const first=await sendNextBatch(db,env,'2026-10',mockReport);
  const second=await sendNextBatch(db,env,'2026-10',mockReport);
  assert.deepEqual(first,{attempted:1,sent:1,failed:0});
  assert.deepEqual(second,{attempted:0,sent:0,failed:0});
  assert.equal(claimed,1);
  assert.equal(recordedProviderId,'mock-only-resend-message-id');
  assert.equal(calls.length,1);
  assert.equal(calls[0].payload.to[0],email);
  assert.match(calls[0].key,/^hhba-fin-v1-2026-10-/);
  assert.equal(calls[0].payload.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
  assert.match(calls[0].payload.headers['List-Unsubscribe'],/\/api\/transparency\/unsubscribe\?token=/);
 }finally{globalThis.fetch=priorFetch;}
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

test('isolated opt-in flow requires Turnstile, email confirmation and honors one-click unsubscribe',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 const priorFetch=globalThis.fetch;
 const email='fixture@example.org';
 const secret='isolated-unit-test-secret-not-real-123456789012345';
 const env={
  HHBA_TRANSPARENCY_DB:null,
  HHBA_FIN_SUBSCRIPTIONS_ENABLED:'1',
  HHBA_FIN_TURNSTILE_SECRET:'fake-turnstile-server-secret',
  HHBA_FIN_TURNSTILE_SITE_KEY:'fake-turnstile-site-key',
  HHBA_FIN_FROM_EMAIL:'HHBA Finance <finance@notify.hhba.work>',
  HHBA_FIN_UNSUBSCRIBE_SECRET:secret,
  RESEND_API_KEY:'mock-resend-key',
  HHBA_FIN_PUBLIC_BASE_URL:'https://hhba.work'
 };
 let countResend=0,verifyLink='';
 try{
  sqlite.exec(read('../d1/0020_financial_transparency.sql'));
  const db={prepare(sql){return {bind(...values){
   const stmt=sqlite.prepare(sql);
   return{
    async first(){return stmt.get(...values)||null;},
    async all(){return {results:stmt.all(...values)};},
    async run(){const info=stmt.run(...values);return {meta:{changes:Number(info.changes)}};}
   };
  }};}};
  env.HHBA_TRANSPARENCY_DB=db;
  globalThis.fetch=async(url,options)=>{
   const target=String(url);
   if(target==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){
    return new Response(JSON.stringify({success:true,hostname:'hhba.work'}),{
     status:200,headers:{'Content-Type':'application/json'}
    });
   }
   if(target==='https://api.resend.com/emails'){
    countResend++;
    const body=JSON.parse(options.body);
    assert.deepEqual(body.to,[email]);
    assert.equal(body.subject,'请确认 HHBA 财务公开邮件订阅');
    const m=body.html.match(/\/api\/transparency\/confirm\?token=([a-f0-9]{64})/);
    assert.ok(m,'Verification email must include a signed confirmation token');
    verifyLink='https://hhba.work'+m[0];
    return new Response(JSON.stringify({id:'mock-transactional-message'}),{
     status:200,headers:{'Content-Type':'application/json'}
    });
   }
   throw new Error('Unexpected network call from isolated test: '+target);
  };
  const request=(address,method='GET',body=null)=>new Request(address,{
   method,headers:method==='POST'?{'Content-Type':'application/json',Origin:'https://hhba.work'}:undefined,
   body:body===null?undefined:JSON.stringify(body)
  });
  const invalid=await publicApi({request:request('https://hhba.work/api/transparency/subscribe','POST',{
   email,consent:false,turnstileToken:'mock-turnstile-token-with-adequate-length'
  }),env});
  assert.equal(invalid.status,400);
  assert.equal(countResend,0);
  const start=await publicApi({request:request('https://hhba.work/api/transparency/subscribe','POST',{
   email,consent:true,turnstileToken:'mock-turnstile-token-with-adequate-length'
  }),env});
  assert.equal(start.status,200);
  assert.equal((await start.json()).code,'CHECK_EMAIL_IF_ELIGIBLE');
  assert.equal(countResend,1);
  const before=sqlite.prepare('SELECT status,email FROM hhba_fin_subscribers').get();
  assert.equal(before.status,'pending');
  assert.equal(before.email,email);
  const prefetched=await publicApi({request:request(verifyLink),env});
  assert.equal(prefetched.status,200);
  assert.match(await prefetched.text(),/我确认订阅/);
  assert.equal(sqlite.prepare('SELECT status FROM hhba_fin_subscribers').get().status,'pending',
   'Email-link prefetch MUST NOT activate a subscription');
  const token=new URL(verifyLink).searchParams.get('token');
  const blocked=await publicApi({request:new Request('https://hhba.work/api/transparency/confirm',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:'https://untrusted.example'},
   body:'token='+token
  }),env});
  assert.equal(blocked.status,403,'Cross-origin POST must not confirm email subscription');
  assert.equal(sqlite.prepare('SELECT status FROM hhba_fin_subscribers').get().status,'pending');
  const confirmed=await publicApi({request:new Request('https://hhba.work/api/transparency/confirm',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:'https://hhba.work'},
   body:'token='+token
  }),env});
  assert.equal(confirmed.status,200);
  assert.match(await confirmed.text(),/成功订阅/);
  assert.equal(sqlite.prepare('SELECT status FROM hhba_fin_subscribers').get().status,'verified');
  const verifiedRepeat=await publicApi({request:request('https://hhba.work/api/transparency/subscribe','POST',{
   email,consent:true,turnstileToken:'mock-turnstile-token-with-adequate-length'
  }),env});
  assert.equal(verifiedRepeat.status,200);
  assert.equal(countResend,1,'Already-verified subscribers must not receive duplicate confirmation');
  const emailHash=await sha256(email);
  const unsubToken=await unsubscribeToken(env,emailHash);
  const oneClick=new Request('https://hhba.work/api/transparency/unsubscribe?token='+unsubToken,{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:'List-Unsubscribe=One-Click'
  });
  const result=await publicApi({request:oneClick,env});
  assert.equal(result.status,200);
  assert.match(await result.text(),/已完成退订/);
  const end=sqlite.prepare('SELECT status,email FROM hhba_fin_subscribers').get();
  assert.equal(end.status,'unsubscribed');
  assert.equal(end.email,null);
  assert.equal(countResend,1,'Unsubscribing must not send any marketing or other messages');
 }finally{globalThis.fetch=priorFetch;sqlite.close();}
});

test('Cloudflare cron triggers only on the 21st UTC and never exposes a public HTTP endpoint',async()=>{
 const priorFetch=globalThis.fetch,originalLog=console.log,originalError=console.error;
 const calls=[],logs=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),authorization:options.headers.Authorization,body:options.body});
  return new Response(JSON.stringify({ok:true,code:'NO_APPROVED_REPORT_NO_EMAIL',attempted:0}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 };
 console.log=(...a)=>logs.push(a);
 console.error=(...a)=>logs.push(a);
 try{
  const urlTest=await financeCronWorker.fetch();
  assert.equal(urlTest.status,404);
  const key='mock-test-only-secret-abcdefghijklmnopqrstuvwxyz123456';
  const event=(ts,cron='*/5 2-15 21 * *')=>({cron,scheduledTime:Date.parse(ts)});
  await financeCronWorker.scheduled(event('2026-11-20T02:00:00Z'),{HHBA_FIN_DISPATCH_SECRET:key});
  await financeCronWorker.scheduled(event('2026-11-21T01:55:00Z'),{HHBA_FIN_DISPATCH_SECRET:key});
  await financeCronWorker.scheduled(event('2026-11-21T02:00:00Z','0 2 21 * *'),{HHBA_FIN_DISPATCH_SECRET:key});
  await financeCronWorker.scheduled(event('2026-11-21T02:00:00Z'),{HHBA_FIN_DISPATCH_SECRET:''});
  assert.equal(calls.length,0,'No call may occur outside schedule or without configured secret');
  await financeCronWorker.scheduled(event('2026-11-21T02:00:00Z'),{HHBA_FIN_DISPATCH_SECRET:key});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://hhba.work/api/transparency/dispatch');
  assert.equal(calls[0].authorization,'Bearer '+key);
  assert.equal(calls[0].body,'{}');
  assert.ok(!JSON.stringify(logs).includes(key),'Never log dispatch bearer tokens');
  const workflow=read('../../../.github/workflows/hhba-finance-monthly-dispatch.yml');
  assert.doesNotMatch(workflow,/^\s+schedule:\s*$/m,'GitHub must not run a second automatic scheduler');
  assert.match(workflow,/workflow_dispatch/);
 }finally{globalThis.fetch=priorFetch;console.log=originalLog;console.error=originalError;}
});

test('finance confirmation handler separates safe GET from deliberate POST',()=>{
 const src=read('../functions/api/transparency/[[path]].js');
 assert.match(src,/renderConfirm\(token\)/);
 assert.match(src,/if\(request.method==='POST'&&path==='\/api\/transparency\/confirm'\)/);
 assert.match(src,/if\(!safeOrigin\(request\)\)/);
 assert.match(src,/点击邮件链接不会自动完成订阅/);
 assert.match(src,/application\/x-www-form-urlencoded/);
});




test('retired duplicate finance entry never serves private content and never changes public financial disclosure',()=>{
 const target=retiredFinanceUI({request:new Request('https://hhba.work/transparency/manage')});
 assert.equal(target.status,307);
 assert.equal(target.headers.get('Location'),'https://admin.hhba.work/admin-preview/');
 assert.match(target.headers.get('Cache-Control'),/no-store/);
 const write=retiredFinanceUI({request:new Request('https://hhba.work/transparency/manage',{method:'POST'})});
 assert.equal(write.status,405);
 const app=read('../src/main.tsx');
 assert.doesNotMatch(app,/TransparencyManagePage/);
 assert.match(app,/if\(route==='\/transparency'\)return <TransparencyPage user=\{user\}\/>/);
});
