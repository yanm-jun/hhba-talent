import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
const run=promisify(execFile);
const currentScript=fileURLToPath(new URL('./import-domestic-company-media.mjs',import.meta.url));
const bundler=fileURLToPath(new URL('./prepare-domestic-company-media.mjs',import.meta.url));
const company='测试企业有限公司';
const json=(file)=>JSON.parse(readFileSync(file,'utf8'));

test('JPEG logo, PNG office photo and JPG screenshot import with no original photo URL',async()=>{
 const work=mkdtempSync(path.join(os.tmpdir(),'hhba-media-fixture-'));
 try{
  mkdirSync(path.join(work,'src','data'),{recursive:true});
  mkdirSync(path.join(work,'media-inbox',company),{recursive:true});
  const folder=path.join(work,'media-inbox',company);
  writeFileSync(path.join(work,'src/data/domesticComplete50Target.json'),JSON.stringify({companyNames:[company]}));
  writeFileSync(path.join(work,'src/data/domesticCareerProfiles.json'),JSON.stringify({[company]:{displayName:company,photos:[]}}));
  writeFileSync(path.join(work,'src/data/domesticMediaBundle.json'),JSON.stringify({version:1,companies:{}}));
  const {default:sharp}=await import('sharp');
  const input={create:{width:240,height:100,channels:3,background:'#dfecea'}};
  writeFileSync(path.join(folder,'logo.jpg'),await sharp(input).jpeg().toBuffer());
  writeFileSync(path.join(folder,'office-1.png'),await sharp(input).png().toBuffer());
  writeFileSync(path.join(folder,'screenshot-1.jpeg'),await sharp(input).jpeg().toBuffer());
  writeFileSync(path.join(folder,'微信图片_20261023.jpg'),await sharp(input).jpeg().toBuffer());
  writeFileSync(path.join(folder,'公司总部大楼.png'),await sharp(input).png().toBuffer());
  const first=await run(process.execPath,[currentScript],{cwd:work,timeout:25000});
  assert.match(first.stdout,/HHBA_USER_MEDIA_IMPORT/);
  let p=json(path.join(work,'src/data/domesticCareerProfiles.json'))[company];
  let b=json(path.join(work,'src/data/domesticMediaBundle.json')).companies[company];
  assert.equal(p.brandAssetStatus,'user_provided_logo_pending_identity');
  assert.equal(b.brand.state,'ready');
  assert.equal(p.photos.length,4);
  assert.deepEqual(new Set(p.photos.map(x=>x.kind)),new Set(['office','screenshot','headquarters']));
  assert.ok(p.photos.every(x=>x.source==='user_submission'&&x.localPath.startsWith('domestic-media/')));
  assert.ok(p.photos.every(x=>existsSync(path.join(work,'public',x.localPath))));
  assert.equal(b.photos.filter(x=>x.state==='ready').length,4);
  assert.ok(existsSync(path.join(work,'public',b.brand.path)));
  // The following automated preview build must preserve user images and provenance.
  await run(process.execPath,[bundler],{cwd:work,timeout:25000});
  b=json(path.join(work,'src/data/domesticMediaBundle.json')).companies[company];
  assert.equal(b.brand.state,'ready');
  assert.equal(b.brand.classification,'user_submitted_logo_pending_identity');
  assert.equal(b.photos.filter(x=>x.state==='ready').length,4);
  // Repeated pipeline builds must be idempotent rather than duplicate photos.
  await run(process.execPath,[currentScript],{cwd:work,timeout:25000});
  p=json(path.join(work,'src/data/domesticCareerProfiles.json'))[company];
  assert.equal(p.photos.length,4);
  // User confirmation upgrades identity evidence without requiring SVG/HTTPS.
  writeFileSync(path.join(folder,'sources.json'),JSON.stringify({confirmedCompany:company}));
  await run(process.execPath,[currentScript],{cwd:work,timeout:25000});
  p=json(path.join(work,'src/data/domesticCareerProfiles.json'))[company];
  assert.equal(p.brandAssetStatus,'user_provided_logo_confirmed');
  assert.ok(p.brandIdentityEvidence&&p.brandVerifiedAt);
 }finally{rmSync(work,{recursive:true,force:true})}
});
