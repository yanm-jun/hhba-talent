#!/usr/bin/env node
/**
 * Build refresh-safe GitHub Pages routes for every data-driven employer.
 * One preview contains all approved factory profiles; adding a new JSON
 * requires no route-code edits or employer-specific deployment script.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'dist');
assert(fs.statSync(path.join(base,'index.html')).size>100,'Build dist first');
const files=fs.readdirSync(path.join(root,'src/data/employerProfiles'))
 .filter(file=>/^cn-autumn-\d{3}\.json$/.test(file)).sort();
const routes=new Set(['candidate/jobs','companies/discover']);
let jobs=0;
for(const filename of files){
 const p=JSON.parse(fs.readFileSync(path.join(root,'src/data/employerProfiles',filename),'utf8'));
 routes.add('companies/autumn/'+p.id);
 for(const job of p.jobs){
  routes.add('candidate/jobs/cn-v2-profile-'+p.id+'-'+job.id);
  jobs++;
 }
}
for(const route of routes){
 assert(/^[a-z0-9/_-]+$/.test(route),'Unsafe route: '+route);
 const out=path.join(base,route);
 fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(base,'index.html'),path.join(out,'index.html'));
}
fs.copyFileSync(path.join(base,'index.html'),path.join(base,'404.html'));
fs.writeFileSync(path.join(base,'.nojekyll'),'');
console.log('HHBA_FACTORY_V2_ROUTES_PASS',JSON.stringify({profiles:files.length,jobRoutes:jobs,allRoutes:routes.size}));
