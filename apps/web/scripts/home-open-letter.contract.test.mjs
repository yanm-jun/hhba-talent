import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const home = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const banner = fs.readFileSync('src/components/HomePeopleBanner.tsx', 'utf8');
const modal = fs.readFileSync('src/components/HomeOpenLetter.tsx', 'utf8');
const css = fs.readFileSync('src/styles/home-open-letter.css', 'utf8');
const letter = fs.readFileSync('src/data/publicLetter.ts', 'utf8');
const html = fs.readFileSync('public/letter/index.html', 'utf8');
test('the existing HHBA homepage and people banner are preserved', () => {
  assert.match(home, /<HomePeopleBanner\/>/);
  assert.match(home, /<HomeCompanyMarquee\/>/);
  assert.match(home, /<UnifiedJobMarket compact\/>/);
  assert.match(home, /<HomeOpenLetter\/>/);
  assert.match(home, /我要应聘/);
  assert.match(home, /我要招人/);
  assert.match(home, /hhba:open-letter/);
  assert.match(banner, /hhba-people-group-hd\.avif/);
});
test('letter displays only once per browser session unless manually reopened or explicitly shared', () => {
  assert.match(modal, /sessionStorage\.getItem\(SESSION_KEY\)/);
  assert.match(modal, /sessionStorage\.setItem\(SESSION_KEY/);
  assert.match(modal, /new URLSearchParams\(window\.location\.search\)\.get\('letter'\) === '1'/);
  assert.match(modal, /window\.addEventListener\(OPEN_EVENT, reopen\)/);
  assert.match(modal, /removeExplicitFlag\(\)/);
  assert.doesNotMatch(modal, /localStorage/);
});
test('accessible non-blocking envelope, full letter, exit and share controls', () => {
  for (const word of ['role="dialog"','aria-modal="true"','aria-labelledby="hhba-letter-title"','data-letter-open','data-letter-close',
    '拆开这封信','暂不阅读，进入首页','读完了，进入 HHBA','分享这封信','复制链接','navigator.share','navigator.clipboard.writeText',
    'Escape','Tab','document.body.style.overflow','createPortal']) assert.ok(modal.includes(word), 'Missing '+word);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /hhba-letter-unfold/);
});
test('published founder-letter copy covers the vision, business model and welcome to competitors', () => {
  for (const phrase of ['每一个认真生活','这就是 HHBA 想做的事情','HHBA 是一个商业项目','商业让我们有能力走得更远',
    '不害怕有人借鉴 HHBA 的理念','竞争对手','让劳动更有尊严，让商业更有温度','从人民中来，到人民中去']) assert.ok(letter.includes(phrase), 'Missing '+phrase);
  assert.ok((letter.match(/text:'/g)||[]).length >= 35, 'Full letter must not be replaced by a teaser');
});
test('independent /letter/ sharing entry has static social preview and opens the real envelope', () => {
  assert.match(modal, /new URL\('letter\/', base\)/);
  for (const phrase of ['og:title','og:description','og:image','og:url','twitter:card','rel="canonical"',
    'https://yanm-jun.github.io/hhba-talent/letter/','../?letter=1']) assert.ok(html.includes(phrase), 'Missing '+phrase);
  assert.ok(!html.includes('noindex'), 'Public letter must be shareable and indexable');
});
