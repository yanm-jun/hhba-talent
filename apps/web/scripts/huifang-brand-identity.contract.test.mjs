import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Protect the visible Chinese brand at independently rendered entry points.
const content = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const namedPages = [
  'index.html',
  'src/components/BrandMark.tsx',
  'src/components/Shell.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/AuthChoicePage.tsx',
  'src/pages/PhoneAuthPage.tsx',
  'src/pages/CandidateJobsPage.tsx',
  'src/pages/CandidateMatchPage.tsx',
  'src/pages/WinterInternshipPage.tsx',
  'src/pages/TalentServicePage.tsx',
  'src/pages/OverseasDevelopmentPage.tsx',
  'src/pages/StudyAbroadPage.tsx',
  'src/pages/SiteSearchPage.tsx',
  'src/pages/JoinUsPage.tsx',
  'src/pages/VisionPage.tsx',
  'src/pages/DataUsePage.tsx',
  'src/pages/PersonalCenterPage.tsx',
  'src/components/HomeOpenLetter.tsx',
  'public/letter/index.html',
];

test('汇方职场 is visible at all major platform identity touchpoints', () => {
  for (const path of namedPages) {
    assert.ok(content(path).includes('汇方职场'), path + ' must expose the Chinese brand name');
  }
});

test('the original HHBA logo is preserved alongside the Chinese name', () => {
  const mark = content('src/components/BrandMark.tsx');
  assert.match(mark, /images\/hhba-logo\.svg/);
  assert.match(mark, /HHBA/);
  assert.match(mark, /汇方职场/);
});

test('SEO and the public letter share labels use the Chinese brand', () => {
  const index = content('index.html');
  const letter = content('public/letter/index.html');
  assert.match(index, /<title>汇方职场 HHBA/);
  assert.match(index, /property="og:site_name" content="汇方职场 HHBA"/);
  assert.match(index, /property="og:image"/);
  assert.match(letter, /property="og:site_name" content="汇方职场 HHBA"/);
});

test('search index includes the Chinese brand as a search term', () => {
  const search = content('src/services/siteSearchIndex.ts');
  assert.match(search, /'汇方职场'/);
  assert.match(search, /汇方职场 HHBA 首页/);
});
