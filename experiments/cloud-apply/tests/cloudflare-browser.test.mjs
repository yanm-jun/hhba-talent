import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRunClient } from '../src/cloudflare-browser.mjs';
const accountId = '0123456789abcdef0123456789abcdef';
const token = 'synthetic-test-token';
const fixture = '<!doctype html><title>HHBA</title><h1>HHBA 测试招聘网申（虚构）</h1><form id="apply"><input name="fullName"></form><output id="submission">未提交</output>';
const sessionId = 'a7e3fa20-4db1-4c36-8126-28fc283197e9';
function json(result, status=200) { return { ok: status < 400, status, async json() { return { success: true, result }; } }; }
function mock(routes) {
  const seen=[];
  const fetchImpl = async (url,opts) => {
    seen.push({url,opts});
    const key=opts.method+' '+new URL(url).pathname.split('/browser-rendering')[1];
    const match=routes.find(x=>key.endsWith(x.suffix));
    if(!match) throw new Error('Unmocked API route: '+key);
    if(match.throw) throw new Error('Synthetic network failure');
    return json(match.value,match.status||200);
  };
  return { seen, fetchImpl };
}
test('session creates, opens synthetic tab, sees Live View and always closes', async () => {
  const m=mock([
    {suffix:'POST /devtools/browser',value:{sessionId}},
    {suffix:'PUT /devtools/browser/'+sessionId+'/json/new',value:{id:'target',type:'page'}},
    {suffix:'GET /devtools/browser/'+sessionId+'/json/list',value:[{url:'data:text/html;charset=utf-8,HHBA',devtoolsFrontendUrl:'https://example.invalid/secret'}]},
    {suffix:'DELETE /devtools/browser/'+sessionId,value:{}},
  ]);
  const api=createBrowserRunClient({accountId,apiToken:token,fetchImpl:m.fetchImpl});
  const result=await api.withSession(async browser=> {
    assert.deepEqual(await browser.openFixtureTab(fixture),{created:true,type:'page'});
    return browser.inspectTabs();
  });
  assert.deepEqual(result,{count:1,hasFixture:true,hasLiveView:true});
  assert.equal(m.seen.length,4);
  assert.ok(m.seen.every(x=>x.opts.headers.Authorization==='Bearer '+token));
  assert.ok(m.seen[3].url.endsWith('/'+sessionId));
  assert.equal(m.seen[0].url.includes('keep_alive=60000'),true);
});
test('failed session work still attempts cleanup',async()=>{
  const m=mock([
    {suffix:'POST /devtools/browser',value:{sessionId}},
    {suffix:'GET /devtools/browser/'+sessionId+'/json/list',throw:true},
    {suffix:'DELETE /devtools/browser/'+sessionId,value:{}},
  ]);
  const api=createBrowserRunClient({accountId,apiToken:token,fetchImpl:m.fetchImpl});
  await assert.rejects(api.withSession(b=>b.inspectTabs()),/Synthetic network failure/);
  assert.equal(m.seen.at(-1).opts.method,'DELETE');
});
test('reject arbitrary target / missing credentials',async()=>{
  assert.throws(()=>createBrowserRunClient({accountId,apiToken:''}),/Missing Browser Run API token/);
  const m=mock([{suffix:'POST /devtools/browser',value:{sessionId}},{suffix:'DELETE /devtools/browser/'+sessionId,value:{}}]);
  const api=createBrowserRunClient({accountId,apiToken:token,fetchImpl:m.fetchImpl});
  await assert.rejects(api.withSession(b=>b.openFixtureTab('<form action="https://example.com">')),/synthetic fixture/);
  assert.equal(m.seen.at(-1).opts.method,'DELETE');
});
test('Quick Action confirms six verified fields and no submission',async()=>{
  const html='<html data-hhba-cloud-writes="6" data-hhba-cloud-submitted="false" data-hhba-cloud-manual="2"></html>';
  const m=mock([{suffix:'POST /content',value:html}]);
  const api=createBrowserRunClient({accountId,apiToken:token,fetchImpl:m.fetchImpl});
  assert.deepEqual(await api.runSyntheticContentSmoke(fixture),{verifiedFields:6,manualFields:2,submitted:false});
  const body=JSON.parse(m.seen[0].opts.body);
  assert.ok(body.html.includes('HHBA 测试招聘网申'));
  assert.ok(body.addScriptTag[0].content.includes('data-hhba-cloud-writes'));
  assert.equal(body.addScriptTag[0].content.includes('submit()'),false);
});
test('reject unverified or submitted cloud responses', async()=>{
  for(const bad of [
    '<html data-hhba-cloud-writes="5" data-hhba-cloud-submitted="false" data-hhba-cloud-manual="2"></html>',
    '<html data-hhba-cloud-writes="6" data-hhba-cloud-submitted="true" data-hhba-cloud-manual="2"></html>'
  ]) {
    const m=mock([{suffix:'POST /content',value:bad}]);
    await assert.rejects(createBrowserRunClient({accountId,apiToken:token,fetchImpl:m.fetchImpl}).runSyntheticContentSmoke(fixture), /safety assertion/);
  }
});
