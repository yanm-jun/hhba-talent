import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stagePreviewExtension,checkedPreviewOrigin,extensionIdFromPublicKey} from '../scripts/stage-preview.mjs';

const LAB='https://hhba-edge-p0-lab.pages.dev';
const ID='fjkcpgikachmfhajlghgekeicgbdagej';
test('dedicated lab accepts only an exact test Pages hostname',()=>{
 assert.equal(checkedPreviewOrigin(LAB),LAB);
 assert.throws(()=>checkedPreviewOrigin('https://hhba-edge-p0-lab.pages.dev.evil.example'),/仅允许/);
 assert.throws(()=>checkedPreviewOrigin('https://hhba-edge-p0-lab.pages.dev:8443'),/仅允许/);
 assert.throws(()=>checkedPreviewOrigin('http://hhba-edge-p0-lab.pages.dev'),/仅允许/);
});
test('only public key is bundled in lab extension; store manifest never includes a key or persistent host access',async()=>{
 const publicKey=(await readFile(new URL('./fixtures/edge-lab-public-key.b64',import.meta.url),'utf8')).trim();
 assert.equal(extensionIdFromPublicKey(publicKey),ID);
 const dir=await mkdtemp(join(tmpdir(),'hhba-edge-lab-'));
 try{
  const built=await stagePreviewExtension(LAB,dir,{labIdentity:true});
  assert.equal(built.extensionId,ID);
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  assert.equal(manifest.key,publicKey);
  assert.deepEqual(manifest.optional_host_permissions,[LAB+'/*']);
  assert.equal(Object.hasOwn(manifest,'host_permissions'),false);
  const account=await readFile(join(dir,'account.mjs'),'utf8');
  assert.ok(account.includes("export const HHBA_SITE='"+LAB+"';"));
  assert.ok(account.includes("HHBA_SITE+'/api/apply/extension'"));
  assert.ok((await readFile(join(dir,'popup.html'),'utf8')).includes(LAB+'/apply-extension-privacy.html'));
  const prod=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
  assert.equal(Object.hasOwn(prod,'key'),false);
  assert.equal(Object.hasOwn(prod,'host_permissions'),false);
  assert.deepEqual(prod.optional_host_permissions,['https://hhba.work/*']);
  const repeated=await stagePreviewExtension(LAB,dir,{labIdentity:true});
  assert.equal(repeated.extensionId,ID);
  await assert.rejects(stagePreviewExtension('https://good.hhba-talent.pages.dev',dir,{labIdentity:true}),/实验室固定身份/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
