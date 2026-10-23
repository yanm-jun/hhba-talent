// HHBA Phase 1.2: real-browser smoke for GitHub Pages offline demo.
// Usage after npm run build: node scripts/ai-company-preview-smoke.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4179/hhba-talent/ai-company-preview/';
const browserServer = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'preview',
  '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'pipe', env: { ...process.env, HHBA_GITHUB_PAGES: '1', HHBA_PAGES_BASE: '/hhba-talent/ai-company-preview/' } });
let browser;
let errors = [];
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (browserServer.exitCode !== null) throw new Error('Preview server exited');
    try { const reply = await fetch(ROOT); ready = reply.ok; if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  assert(ready, 'Vite preview server must respond');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()) });
  page.on('requestfailed', req=>errors.push('request: '+req.url()+' '+req.failure()?.errorText));
  await page.goto(ROOT, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: '智能找企业' }).waitFor({timeout:12000});
  } catch (err) {
    console.error('PREVIEW_DIAGNOSTIC_URL', page.url());
    console.error('PREVIEW_DIAGNOSTIC_ERRORS', JSON.stringify(errors));
    console.error('PREVIEW_DIAGNOSTIC_HTML', (await page.content()).slice(0,2500));
    console.error('PREVIEW_DIAGNOSTIC_BODY', (await page.locator('body').innerText()).slice(0,1700));
    throw err;
  }
  assert.match(await page.locator('.ai-company-demo-banner').innerText(), /非.*AI|不会向 DeepSeek/);
  assert.match(await page.locator('.ai-company-status').innerText(), /AI 未接入/);
  await page.locator('.ai-company-input textarea').fill('有汽车行业工作经验，希望了解汽车企业');
  await page.getByRole('button', { name: /本地检索企业/ }).click();
  const region = page.getByTestId('demo-results');
  await region.waitFor();
  assert.match(await region.innerText(), /长城汽车/);
  assert.match(await region.innerText(), /非 AI 推荐/);
  await mkdir('preview-screenshots', { recursive: true });
  await page.screenshot({ path: 'preview-screenshots/desktop.png', fullPage: true });
  await page.getByRole('button', { name: '原有岗位搜索' }).click();
  await page.locator('.unified-job-search input').waitFor();
  await page.getByRole('button', { name: 'AI 智能找企业' }).click();
  await page.locator('.ai-company-input textarea').fill('OpenAI');
  await page.getByRole('button', { name: /本地检索企业/ }).click();
  await page.getByTestId('demo-results').getByRole('link', { name: /企业资料/ }).first().click();
  await page.getByText('OpenAI', { exact: true }).first().waitFor();
  assert.match(page.url(), /\/companies\/openai$/);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true,
    deviceScaleFactor: 1 });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(ROOT, { waitUntil: 'domcontentloaded' });
  await mobile.locator('.ai-company-input textarea').fill('比亚迪');
  await mobile.getByRole('button', { name: /本地检索企业/ }).click();
  assert.match(await mobile.getByTestId('demo-results').innerText(), /比亚迪/);
  await mobile.screenshot({ path: 'preview-screenshots/mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'No uncaught client-side JavaScript exceptions');
  console.log('HHBA_COMPANY_PAGES_BROWSER_SMOKE_PASS');
} finally {
  await browser?.close();
  browserServer.kill('SIGTERM');
}
