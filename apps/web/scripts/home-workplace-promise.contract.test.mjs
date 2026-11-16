import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('homepage public API exposes the approved service plan without enabling transactions',()=>{
 const body=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 const api=read('../functions/api/public/homepage.js');
 assert.ok(api.includes('import homepagePublicConfig from'));
 assert.ok(api.includes('return json(homepagePublicConfig)'));
 assert.equal(body.schemaVersion,1);
 assert.equal(body.membership.priceCents,1990);
 assert.equal(body.membership.currency,'CNY');
 assert.equal(body.membership.billingPeriod,'month');
 assert.equal(body.membership.introductoryMonths,6);
 assert.equal(body.membership.maxServiceMonths,36);
 assert.equal(body.membership.purchaseEnabled,false);
 assert.equal(body.membership.caseIntakeEnabled,false);
 assert.ok(body.membership.firstStageServices.some(item=>item.includes('简历')));
 assert.ok(body.membership.rightsStageServices.some(item=>item.includes('仲裁材料')));
 assert.match(body.membership.serviceNotice,/暂未开放购买/);
});

test('homepage financial disclosure uses distributable profit, not turnover, and does not invent reports',()=>{
 const body=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 assert.equal(body.distribution.companyPercent,60);
 assert.equal(body.distribution.workerSupportPercent,40);
 assert.equal(body.distribution.companyPercent+body.distribution.workerSupportPercent,100);
 assert.equal(body.distribution.basis,'依法核算后的可分配利润');
 assert.equal(body.distribution.reportStatus,'not_published');
 assert.match(body.distribution.reportNotice,/首期财务公开报告尚未发布/);
});

test('homepage links the approved public plan and preserves the real recruitment market',()=>{
 const home=read('../src/pages/HomePage.tsx');
 const component=read('../src/components/HomeWorkplacePromise.tsx');
 const config=read('../src/data/homepagePublicConfig.json');
 assert.ok(home.includes('找工作，不止于找到工作。'));
 assert.ok(home.includes('让机会与人才，找到彼此。'));
 assert.ok(home.includes('kind="rights"'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(home.includes('<HomeCompanyMarquee/>'));
 assert.ok(home.includes('<HomeWorkplacePromise/>'));
 assert.ok(component.includes('api/public/homepage'));
 assert.ok(component.includes('暂未开放购买'));
 assert.ok(config.includes('不提供现金赔付'));
 assert.ok(config.includes('"companyPercent": 60'));
 assert.ok(config.includes('"workerSupportPercent": 40'));
 assert.ok(!home.includes('HomeLiveDrawer'));
});

test('homepage uses one primary membership card, a light value strip and a subordinate 60/40 pledge',()=>{
 const component=read('../src/components/HomeWorkplacePromise.tsx');
 const css=read('../src/styles/home-workplace-promise.css');
 assert.match(component,/找到好工作，只是开始。/);
 assert.match(component,/hhba-home-value-strip/);
 assert.match(component,/hhba-home-membership-card/);
 assert.match(component,/hhba-home-phase-grid/);
 assert.match(component,/hhba-home-pledge/);
 assert.doesNotMatch(component,/hhba-home-business-grid|hhba-home-pillar|hhba-home-distribution-card/);
 assert.match(component,/membership\.firstStageServices/);
 assert.match(component,/membership\.rightsStageServices/);
 assert.match(component,/distribution\.companyPercent/);
 assert.match(component,/distribution\.workerSupportPercent/);
 assert.match(component,/membership\.purchaseEnabled/);
 assert.match(component,/会员服务已开放|暂未开放购买及案件申请/);
 assert.match(component,/summary>服务资格、范围与开通说明/);
 assert.match(css,/\.hhba-home-phase-grid\{display:grid;grid-template-columns:/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/\.hhba-home-phase-grid\{grid-template-columns:1fr/);
 assert.match(css,/\.hhba-home-pledge\{display:grid/);
 assert.match(css,/:focus-visible/);
});
