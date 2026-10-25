import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=(p)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const load=(p)=>JSON.parse(src(p));
const main=src('main.tsx'),shell=src('components/Shell.tsx');
const dropdown=src('components/CandidateAccountDropdown.tsx');
const homepage=src('pages/HomePage.tsx');
const join=src('pages/JoinUsPage.tsx'),vision=src('pages/VisionPage.tsx');
const css=src('styles/join-vision.css');
const companyList=load('data/domesticComplete200Target.json');
const original100=load('data/domesticComplete100Target.json');
const profiles=load('data/domesticCareerProfiles.json');
const newProfiles=load('data/domesticCompanyExpansion200Profiles.json');
const media1=load('data/domesticMediaBundle.json').companies;
const media2=load('data/domesticMedia200Bundle.json').companies;
const combined={...media1,...media2};
const existsAsset=(p)=>typeof p==='string' && !p.includes('..') && existsSync(new URL('../public/'+p.replace(/^\//,''),import.meta.url));
test('complete up-to-date enterprise and admin navigation survives',()=>{
 for(const x of ['企业发现','CandidateAccountDropdown','登录 / 注册','招聘市场','加入我们'])
   assert.ok(shell.includes(x),'missing navigation '+x);
 for(const x of ['工作台','我的收藏','个人资料','求职偏好','我的简历','求职记录','法律援助'])
   assert.ok(dropdown.includes(x),'missing personal center item '+x);
 for(const x of ['Company200PreviewPage','PersonalCenterPage','LegalAidLandingPage','EmployerStartPage',
 'EmployerOnboardingPreviewPage','EmployerAidApplicationPage','EmployerCommercialPage','AdminAidCommercialPage',
 'EmployerEvidencePage','AdminEmployerEvidencePage','EmployerScoringPage','AdminEmployerScoringPage',
 'EmployerAppealsPage','AdminAppealsReviewPage','EmployerImprovementsPage','AdminEmployerPublicationPage'])
   assert.ok(main.includes(x),'must preserve latest application feature '+x);
 for(const x of ['我要应聘','我要招人','企业发现 · 200 家国内企业','UnifiedJobMarket compact'])
   assert.ok(homepage.includes(x),'must preserve homepage '+x);
});
test('exact 200 company identities, original 100 and complete profile references preserved',()=>{
 const names=companyList.companyNames;
 assert.equal(names.length,200);
 assert.equal(new Set(names).size,200);
 assert.deepEqual(names.slice(0,100),original100.companyNames);
 for(const name of names)assert.ok(profiles[name]||newProfiles[name],'missing company profile '+name);
});
test('every already approved domestic logo/photo still resolves to a real original asset; never substitute another company',()=>{
 let brands=0,companiesWithPhotos=0,photos=0;
 for(const name of companyList.companyNames){
   const m=combined[name];
   if(!m)continue;
   if(m.brand?.state==='ready'){
     brands++;
     assert.ok(existsAsset(m.brand.path),'missing logo for '+name+' '+m.brand.path);
   }
   let images=0;
   for(const p of m.photos||[]){
     if(p.state!=='ready')continue;
     assert.ok(existsAsset(p.path),'missing photo for '+name+' '+p.path);
     images++;photos++;
   }
   if(images)companiesWithPhotos++;
 }
 assert.ok(brands>=67,'unexpected loss of approved logos: '+brands);
 assert.ok(companiesWithPhotos>=137,'unexpected loss of company photos: '+companiesWithPhotos);
 assert.ok(photos>=214,'unexpected loss of local photos: '+photos);
});
test('all career and vision pages are linked, original four cards are on join page not vision',()=>{
 assert.match(shell,/to="\/join"/);
 assert.ok(main.includes("route==='/join'"));
 assert.ok(main.includes("route==='/vision'"));
 assert.match(join,/to="\/vision">了解我们的理念/);
 assert.match(vision,/to="\/join"/);
 for(const text of ['为什么是 HHBA？','连接更广阔的机会','认真对待劳动者','让技术真正有用','与建设者分享成长'])
   assert.ok(join.includes(text),'four original cards not restored: '+text);
 assert.equal((vision.match(/number: '0[1-4]'/g)||[]).length,4);
 for(const text of ['FOR EVERY PERSON','FOR EVERY ORGANIZATION','FOR A BETTER MARKET','FOR THE FUTURE OF SOCIETY','THE WORLD WE ENVISION'])
   assert.ok(vision.includes(text),'missing vision '+text);
 for(const text of ['技术负责人 / 全栈架构工程师','后端与数据库工程师','招聘数据与 AI 搜索工程师',
 '企业治理与劳动权益研究伙伴','企业合作与商业发展伙伴','产品设计 / 前端体验伙伴','其他专业 / 自荐加入'])
   assert.ok(join.includes(text),'missing recruitment role '+text);
 assert.match(css,/\.join-page\{/);
 assert.match(css,/\.join-vision-opening\{/);
 assert.match(css,/\.join-vision-navigation\{/);
});
test('founder manifesto untouched and includes two authentic original image files',()=>{
 for(const text of ['让劳动更有尊严，让商业更有温度','每一份简历背后，都是一个认真生活的人。','求职者可以不被录用，但不应该被欺骗；','让劳动获得尊严，让招聘回归诚信。'])
   assert.ok(join.includes(text),'founder letter missing '+text);
 for(const image of ['hhba-founder-signature.webp','hhba-join-team.webp']){
   const file=new URL('../public/images/'+image,import.meta.url);
   assert.ok(existsSync(file),image);
   const bytes=readFileSync(file);
   assert.equal(bytes.toString('ascii',0,4),'RIFF');
   assert.equal(bytes.toString('ascii',8,12),'WEBP');
   assert.ok(bytes.length>12000,image);
   assert.ok(join.includes(image),'join missing image '+image);
 }
 assert.ok(!vision.includes('每一份简历背后，都是一个认真生活的人。'));
});
test('static job application discloses demo boundary and honors reduced motion',()=>{
 for(const banned of [/\bfetch\s*\(/,/localStorage/,/sessionStorage/,/sendBeacon/,/XMLHttpRequest/,/\bapi\./])
   assert.doesNotMatch(join,banned);
 assert.ok(join.includes('正式在线申请：尚未开放'));
 assert.ok(join.includes('未提交、未发送、未存入 HHBA 数据库'));
 assert.match(css,/prefers-reduced-motion/);
});
