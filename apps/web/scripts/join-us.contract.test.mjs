import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(page, /非 HHBA 实际团队成员/);
  assert.doesNotMatch(page, /className="join-hero-art"/);
  assert.match(css, /\.join-hero-photo img\{/);
});
