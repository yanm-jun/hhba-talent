import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createBrowserRunClient } from './cloudflare-browser.mjs';

const html = await readFile(fileURLToPath(new URL('../fixture/application.html', import.meta.url)), 'utf8');
const client = createBrowserRunClient({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_BROWSER_RUN_TOKEN,
});

// Session and Quick Action exercise different Cloudflare interfaces.
// Never return session IDs, signed Live View URLs, auth headers or HTML here.
const session = await client.withSession(async browser => {
  const tab = await browser.openFixtureTab(html);
  const inspected = await browser.inspectTabs();
  if (!tab.created || !inspected.hasFixture || !inspected.hasLiveView) {
    throw new Error('Cloudflare remote session test failed');
  }
  return { launched: true, fixtureTab: true, liveViewAvailable: true };
});
const fill = await client.runSyntheticContentSmoke(html);
console.log(JSON.stringify({ session, fill, cloudTestOnly: true }, null, 2));
