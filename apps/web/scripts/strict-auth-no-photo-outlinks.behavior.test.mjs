import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Node 22 directly strips erasable TypeScript type annotations.
// Do not depend on the legacy transpileModule API removed in TypeScript 7.
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const {recruitmentTarget,rememberRecruitment,pendingRecruitment,clearPendingRecruitment}=
 await import('../src/services/recruitmentOutbound.ts');

function link(href,label,options={}){
 return {href,target:'_blank',textContent:label,title:'',
  dataset:{},getAttribute:()=>null,...options};
}
test('official recruitment links are detected for 200-company profiles, global ATS and job applications',()=>{
 for(const [url,label] of [
  ['https://jobs.example.com/careers','查看招聘官网'],
  ['https://jobs.example.com/launch?ref=hhba','查看招聘官网'],
  ['https://example.com/official/jobs/123','企业官网核实完整职位与投递状态'],
  ['https://jobs.example.com/apply?id=888','前往官方投递页'],
  ['https://careers.example.com/','官方招聘'],
  ['https://hr.example.com/start','查看招聘公告']
 ]){
  assert.equal(recruitmentTarget(link(url,label)),url,'not gated '+label);
 }
 assert.equal(recruitmentTarget(link('https://unusual.example.com/some-page','目录',{
   dataset:{hhbaRecruitmentOutbound:'true'}
 })),'https://unusual.example.com/some-page');
});
test('public source citations, ordinary navigation and invalid outbound URLs are never treated as recruitment links',()=>{
 for(const [url,label] of [
  ['https://example.com/careers/2026/source','招聘入口核验依据'],
  ['https://example.com/jobs','企业图片来源'],
  ['https://example.com/people','人物身份来源'],
  ['https://example.com/','公司简介']
 ])assert.equal(recruitmentTarget(link(url,label)),null);
 assert.equal(recruitmentTarget(link('https://jobs.example.com/careers','查看招聘官网',{target:'_self'})),null);
 assert.equal(recruitmentTarget(link('javascript:alert(1)','查看招聘官网')),null);
 assert.equal(recruitmentTarget(link('http://example.com/jobs','查看招聘官网')),null);
 assert.equal(recruitmentTarget(link('https://localhost/careers','查看招聘官网')),null);
});
test('after clicking registration, safe original HTTPS career URL is preserved for 30 minutes',()=>{
 const values=new Map();
 globalThis.sessionStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)};
 const dest='https://jobs.example.com/careers?role=123';
 assert.equal(rememberRecruitment(dest,'查看招聘官网','/companies/domestic/a-000001'),true);
 assert.deepEqual({...pendingRecruitment(),at:0},{url:dest,title:'查看招聘官网',
 origin:'/companies/domestic/a-000001',at:0});
 assert.equal(rememberRecruitment('javascript:alert(1)','bad','/'),false);
 assert.equal(pendingRecruitment()?.url,dest);
 clearPendingRecruitment();
 assert.equal(pendingRecruitment(),null);
});
test('all domestic employer photo tiles and international workplace imagery remain inert and source credits stay text',()=>{
 const dom=read('pages/DomesticCompanyPage.tsx');
 const visual=read('components/CompanyVisualStory.tsx');
 const style=read('styles/domestic-company-search.css');
 const gallery=dom.slice(dom.indexOf('className="domestic-editorial-photo-grid"'),dom.indexOf("{article?.photoSourcePage&&!hasReadyPhoto?"));
 assert.ok(gallery.length>400);
 assert.ok(gallery.includes('className="domestic-photo-display"'));
 assert.ok(gallery.includes('<img src='));
 assert.ok(gallery.includes('<figcaption>'));
 assert.ok(!/<a\b|href=|<Link\b/.test(gallery),'any photo-card outbound link is forbidden');
 const photoSource=dom.slice(dom.indexOf('{article?.photoSourcePage&&!hasReadyPhoto?'),
  dom.indexOf('{article?.officeLocations?.length?'));
 assert.ok(!/<a\b|href=|target=/.test(photoSource),'no link hidden under office photo source area');
 assert.ok(dom.includes('企业图片来源已登记'));
 assert.ok(!dom.includes('<a href={article.imageSource}'));
 assert.ok(!dom.includes('<a href={article.brandImageSource}'));
 assert.ok(!/<a\b/.test(visual),'all photo and image-credit regions must stay plain text');
 assert.ok(style.includes('pointer-events:none'));
 assert.ok(read('styles/company-visual-story.css').includes('.company-visual-photo img{pointer-events:none}'));
});
test('the official external recruiting gate only accepts a real candidate identity from backend',()=>{
 const s=read('components/Shell.tsx');
 const next=read('pages/OfficialRecruitmentContinuePage.tsx');
 const demo=read('pages/DemoAuthPage.tsx');
 assert.ok(s.includes('verifiedCandidate=employerApiReady&&hasCandidate'));
 assert.ok(s.includes('if(!destination||verifiedCandidate)return'));
 assert.ok(s.includes('onClickCapture={guardRecruitmentClick}'));
 assert.ok(s.includes('onAuxClickCapture={guardRecruitmentClick}'));
 assert.ok(s.includes('onContextMenuCapture={guardRecruitmentContextMenu}'));
 assert.ok(next.includes("const signed=employerApiReady&&!!user?.account_types?.includes('candidate')"));
 assert.ok(next.includes("!employerApiReady?<><h2>正式账户服务尚未开通"));
 assert.ok(!next.includes('useDemoAccount'));
 assert.ok(demo.includes('演示注册无法解锁第三方招聘官网'));
 assert.ok(s.includes("navigate('/candidate/register?next=%2Fcandidate%2Fofficial-outbound')"));
});
