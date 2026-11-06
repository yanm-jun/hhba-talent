import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkedPreviewOrigin,stagePreviewExtension} from '../scripts/stage-preview.mjs';
test('isolation: staging only accepts exact HHBA Cloudflare Pages Preview domains',()=>{
 for(const bad of ['https://hhba.work/','http://ac8178aa.hhba-talent.pages.dev/','https://hhba-talent.pages.dev/','https://attacker.hhba-talent.pages.dev.evil.com/','https://ac8178aa.hhba-talent.pages.dev/extra','https://ac8178aa.hhba-talent.pages.dev/?x=1']){
  assert.throws(()=>checkedPreviewOrigin(bad),/仅允许/,bad);
 }
 assert.equal(checkedPreviewOrigin('https://ac8178aa.hhba-talent.pages.dev/'),'https://ac8178aa.hhba-talent.pages.dev');
});
test('preview extension differs from official store package and never edits original files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hhba-edge-preview-'));
 try{
  const url='https://ac8178aa.hhba-talent.pages.dev';
  const res=await stagePreviewExtension(url,dir);
  assert.equal(res.origin,url);
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.optional_host_permissions,[url+'/*']);
  assert.ok(manifest.name.includes('隔离预览测试'));
  assert.deepEqual(manifest.permissions,['activeTab','scripting','storage','sidePanel']);
  const account=await readFile(join(dir,'account.mjs'),'utf8');
  const popup=await readFile(join(dir,'popup.js'),'utf8');
  const html=await readFile(join(dir,'popup.html'),'utf8');
  const note=await readFile(join(dir,'REVIEW_ONLY.txt'),'utf8');
  assert.ok(account.includes(`export const HHBA_SITE='${url}';`));
  assert.ok(popup.includes(url+'/candidate/account/resume'));
  assert.ok(popup.includes(url+'/candidate/account/apply-assistant'));
  assert.ok(html.includes(url+'/apply-extension-privacy.html'));
  assert.ok(!popup.includes('https://hhba.work/'));
  assert.ok(!account.includes('https://hhba.work'));
  assert.ok(note.includes('Not for Edge Add-ons submission'));
  for(const size of [16,32,48,128]){
   const p=join(dir,'icons/icon'+size+'.png');
   assert.ok((await stat(p)).size>300);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
