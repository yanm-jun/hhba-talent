import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=path=>resolve(root,path);
const manifest=JSON.parse(readFileSync(file('manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
assert.match(manifest.name,/HHBA/);
assert.ok(manifest.description.length>=30&&manifest.description.length<=132);
assert.deepEqual([...manifest.permissions].sort(),['activeTab','scripting','sidePanel','storage'].sort());
assert.deepEqual(manifest.optional_host_permissions,['https://hhba.work/*']);
assert.ok(!Object.hasOwn(manifest,'host_permissions'),'permanent site-wide host access is not justified');
assert.ok(!Object.hasOwn(manifest,'content_scripts'),'broad auto-execution on recruitment sites is not permitted');
assert.ok(!Object.hasOwn(manifest,'externally_connectable'));
assert.ok(!Object.hasOwn(manifest,'update_url'),'store manages release updates');
const pngHeader=Buffer.from([137,80,78,71,13,10,26,10]);
const icons=[16,32,48,128];
for(const size of icons){
 const rel='icons/icon'+size+'.png';
 assert.equal(manifest.icons[String(size)],rel);
 assert.ok(existsSync(file(rel)),'missing '+rel);
 const raw=readFileSync(file(rel));
 assert.ok(raw.subarray(0,8).equals(pngHeader),'invalid PNG '+rel);
 assert.equal(raw.toString('ascii',12,16),'IHDR');
 assert.equal(raw.readUInt32BE(16),size,'wrong PNG width '+rel);
 assert.equal(raw.readUInt32BE(20),size,'wrong PNG height '+rel);
 assert.equal(raw[24],8,'PNG must use 8-bit per channel');
 assert.equal(raw[25],6,'PNG must be RGBA');
 let offset=8;const idat=[];
 while(offset+12<=raw.length){
  const len=raw.readUInt32BE(offset),type=raw.toString('ascii',offset+4,offset+8);
  assert.ok(len>=0&&offset+12+len<=raw.length,'truncated PNG '+rel);
  if(type==='IDAT')idat.push(raw.subarray(offset+8,offset+8+len));
  offset+=12+len;
  if(type==='IEND')break;
 }
 assert.ok(idat.length>0,'missing PNG image bytes '+rel);
 const decoded=inflateSync(Buffer.concat(idat));
 assert.equal(decoded.length,size*(1+size*4),'invalid decoded PNG data '+rel);
}
assert.equal(manifest.action.default_icon['16'],manifest.icons['16']);
assert.equal(manifest.action.default_icon['32'],manifest.icons['32']);
assert.equal(manifest.action.default_popup,'popup.html');
assert.equal(manifest.side_panel.default_path,'popup.html');
const html=readFileSync(file('popup.html'),'utf8');
assert.ok(html.includes('src="popup.js"'));
assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(html),'remote executable scripts forbidden');
for(const module of ['popup.js','content.js','core.mjs','account.mjs','popup.css']){
 assert.ok(existsSync(file(module)),'missing dependency '+module);
}
const popup=readFileSync(file('popup.js'),'utf8');
const account=readFileSync(file('account.mjs'),'utf8');
assert.ok(!/chrome\.cookies|chrome\.webRequest|eval\s*\(/.test(popup+account),'unnecessary sensitive runtime access');
assert.ok(account.includes("https://hhba.work"));
assert.ok(popup.includes('profile-sync-consent'),'explicit opt-in to account profile import required');
assert.ok(popup.includes('ai-consent'),'external AI consent must be visible');
assert.ok(popup.includes('confirm('),'profile replacement must require confirmation');
console.log('PASS: HHBA Edge MV3 permissions, first-party assets, 4 branded PNG icons and review-only scope');
