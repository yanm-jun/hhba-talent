import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const page = src('pages/JoinUsPage.tsx');
const visionPage = src('pages/VisionPage.tsx');
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

test('capability-gap recruitment cards define six clear specialty tracks and open self-introduction', () => {
  const roles = [
    ['tech-lead','技术负责人 / 全栈架构工程师'],
    ['backend','后端与数据库工程师'],
    ['ai-data','招聘数据与 AI 搜索工程师'],
    ['governance','企业治理与劳动权益研究伙伴'],
    ['business','企业合作与商业发展伙伴'],
    ['product','产品设计 / 前端体验伙伴'],
    ['other','其他专业 / 自荐加入']
  ];
  const dataSection = page.slice(page.indexOf('const roles = ['),page.indexOf('type Direction ='));
  for(const [id,title] of roles){
    assert.ok(dataSection.includes("id:'"+id+"'"), 'missing track '+id);
    assert.ok(dataSection.includes("title:'"+title+"'"), 'missing role '+title);
  }
  assert.equal((dataSection.match(/\bmission:/g)||[]).length,7);
  assert.equal((dataSection.match(/\bresponsibilities:/g)||[]).length,7);
  assert.equal((dataSection.match(/\brequired:/g)||[]).length,7);
  assert.equal((dataSection.match(/\bpreferred:/g)||[]).length,7);
  assert.equal((dataSection.match(/\bchallenge:/g)||[]).length,7);
  assert.equal((dataSection.match(/\bcooperation:/g)||[]).length,7);
  assert.match(page,/roles\.map\(r => <details/);
  assert.match(page,/roles\.map\(r=><option/);
  assert.match(page,/applyFor\(r\.id\)/);
});
test('candidate-facing role details include responsibilities, constraints and no fictitious paid positions',()=>{
  for(const text of [
    '你将负责什么','我们希望你具备','具备这些会更好',
    '合作方式与当前阶段','岗位使命','我们会如何了解你的能力',
    '薪酬与权益现状','不要求无偿完成可直接投入生产的试用项目',
    '工作时间、交付与知识产权归属','外部专业顾问',
    '当前最需要：技术负责人、后端数据库、招聘数据与搜索'
  ])assert.ok(page.includes(text),text);
  assert.ok(page.includes('未来制度目标不构成自动兑现承诺'));
  assert.doesNotMatch(page,/正式招聘职位，月薪|月薪.{0,8}[0-9]{4,}/);
  assert.match(css,/\.join-role-detail-grid\{/);
  assert.match(css,/@media\(max-width:560px\)/);
});

test('Join Us restores its original four cards and the hero vision button navigates to a new page', () => {
  for(const title of ['为什么是 HHBA？','连接更广阔的机会','认真对待劳动者','让技术真正有用','与建设者分享成长']){
    assert.ok(page.includes(title),'missing restored content: '+title);
  }
  assert.match(page,/const values = \[/);
  assert.match(page,/values\.map\(v => <article/);
  assert.match(page,/className="join-values-grid"/);
  assert.match(page,/className="join-btn join-btn-light" to="\/vision">了解我们的理念/);
  assert.doesNotMatch(page,/<VisionSection|const futureVisions =/);
  assert.match(main,/import \{ VisionPage \} from '\.\/pages\/VisionPage'/);
  assert.match(main,/if\(route==='\/vision'\)return <VisionPage user=\{user\}\/>/);
  assert.match(css,/\.join-values-grid\{/);
});
test('separate vision page is accessible with back navigation and preserves all four aspirations', () => {
  assert.match(visionPage,/export function VisionPage/);
  assert.match(visionPage,/<Shell user=\{user\}>/);
  assert.match(visionPage,/className="join-page hhba-vision-page"/);
  assert.match(visionPage,/aria-label="品牌理念页面导航"/);
  assert.match(visionPage,/to="\/join"/);
  assert.match(visionPage,/window\.scrollTo\(0, 0\)/);
  const visionData = visionPage.slice(visionPage.indexOf('const futureVisions = ['),visionPage.indexOf('export function VisionPage'));
  const visionView = visionPage.slice(visionPage.indexOf('export function VisionPage'));
  const chapterTerms=[
    'FOR EVERY PERSON','让每一个认真生活的人，都有机会走向更好的生活。',
    'FOR EVERY ORGANIZATION','让企业的繁荣与员工的成长，成为彼此成就的力量。',
    'FOR A BETTER MARKET','让真正关心员工的企业，拥有被世界认可的机会。',
    'FOR THE FUTURE OF SOCIETY','让经济的发展，最终转化为更多人的幸福。'
  ];
  let previous=-1;
  for(const term of chapterTerms){
    const current=visionData.indexOf(term);
    assert.ok(current>previous,'Vision chapter missing or out of order: '+term);
    previous=current;
  }
  const viewTerms=[
    '我们相信，','一个更好的商业社会，','应该让每一个参与创造价值的人，',
    '都拥有更好的未来。',
    'THE WORLD WE ENVISION','让人的成长，',
    'FROM BELIEF TO PRACTICE','我们所向往的未来，'
  ];
  previous=-1;
  for(const term of viewTerms){
    const current=visionView.indexOf(term);
    assert.ok(current>previous,'Vision sequence missing or out of order: '+term);
    previous=current;
  }
  assert.equal((visionPage.match(/number: '0[1-4]'/g)||[]).length,4);
  assert.match(visionPage,/IntersectionObserver/);
  assert.match(visionPage,/prefers-reduced-motion: reduce/);
  assert.match(css,/\.join-vision-navigation\{/);
  assert.match(css,/@media\(max-width:650px\)/);
});
test('original founder manifesto, signed image and recruiting details remain on Join Us, not Vision', () => {
  for(const wording of [
    '每一份简历背后，都是一个认真生活的人。',
    '让劳动更有尊严，让商业更有温度',
    '让劳动获得尊严，让招聘回归诚信。'
  ]){
    assert.ok(page.includes(wording),'founder text lost: '+wording);
    assert.ok(!visionPage.includes(wording),'vision duplicates letter: '+wording);
  }
  for(const phrase of [
    'images/hhba-founder-signature.webp','技术负责人 / 全栈架构工程师',
    '企业治理与劳动权益研究伙伴','薪酬与权益现状',
    'join-progress-section','join-apply-section'
  ])assert.ok(page.includes(phrase),'join page content missing: '+phrase);
  assert.doesNotMatch(visionPage,/PostgreSQL|API 接口|数据库|代码治理|薪酬与权益现状/);
});
