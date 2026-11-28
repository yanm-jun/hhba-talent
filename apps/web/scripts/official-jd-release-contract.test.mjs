import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseOfficialGreenhouseJsonp,verifyOfficialGreenhouseSample} from './official-jd-release-contract.mjs';

const selection={
 id:'greenhouse-airtable-1234567',company:'Airtable',platform:'greenhouse',source:'airtable',
 url:'https://job-boards.greenhouse.io/airtable/jobs/1234567'
};
const content='<h3>Responsibilities</h3><p>Develop scalable systems, coordinate teams and document work.</p><h3>Qualifications</h3><p>Strong technical experience and communications skills.</p>';
const jd={id:1234567,title:'Software Engineer',absolute_url:selection.url,content};
const callback='hhbaOfficialJdProbe';

test('browser JSONP and direct ATS JSON must describe the same exact official vacancy',()=>{
 const payload='/* Greenhouse public JSONP */\n'+callback+'('+JSON.stringify(jd)+');';
 const parsed=parseOfficialGreenhouseJsonp(payload,callback);
 assert.deepEqual(parsed,jd);
 assert.deepEqual(verifyOfficialGreenhouseSample(selection,jd,parsed),{
  provider:'greenhouse',jobId:selection.id,verified:true,originalChars:content.length,jsonpConsistent:true
 });
});

test('reject wrong callback, malformed response, duplicate callback payload or wrong job identity',()=>{
 for(const payload of [
  'notYourCallback('+JSON.stringify(jd)+');',
  callback+'('+JSON.stringify(jd)+';window.attack()',
  callback+'({unquoted:123});',
  callback+'('+JSON.stringify(jd)+'); '+callback+'('+JSON.stringify(jd)+')'
 ])assert.throws(()=>parseOfficialGreenhouseJsonp(payload,callback));
 assert.throws(()=>verifyOfficialGreenhouseSample(selection,jd,{...jd,id:9876543}),/IDENTITY_MISMATCH/);
 assert.throws(()=>verifyOfficialGreenhouseSample(selection,jd,{...jd,content:'incomplete'}),/CONTENT_MISMATCH/);
 assert.throws(()=>verifyOfficialGreenhouseSample(selection,{...jd,absolute_url:'https://malicious.example/airtable/jobs/1234567'},jd),/URL_MISMATCH/);
 assert.throws(()=>verifyOfficialGreenhouseSample({...selection,url:'http://job-boards.greenhouse.io/airtable/jobs/1234567'},jd,jd),/URL_MISMATCH/);
 assert.throws(()=>verifyOfficialGreenhouseSample({...selection,url:'https://job-boards.greenhouse.io/other/jobs/1234567'},jd,jd),/URL_MISMATCH/);
});

test('Pages release verifies live official provider without relying on retired Railway CORS checks',()=>{
 const smoke=readFileSync(new URL('./verify-official-jd.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../../../.github/workflows/hhba-github-pages-preview.yml',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../src/services/officialJd.ts',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/job-jd.js',import.meta.url),'utf8');
 assert.match(smoke,/boards-api\.greenhouse\.io/);
 assert.match(smoke,/parseOfficialGreenhouseJsonp\(jsonpText,callback\)/);
 assert.match(smoke,/verifyOfficialGreenhouseSample\(selection,direct,publicJd\)/);
 assert.doesNotMatch(smoke,/up\.railway\.app|corsOrigin|translate-part/);
 assert.match(workflow,/node scripts\/verify-official-jd\.mjs/);
 assert.match(browser,/function readGreenhouseJsonp\(/);
 assert.match(browser,/validateOfficialDetail\(record,info,job\)/);
 assert.match(api,/fetchPublicAtsJd\(locator\.url\)/,'same-origin Cloudflare API retains official ATS verification');
 assert.match(api,/originOK\(request\)/,'consented Cloudflare JD reads are same-origin');
});
