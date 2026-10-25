import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const path = name => new URL('../src/'+name,import.meta.url);
const read = name => readFileSync(path(name),'utf8');
const shell=read('components/Shell.tsx');
const account=read('components/CandidateAccountDropdown.tsx');
const app=read('main.tsx');
const join=read('pages/JoinUsPage.tsx');
const vision=read('pages/VisionPage.tsx');
const css=read('styles.css');

test('modern 200-company header, personal center and demo navigation survive integration',()=>{
  for(const text of ['企业发现 · 200家','CandidateAccountDropdown','模拟登录 / 注册','招聘市场','demoModeEnabled'])
    assert.ok(shell.includes(text),'missing current header feature '+text);
  for(const text of ['工作台','我的收藏','个人资料','求职偏好','我的简历','求职记录','法律援助','法律服务筹备中'])
    assert.ok(account.includes(text),'missing personal center entry '+text);
  assert.match(shell,/to="\/join">加入我们<\/Link>/);
  assert.match(app,/Company200PreviewPage/);
  assert.match(app,/PersonalCenterPage/);
  assert.match(app,/LegalAidLandingPage/);
  assert.match(app,/AnalyticsConsent/);
});
test('separate Join Us and Vision pages work in the newer single-page router',()=>{
  assert.match(app,/if\(route==='\/join'\)return <JoinUsPage user=\{user\}\/>/);
  assert.match(app,/if\(route==='\/vision'\)return <VisionPage user=\{user\}\/>/);
  assert.match(join,/className="join-btn join-btn-light" to="\/vision">了解我们的理念/);
  assert.match(join,/为什么是 HHBA？/);
  assert.match(join,/join-values-grid/);
  assert.match(join,/values\.map/);
  assert.doesNotMatch(join,/<VisionSection/);
  assert.match(vision,/aria-label="品牌理念页面导航"/);
  assert.match(vision,/to="\/join"/);
  assert.match(vision,/THE WORLD WE ENVISION/);
  assert.match(css,/\.join-vision-navigation\{/);
  assert.match(css,/\.join-values-grid\{/);
});
test('all four social aspirations and founder manifesto remain complete and distinct',()=>{
  const headings=[
    '让每一个认真生活的人，都有机会走向更好的生活。',
    '让企业的繁荣与员工的成长，成为彼此成就的力量。',
    '让真正关心员工的企业，拥有被世界认可的机会。',
    '让经济的发展，最终转化为更多人的幸福。'
  ];
  let previous=-1;
  for(const line of headings){
    const i=vision.indexOf(line);
    assert.ok(i>previous,'missing/out of order vision section: '+line);previous=i;
  }
  for(const text of ['每一份简历背后，都是一个认真生活的人。','让劳动更有尊严，让商业更有温度','创办者 · 闫明骏']){
    assert.ok(join.includes(text),'founder letter missing: '+text);
    assert.ok(!vision.includes(text),'vision repeats founder letter: '+text);
  }
  assert.match(join,/技术负责人 \/ 全栈架构工程师/);
  assert.match(join,/企业治理与劳动权益研究伙伴/);
  assert.match(join,/薪酬与权益现状/);
});
test('signed founder photo and team hero image are real WebP assets',()=>{
  for(const name of ['hhba-founder-signature.webp','hhba-join-team.webp']){
    const p=new URL('../public/images/'+name,import.meta.url);
    assert.ok(existsSync(p),'missing '+name);
    const b=readFileSync(p);
    assert.equal(b.subarray(0,4).toString('ascii'),'RIFF');
    assert.equal(b.subarray(8,12).toString('ascii'),'WEBP');
    assert.ok(b.length>12000,'invalid image '+name);
  }
  assert.match(join,/images\/hhba-founder-signature\.webp/);
  assert.match(join,/images\/hhba-join-team\.webp/);
});
test('candidate application remains private demo and is not deceptively online',()=>{
  for(const banned of [/\bfetch\s*\(/,/localStorage/,/sessionStorage/,/sendBeacon/,/XMLHttpRequest/,/\bapi\./]){
    assert.doesNotMatch(join,banned);
  }
  assert.match(join,/未提交、未发送、未存入 HHBA 数据库/);
  assert.match(join,/正式在线申请：尚未开放/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
