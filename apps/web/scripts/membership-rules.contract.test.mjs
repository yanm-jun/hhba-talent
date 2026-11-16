import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

const rules=read('../src/data/membershipRulesContent.ts');
const page=read('../src/pages/MembershipRulesPage.tsx');
const css=read('../src/styles/membership-rules.css');
const main=read('../src/main.tsx');
const homepage=read('../src/components/HomeWorkplacePromise.tsx');
const rights=read('../src/pages/LegalAidLandingPage.tsx');

test('public rules page has 16 distinct, detailed chapters and 15 concrete FAQ examples',()=>{
 const ids=[...rules.matchAll(/\{id:'([a-z-]+)',title:'/g)].map(match=>match[1]);
 assert.equal(ids.length,16,'all 16 chapters must exist');
 assert.equal(new Set(ids).size,16,'chapter anchor IDs must be unique');
 const questions=[...rules.matchAll(/\{q:'/g)];
 assert.equal(questions.length,15,'concrete questions should cover every important dispute');
 for(const name of ['服务总则与产品性质','收费、订单、账单及发票','会员期间与36个月上限',
  '前六个月职业成长服务','六个月连续缴费与进阶资格','争议发生时间与既有案件','拟提供的劳动法律服务',
  '案件数量、范围及额外费用','申请、审核、文书与结案流程','合作律所、律师权限与微信沟通',
  '真实性、滥用防范与双方义务','取消续费、退款与服务中断','个人信息、证据及AI处理',
  '咨询、投诉、复核与争议解决','企业60%与劳动者帮扶池40%','规则生效、变更及历史版本']){
  assert.ok(rules.includes(name),name+' missing');
 }
});

test('page is readable anonymously and reachable from both home and labor rights',()=>{
 assert.match(main,/MembershipRulesPage=lazy/);
 assert.match(main,/if\(route==='\/membership\/rules'\)return <MembershipRulesPage user=\{user\}\/>/);
 assert.match(homepage,/to="\/membership\/rules"/);
 assert.match(homepage,/服务资格、范围与开通说明/);
 assert.match(rights,/to="\/membership\/rules"/);
 assert.match(page,/<Shell user=\{user\}>/);
 assert.match(page,/chapters\.map\(/);
 assert.match(page,/id=\{'rules-'\+chapter\.id\}/);
 assert.match(page,/href=\{'#rules-'\+chapter\.id\}/);
 assert.match(page,/faq\.map\(/);
 assert.match(page,/legalSources\.map\(/);
 assert.match(page,/window\.print\(\)/);
});

test('draft does not enable payment or falsely claim a lawyer assignment',()=>{
 assert.match(rules,/公开说明草案/);
 assert.match(rules,/尚未开放购买/);
 assert.match(rules,/律师委托目前均未开放|律师委托/);
 assert.match(rules,/正式开售前必须明确/);
 assert.match(rules,/不能使用「售出概不退款」/);
 assert.match(rules,/不包含心理咨询/);
 assert.match(rules,/不是每笔19\.90元付款的40%/);
 const config=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 assert.equal(config.membership.purchaseEnabled,false);
 assert.equal(config.membership.caseIntakeEnabled,false);
 assert.equal(config.distribution.reportStatus,'not_published');
 assert.ok(!page.includes('onSubmit'));
 assert.ok(!page.includes('createSubscription'));
});

test('mobile, accessible navigation and print-friendly reading remain supported',()=>{
 assert.match(page,/aria-labelledby=/);
 assert.match(page,/href="#rules-contents"/);
 assert.match(page,/id="rules-faq"/);
 assert.match(page,/id="rules-sources"/);
 assert.match(css,/\.hhba-rules-nav\{position:sticky/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media print/);
 assert.match(css,/:focus-visible/);
});
