import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/api/public/homepage.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('homepage public API exposes the approved service plan without enabling transactions',async()=>{
 const response=await onRequestGet();
 assert.equal(response.status,200);
 const body=await response.json();
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

test('homepage financial disclosure uses distributable profit, not turnover, and does not invent reports',async()=>{
 const response=await onRequestGet();
 const body=await response.json();
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
 assert.ok(component.includes('不提供现金赔付'));
 assert.ok(config.includes('"companyPercent": 60'));
 assert.ok(config.includes('"workerSupportPercent": 40'));
 assert.ok(!home.includes('HomeLiveDrawer'));
});
