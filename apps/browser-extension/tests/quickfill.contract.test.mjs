import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('V0.3 is still a least-privilege activeTab-only browser extension',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 assert.equal(manifest.version,'0.3.0');
 assert.equal(manifest.manifest_version,3);
 assert.ok(manifest.permissions.includes('activeTab'));
 assert.ok(!manifest.host_permissions && !manifest.content_scripts);
});
test('one explicit user click initiates scan, strict plan, fill, readback and undo',()=>{
 const html=read('popup.html'),js=read('popup.js'),content=read('content.js');
 assert.ok(html.includes('id="quickfill"'));
 assert.ok(js.includes('$("quickfill").addEventListener("click"'));
 assert.ok(js.includes('lastPlan.filter(x=>x.eligible)'));
 assert.ok(js.includes('ask("HHBA_SCAN")')&&js.includes('ask("HHBA_FILL"'));
 assert.ok(content.includes('HHBA_UNDO'));
 assert.ok(!/\.submit\s*\(/.test(content));
 assert.ok(!/requestSubmit\s*\(/.test(content));
 assert.ok(!/fetch\s*\(/.test(content));
 assert.ok(!/fetch\s*\(/.test(js));
});
