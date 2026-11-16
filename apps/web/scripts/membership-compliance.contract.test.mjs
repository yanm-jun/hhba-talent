import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {onRequest} from '../functions/api/membership/[[path]].js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

const config=JSON.parse(read('../src/data/homepagePublicConfig.json'));
const compliance=read('../src/data/membershipCompliance.ts');
const rules=read('../src/data/membershipRulesContent.ts');
const page=read('../src/pages/MembershipRulesPage.tsx');
const css=read('../src/styles/membership-rules.css');
const api=read('../functions/api/public/homepage.js');

test('membership product remains explicitly blocked across all public policy flags',()=>{
 const m=config.membership;
 for(const key of ['purchaseEnabled','caseIntakeEnabled','autoRenewEnabled','multiMonthPrepayEnabled',
  'sensitiveCaseUploadEnabled','caseAIProcessingEnabled','launchApproved']){
  assert.equal(m[key],false,key+' must default disabled');
  assert.match(api,new RegExp(key+':false'),key+' must be blocked on the server');
 }
 assert.equal(m.billingMode,'manual_only');
 assert.equal(m.priceCents,1990);
 assert.equal(m.complianceRulesVersion,'0.2.0');
 assert.equal(config.distribution.reportStatus,'not_published');
 assert.match(compliance,/status:'blocked'/);
 assert.match(compliance,/rulesAreBinding:false/);
});

test('catch-all membership endpoint refuses every method without processing case data or payment',async()=>{
 const methods=['GET','POST','PUT','PATCH','DELETE'];
 for(const method of methods){
  const response=await onRequest();
  assert.equal(response.status,503,method);
  assert.match(response.headers.get('Cache-Control')||'',/no-store/);
  assert.ok(!response.headers.get('Set-Cookie'));
  const body=await response.json();
  assert.equal(body.code,'HHBA_MEMBERSHIP_NOT_OPEN');
 }
 assert.deepEqual(readdirSync(new URL('../functions/api/membership/',import.meta.url)),['[[path]].js'],
  'new endpoints must undergo explicit review and contract tests, not bypass the blocked gateway');
});

test('format terms, manual renewal, prepayment refund, sensitive data have concrete separate safeguards',()=>{
 const areas=compliance.match(/export const complianceAreas=\[([\s\S]*?)\] as const;/)?.[1]||'';
 const checks=compliance.match(/export const launchChecks=\[([\s\S]*?)\] as const;/)?.[1]||'';
 assert.equal((areas.match(/\{id:'/g)||[]).length,4);
 assert.equal((checks.match(/\{id:'/g)||[]).length,12);
 for(const word of ['格式条款','续费','退款','敏感','单独','授权','提前5日','同意','版本','退费',
   '存储','经营主体','律所','服务','影响评估']){
  assert.ok(compliance.includes(word),'Missing compliance control: '+word);
 }
 assert.match(rules,/第一版不得预收六期或三十六期会费/);
 assert.match(rules,/月手动购买或续费/);
 assert.match(rules,/未履约退款/);
 assert.match(rules,/不能使用「售出概不退款」/);
 assert.match(rules,/数据/);
 assert.match(rules,/当前公开说明版本为0\.2\.0/);
 assert.doesNotMatch(rules,/html1/);
});

test('public rules page shows high-risk conditions and never presents an active checkout or case-upload form',()=>{
 assert.match(page,/id="rules-compliance"/);
 assert.match(page,/complianceAreas\.map\(/);
 assert.match(page,/launchChecks\.map\(/);
 assert.match(page,/id="rules-launch"/);
 assert.match(page,/待核验/);
 assert.match(page,/membershipLaunchState\.status/);
 assert.doesNotMatch(page,/\b<form\b/);
 assert.doesNotMatch(page,/createCheckout|subscribeNow|payNow/);
 assert.match(css,/hhba-rules-compliance-list/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media print/);
});
