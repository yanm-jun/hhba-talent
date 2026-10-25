import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const page = src('pages/JoinUsPage.tsx');
const shell = src('components/Shell.tsx');
const main = src('main.tsx');
const css = src('styles.css');

test('home header visibly links to HHBA join-us without replacing account entry', () => {
  assert.match(shell, /className="join-nav-link" to="\/join"/);
  assert.match(shell, /登录 \/ 注册/);
  assert.match(main, /if\(route==='\/join'\)return <JoinUsPage user=\{user\}\/>/);
});

test('full public careers sections and honest-stage disclaimer remain present', () => {
  for (const expected of [
    '我们还想创造一家值得工作的公司', '为什么是 HHBA',
    '好的工作，不应该只属于别人', '六险二金的保障目标',
    '长期股权激励', '公司筹备与融资前阶段',
    '寻找能够一起把事情做成的人', '公司设立与融资',
    '工作范围', '书面协议', '未来制度建设目标',
    '正式在线申请：尚未开放', '未提交、未发送、未存入 HHBA 数据库'
  ]) assert.ok(page.includes(expected), 'missing: ' + expected);
});

test('public demo keeps applicant PII ephemeral and never calls privileged endpoints', () => {
  for(const banned of [
    /\bfetch\s*\(/, /localStorage/, /sessionStorage/, /sendBeacon/, /XMLHttpRequest/,
    /\bapi\./, /\/api\/admin/, /mailto:/,
    /navigator\.clipboard/, /document\.cookie/
  ]) assert.doesNotMatch(page,banned);
  assert.match(page, /useState<FormData>\(blank\)/);
  assert.match(page, /e\.preventDefault\(\)/);
  assert.match(page, /setPreview\(true\)/);
  assert.match(page, /不会发送或保存你填写的任何资料/);
  assert.doesNotMatch(page, /表单提交成功|审核已通过|保证兑现|已获融资/);
});

test('responsive layout and reduced motion keep entry usable on phones', () => {
  assert.match(css,/\.join-hero\{/);
  assert.match(css,/\.join-values-grid/);
  assert.match(css,/\.join-form-shell/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(page, /aria-labelledby="join-apply-title"/);
});


test('selected real team photo is committed locally, is WebP, and is not labelled as HHBA employees', () => {
  const photo = readFileSync(new URL('../public/images/hhba-join-team.webp', import.meta.url));
  assert.equal(photo.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(photo.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(photo.byteLength > 20_000 && photo.byteLength < 250_000);
  assert.match(page, /images\/hhba-join-team\.webp/);
  assert.match(page, /alt="四位同事围绕笔记本电脑讨论项目的真实摄影照片"/);
  assert.doesNotMatch(page, /团队协作场景示意 · 非 HHBA 实际团队成员/);
  assert.doesNotMatch(page, /className="join-hero-art"/);
  assert.match(css, /\.join-hero-photo img\{/);
});

test('founder manifesto appears below the four-stage timeline and before applicant form', () => {
  const progress = page.indexOf('className="join-section join-progress-section"');
  const manifesto = page.indexOf('<BrandManifesto />');
  const application = page.indexOf('className="join-section join-apply-section"');
  assert.ok(progress >= 0 && progress < manifesto && manifesto < application);
  assert.match(page, /A NOTE FROM HHBA'S FOUNDER/);
  assert.match(page, /让劳动更有尊严，让商业更有温度/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /prefers-reduced-motion/);
  assert.match(css, /join-manifesto-animate/);
  assert.doesNotMatch(page, /images\/hhba-brand-manifesto\.webp/);
  assert.doesNotMatch(page, /className="join-manifesto-letter"/);
});

test('founder letter keeps the complete user-approved Chinese manifesto in original order', () => {
  const paragraphs = [
    '每一份简历背后，都是一个认真生活的人。',
    '但现实并不总是如此。虚假的招聘信息、不透明的薪酬待遇',
    '求职者可以不被录用，但不应该被欺骗；员工可以承担责任，但不应该失去尊严；企业可以追求利润，但不应该忽视创造价值的人。',
    '我们不希望劳动者与企业彼此对立。',
    '我们不只是希望发现问题，更希望推动问题得到解决。',
    '我们知道，一个平台无法改变所有问题，但改变，总需要有人开始。',
    '让劳动获得尊严，让招聘回归诚信。让善待劳动者，成为真正值得坚持的商业选择。',
    'HHBA — Human Capability Network',
    '让机会与人才，找到彼此。',
    '创办者 · 闫明骏'
  ];
  let last=-1;
  const section=page.slice(page.indexOf('function BrandManifesto()'),page.indexOf('export function JoinUsPage'));
  for(const para of paragraphs){
    const idx=section.indexOf(para);
    assert.ok(idx>last,'Manifesto clause missing/out of order: '+para);
    last=idx;
  }
  assert.match(css, /background:#f2f0ed/);
  assert.match(css, /join-manifesto-signature/);
  assert.match(css, /@media\(max-width:680px\)/);
});

test('founder hand-written signature is a nonempty local transparent webp asset', () => {
  const photo=readFileSync(new URL('../public/images/hhba-founder-signature.webp',import.meta.url));
  assert.equal(photo.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(photo.subarray(8,12).toString('ascii'),'WEBP');
  assert.ok(photo.byteLength>12000 && photo.byteLength<150000);
  assert.ok(page.includes('images/hhba-founder-signature.webp'));
  assert.match(page,/alt="闫明骏的手写姓名签名"/);
});
