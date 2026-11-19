import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const asset='apps/web/public/images/autumn-real-logos/cn-autumn-001.svg';
const workflow=readFileSync(join(repo,'.github/workflows/hhba-github-pages-preview.yml'),'utf8');
const beginning=workflow.indexOf("- name: Import the first employer's source-backed KPMG trademark SVG");
const command=workflow.indexOf("python - <<'PY'",beginning);
const ending=workflow.indexOf('\n          PY',command);
assert.ok(beginning>=0&&command>beginning&&ending>command,'Canonical KPMG sourcing step must exist');
const python=workflow.slice(command+"python - <<'PY'".length,ending).trimStart().split('\n')
 .map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const force429=`import urllib.request, urllib.error
def simulate_rate_limit(*args, **kwargs):
    raise urllib.error.HTTPError('https://upload.wikimedia.org/',429,'rate limited',{},None)
urllib.request.urlopen=simulate_rate_limit
`;
function execute({present=true,corrupt=false}={}){
 const dir=mkdtempSync(join(tmpdir(),'hhba-kpmg-build-'));
 try{
  const target=join(dir,asset);
  if(present){
   mkdirSync(dirname(target),{recursive:true});
   copyFileSync(join(repo,asset),target);
   if(corrupt)writeFileSync(target,readFileSync(target,'utf8').replace('#003087','#003088'));
  }
  const run=spawnSync('python3',['-c',force429+'\n'+python],{
   cwd:dir,encoding:'utf8',timeout:12000});
  return {status:run.status,output:(run.stdout||'')+(run.stderr||''),
   intact:present&&!corrupt&&readFileSync(target).equals(readFileSync(join(repo,asset)))};
 }finally{rmSync(dir,{force:true,recursive:true});}
}
test('Wikimedia HTTP 429 uses the exact pinned real KPMG SVG rather than blocking build',()=>{
 const value=execute();
 assert.equal(value.status,0,value.output);
 assert.equal(value.intact,true);
 assert.match(value.output,/KPMG_SOURCE_BACKED_PINNED_FALLBACK/);
});
test('a tampered KPMG fallback fails the build instead of silently substituting',()=>{
 const value=execute({corrupt:true});
 assert.notEqual(value.status,0);
 assert.match(value.output,/KPMG_PINNED_FALLBACK_HASH_MISMATCH/);
});
test('a missing pinned KPMG source fails closed, never inventing a brand mark',()=>{
 const value=execute({present:false});
 assert.notEqual(value.status,0);
 assert.match(value.output,/KPMG_SOURCE_UNAVAILABLE_AND_NO_PINNED_COPY/);
});
