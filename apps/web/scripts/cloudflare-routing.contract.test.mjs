import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {test} from 'node:test';

const generate=resolve('scripts/materialize-company-route-entries.mjs');
const company={
  id:'cn-autumn-034',
  schemaVersion:1,
  jobs:Array.from({length:11},(_,i)=>({id:String(i)})),
  media:{photos:[{path:'images/example-1.jpg'},{path:'images/example-2.jpg'}]}
};
for(const [platform,prefix,expect404] of [
  ['cloudflare','/assets/',false],
  ['github','/hhba-talent/assets/',true]
]){
 test(platform+' deep links and fallback',()=>{
  const root=mkdtempSync(join(tmpdir(),'hhba-pages-route-'));
  try {
   mkdirSync(join(root,'dist'),{recursive:true});
   mkdirSync(join(root,'src/data/employerProfiles'),{recursive:true});
   const index='<html><head><link href="'+prefix+'index.css"></head><body><script src="'+prefix+'index.js"></script></body></html>';
   writeFileSync(join(root,'dist/index.html'),index);
   writeFileSync(join(root,'src/data/employerProfiles/cn-autumn-034.json'),JSON.stringify(company));
   const env={...process.env};
   delete env.HHBA_GITHUB_PAGES;
   delete env.HHBA_CLOUDFLARE_PAGES;
   env[platform==='github'?'HHBA_GITHUB_PAGES':'HHBA_CLOUDFLARE_PAGES']='1';
   execFileSync(process.execPath,[generate],{cwd:root,env,stdio:'pipe'});
   assert.equal(readFileSync(join(root,'dist/companies/autumn/cn-autumn-034/index.html'),'utf8'),index);
   assert.equal(readFileSync(join(root,'dist/candidate/jobs/index.html'),'utf8'),index);
   assert.equal(existsSync(join(root,'dist/404.html')),expect404);
  }finally{
   rmSync(root,{force:true,recursive:true});
  }
 });
}
