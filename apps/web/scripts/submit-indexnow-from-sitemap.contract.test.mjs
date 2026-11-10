import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parsePublicSitemap} from './submit-indexnow-from-sitemap.mjs';
const xml=urls=>'<?xml version="1.0"?><urlset>'+urls.map(url=>'<url><loc>'+url+'</loc></url>').join('')+'</urlset>';
test('IndexNow covers all canonical public entries once',()=>{
 const urls=['https://hhba.work/','https://hhba.work/candidate/jobs/','https://hhba.work/companies/autumn/cn-autumn-034/','https://hhba.work/'];
 assert.deepEqual(parsePublicSitemap(xml(urls)),urls.slice(0,3));
});
test('reject unexpected origin and leakage of private pages',()=>{
 for(const url of ['https://evil.example/','http://hhba.work/','https://hhba.work/candidate/resume/','https://hhba.work/candidate/match/','https://hhba.work/admin-preview/','https://hhba.work/api/v1/users/','https://hhba.work/candidate/jobs/?uid=1']){
  assert.throws(()=>parsePublicSitemap(xml([url])),url);
 }
});
test('reject HTML fallback and malformed sitemap',()=>{
 assert.throws(()=>parsePublicSitemap('<html>nothing</html>'));
 assert.throws(()=>parsePublicSitemap('<urlset></urlset>'));
});
