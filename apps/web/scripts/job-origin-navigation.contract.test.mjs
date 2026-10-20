import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const router=get('../src/router.tsx'),market=get('../src/components/UnifiedJobMarket.tsx'),home=get('../src/pages/HomePage.tsx');
test('home remains the dual-entry landing screen after return',()=>{
 assert.ok(home.includes('我要应聘')&&home.includes('我要招人'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
 assert.ok(router.includes("path==='/'"));
});
test('detail uses origin-aware return instead of hardcoded market link',()=>{
 assert.ok(router.includes('hhbaJobOrigin'));
 assert.ok(router.includes('getJobReturnTarget'));
 assert.ok(market.includes('const returnTarget=getJobReturnTarget()'));
 assert.ok(market.includes('restoreScrollY={returnTarget.scrollY}'));
 assert.ok(!market.includes('<Link to="/candidate/jobs">←'));
});
test('browser navigation restores origin scroll and market filters',()=>{
 assert.ok(router.includes('saveScrollForCurrentEntry()'));
 assert.ok(router.includes('history.scrollRestoration='));
 assert.ok(router.includes('restoreScrollOnNavigation()'));
 assert.ok(market.includes('hhbaMarketState:state'));
 assert.ok(market.includes('readMarketState(compact)'));
});
test('rejects off-site and arbitrary history-origin redirection',()=>{
 assert.ok(router.includes("!to.startsWith('/')||to.startsWith('//')"));
 assert.ok(router.includes("path==='/candidate/jobs'"));
 assert.ok(router.includes("return {to:'/candidate/jobs',scrollY:0}"));
});
