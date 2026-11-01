#!/usr/bin/env node
/**
 * GitHub Pages serves directory /index.html files with HTTP 200 for direct
 * links and refresh. A 404.html fallback alone returns HTTP 404 and is
 * vulnerable to another Pages publisher omitting the fallback.
 *
 * Generate every V2 company route from approved data in the same built site.
 * Keep the canonical Vite shell unchanged (it already uses absolute BASE_URL).
 */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root='dist';
const shell=readFileSync(join(root,'index.html'),'utf8');
// GitHub Pages is mounted under /hhba-talent/, whereas Cloudflare Pages
// serves the identical Vite application at /.  Both must reuse the same
// entrypoint and never silently publish a build with missing JS assets.
const githubAssetBase = shell.includes('/hhba-talent/assets/');
const cloudflareAssetBase = /(?:src|href)="\/assets\//.test(shell);
assert(githubAssetBase || cloudflareAssetBase, 'Expected Vite asset base missing from index.html');
if(process.env.HHBA_CLOUDFLARE_PAGES==='1')
  assert(cloudflareAssetBase && !githubAssetBase, 'Cloudflare Pages must use root Vite assets');
if(process.env.HHBA_GITHUB_PAGES==='1')
  assert(githubAssetBase, 'GitHub Pages Vite base path was not built');
const profiles='src/data/employerProfiles';
const ids=readdirSync(profiles).filter(f=>/^cn-autumn-\d{3}\.json$/.test(f)).map(file=>{
 const p=JSON.parse(readFileSync(join(profiles,file),'utf8'));
 assert.equal(p.id,file.replace(/\.json$/,''));
 assert.equal(p.schemaVersion,1);
 if(p.id==='cn-autumn-034')assert(p.jobs.length===11&&p.media.photos.length===2,'PXW 034 profile incomplete');
 return p.id;
}).sort();
assert(ids.includes('cn-autumn-034'),'PXW #034 missing from approved V2 profiles');
const routes=ids.map(id=>'companies/autumn/'+id);
for(const route of routes){
 const target=join(root,route,'index.html');
 mkdirSync(join(root,route),{recursive:true});
 writeFileSync(target,shell);
 assert.equal(readFileSync(target,'utf8'),shell);
}
// Cloudflare's native SPA fallback serves client routes from index.html
// when there is NO 404.html. A custom 404.html would turn unmaterialized
// routes (cities, studies, recruiter, etc.) into HTTP 404 responses.
if(process.env.HHBA_CLOUDFLARE_PAGES!=='1'){
 const fallback=join(root,'404.html');
 writeFileSync(fallback,shell);
 assert(existsSync(fallback)&&statSync(fallback).size>100);
}else{
 assert(!existsSync(join(root,'404.html')), 'Cloudflare SPA fallback blocked by 404.html');
}
for(const route of ['candidate/jobs','candidate/match']){
 const target=join(root,route,'index.html');
 mkdirSync(join(root,route),{recursive:true});
 if(!existsSync(target))writeFileSync(target,shell);
}
console.log('HHBA_V2_COMPANY_DEEP_LINK_HTTP_200_FILES_READY',JSON.stringify({companies:ids.length,route:'companies/autumn/cn-autumn-034/index.html',fallback:process.env.HHBA_CLOUDFLARE_PAGES==='1'?'native-spa':'404.html'}));
