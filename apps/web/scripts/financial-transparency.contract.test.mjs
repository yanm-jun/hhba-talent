import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 cleanPeriodPayload,validPeriod,nowBeijing,priorMonth,isCurrentPublicationDay,
 publicReport,normalizeEmail,randomToken,sha256,unsubscribeToken,fromAddress
} from '../functions/_lib/transparency.js';
import {onRequest as publicApi} from '../functions/api/transparency/[[path]].js';
import {onRequestPost as dispatchApi} from '../functions/api/transparency/dispatch.js';
import {onRequest as financeAdmin} from '../functions/api/transparency/admin/[[path]].js';
import {publishReviewed} from '../functions/_lib/transparency-publish.js';
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
 const admin=await financeAdmin({request:new Request('https://hhba.work/api/transparency/admin/status'),env:{}});
 assert.notEqual(admin.status,200);
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
 const page=read('../src/pages/TransparencyPage.tsx'),admin=read('../src/pages/TransparencyManagePage.tsx');
 const sql=read('../d1/0020_financial_transparency.sql');
 const publish=read('../functions/_lib/transparency-publish.js');
 const cron=read('../../../.github/workflows/hhba-finance-monthly-dispatch.yml');
 assert.match(main,/if\(route==='\/transparency'\)return <TransparencyPage user=\{user\}\/>/);
 assert.match(main,/if\(route==='\/transparency\/manage'\)return <TransparencyManagePage user=\{user\}\/>/);
 assert.match(shell,/to="\/transparency"/);
 assert.match(home,/className="hhba-home-report-details hhba-home-transparency-link" to="\/transparency"/);
 assert.match(page,/subscriptionEnabled/);
 assert.match(page,/首期财务报告尚未发布/);
 assert.match(page,/reports\.map/);
 assert.match(admin,/财务公开管理/);
 assert.match(admin,/ledgerReconciled/);
 assert.match(sql,/hhba_fin_publication_revisions/);
 assert.match(sql,/hhba_fin_deliveries/);
 assert.match(publish,/INSERT INTO hhba_fin_publication_revisions/);
 assert.match(cron,/\*\/5 2-15 21 \* \*/);
 assert.match(cron,/HHBA_FIN_DISPATCH_SECRET/);
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
 assert.match(page,/不代表获得 ESG 官方认证/);
 assert.match(page,/投资资金与营业收入、可分配利润分别核算/);
 assert.match(page,/上方 ESG 文字是议题说明，不是任何机构的官方 Logo/);
 assert.match(page,/VITE_HHBA_PARTNER_OFFICIAL_NAME/);
 assert.match(page,/VITE_HHBA_PARTNER_OFFICIAL_WEBSITE/);
 assert.match(page,/VITE_HHBA_PARTNER_OFFICIAL_LOGO_URL/);
 assert.match(page,/VITE_HHBA_PARTNER_LOGO_AUTHORIZED/);
 assert.match(page,/officialPartnerMark\(\)/);
 assert.match(page,/if\(String\(env\.VITE_HHBA_PARTNER_LOGO_AUTHORIZED\|\|''\)!=='1'\)return null/);
 assert.ok(page.includes("site.protocol!=='https:'||logo.protocol!=='https:'"));
 assert.match(page,/if\(!isOfficialAsset&&!isSiteHostedAsset\)return null/);
 assert.match(page,/referrerPolicy="no-referrer"/);
 assert.match(page,/rel="noopener noreferrer"/);
 assert.match(page,/合作机构官方标识暂未公开/);
 assert.match(css,/\.hhba-resp-partner-official img/);
 assert.doesNotMatch(page,/unpri\.org.*logo|PRI\s+Signatory Logo|ESG官方认证徽章/i);
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
