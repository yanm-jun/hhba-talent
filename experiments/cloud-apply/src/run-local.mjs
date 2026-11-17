import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareFillPlan, transition } from './core.mjs';
import { scanPage, writeVerified } from './browser-steps.mjs';
import { openBrowser } from './local-cdp.mjs';

const html = await readFile(fileURLToPath(new URL('../fixture/application.html', import.meta.url)), 'utf8');
let browser;
try {
  browser = await openBrowser();
  await browser.client.page.gotoFixture(html);
  const profile = {
    fullName: '测试用户', phone: '13800000000', email: 'demo@example.org',
    school: '示例大学', major: '计算机科学', degree: '本科'
  };
  const state = transition('created', 'running');
  const fields = await scanPage(browser.client.page);
  const plan = prepareFillPlan(fields, profile);
  const results = await writeVerified(browser.client.page, plan.actions);
  const status = transition(state, results.every(x => x.ok) ? 'review' : 'needs_user');
  const submittedText = await browser.client.page.evaluate(() => document.querySelector('#submission').textContent);
  if (status !== 'review' || submittedText !== '未提交' || results.length !== 6) {
    throw new Error('PoC assertion failed');
  }
  console.log(JSON.stringify({
    status, fields: fields.length, verifiedWrites: results.length,
    manualFields: plan.needsUser.length, skipped: plan.skipped.length, submitted: false
  }, null, 2));
} finally {
  if (browser) await browser.close();
}
