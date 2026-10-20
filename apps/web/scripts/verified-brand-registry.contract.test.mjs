import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const registry=JSON.parse(read('../src/data/verifiedBrandAssets.json'));
const proof=JSON.parse(read('../public/brands/PROVENANCE.json'));
const brandModule=read('../src/services/verifiedBrandRegistry.ts');
const brandComponent=read('../src/components/EmployerBrandLogo.tsx');
const market=read('../src/components/UnifiedJobMarket.tsx');
const companies=read('../src/pages/IndexedCompanyPage.tsx');
const directory=read('../src/pages/CompanyDirectoryPage.tsx');
const server=read('../../../ops/legacy-marketplace/railway-function-20261018.ts');
const expected=[
 ['Stripe','greenhouse','stripe'],['Coinbase','greenhouse','coinbase'],
 ['Airbnb','greenhouse','airbnb'],['Databricks','greenhouse','databricks'],
 ['DoorDash','greenhouse','doordashusa'],['Spotify','lever','spotify'],
 ['Canonical','greenhouse','canonical'],['Palantir','lever','palantir'],
 ['Figma','greenhouse','figma'],['Discord','greenhouse','discord'],
 ['Reddit','greenhouse','reddit'],['Airtable','greenhouse','airtable'],
 ['Robinhood','greenhouse','robinhood'],['GitLab','greenhouse','gitlab'],
 ['Cloudflare','greenhouse','cloudflare'],['Vercel','greenhouse','vercel'],
 ['Wise','greenhouse','wise'],['Coursera','greenhouse','coursera'],
 ['Notion','ashby','notion'],['Linear','ashby','linear'],
 ['Perplexity','ashby','perplexity'],['ElevenLabs','ashby','elevenlabs'],
 ['Cursor','ashby','cursor'],['Replit','ashby','replit'],
 ['PostHog','ashby','posthog']
];
const identity=row=>[row.company,row.platform,row.source].join('\0');

test('current employer brands and three original icons each have exact ATS identities',()=>{
 assert.equal(registry.schemaVersion,1);
 assert.equal(registry.records.length,50);
 const keys=registry.records.map(identity);
 assert.equal(new Set(keys).size,50);
 for(const [company,platform,source] of expected){
  const item=registry.records.find(row=>row.company===company&&row.platform===platform&&row.source===source);
  assert.ok(item,'missing exact employer source '+company);
  assert.equal(item.kind,'source-traced-vector');
  assert.ok(/^si-[a-z0-9]+\.svg$/.test(item.file));
  assert.ok(/^#[a-fA-F0-9]{6}$/.test(item.color));
 }
 for(const label of ['OpenAI','Anthropic','SpaceX']){
  const item=registry.records.find(row=>row.company===label);
  assert.equal(item?.kind,'original-source');
 }
});
test('all current source icons match pinned, immutable SHA-256 with exact provenance',()=>{
 assert.equal(proof.schemaVersion,1);
 assert.equal(proof.records.length,50);
 assert.ok(proof.sourcePolicy.includes('does not grant trademark rights'));
 const seen=new Set();
 for(const logo of registry.records){
  const entry=proof.records.find(x=>x.file===logo.file);
  assert.ok(entry,'missing provenance '+logo.file);
  assert.equal(entry.company,logo.company);
  assert.equal(entry.platform,logo.platform);
  assert.equal(entry.boardSource,logo.source);
  assert.ok(!seen.has(entry.file));seen.add(entry.file);
  assert.ok(entry.sourceUrl.startsWith('https://'));
  const bytes=readFileSync(new URL('../public/brands/'+entry.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,
    'actual SVG bytes do not match traceable source '+logo.file);
  const svg=bytes.toString('utf8');
  assert.ok(logo.file.endsWith('.png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):/<svg\s/.test(svg));
  if(logo.file.endsWith('.svg'))assert.doesNotMatch(svg,/<script|<foreignObject|onload\s*=|onerror\s*=|javascript:/i);
  if(logo.kind==='source-traced-vector'){
   assert.equal(entry.upstreamCommit,'c71c69e3a27e4436936b831c72643e6513b9f49b');
   assert.ok(entry.upstreamSvg.endsWith('/icons/'+logo.file.slice(3)));
   assert.ok(entry.attribution.includes('not brand-hosted original'));
  }
 }
});
test('only vetted source identity can select brand asset; never guess by company substring',()=>{
 assert.ok(brandModule.includes('JSON.stringify([p.company,p.platform,p.source])'));
 assert.ok(brandModule.includes('registry.get(key(identity))||null'));
 assert.ok(!brandModule.includes('clearbit'));
 assert.ok(!brandModule.includes('logo.clearbit'));
 assert.ok(!brandModule.includes('api.favicon'));
 assert.ok(brandComponent.includes('verifiedBrandForEmployer(target)'));
 assert.ok(brandComponent.includes('verifiedBrandAssetUrl(target)'));
 assert.ok(brandComponent.includes('onError={()=>setBroken(true)}'));
 assert.ok(brandComponent.includes('<Building2'));
});
test('same logo renderer serves job cards, job detail, directory and dynamic company profile',()=>{
 assert.ok(market.includes('<EmployerBrandLogo job={job}/>'));
 assert.ok(directory.includes('<EmployerBrandLogo identity={item.identity}/>'));
 assert.ok(companies.includes('<EmployerBrandLogo identity={identity} variant="profile"/>'));
 assert.ok(market.includes("to={'/candidate/jobs/'+encodeURIComponent(job.id)}"),
   'job detail navigation must remain unaffected by company logo');
});
test('Railway serves only vetted SVG and PNG files and preserves CSP protection',()=>{
 assert.ok(server.includes('si-[a-z0-9]{2,40}'));
 assert.ok(server.includes('brand-[a-z0-9]{2,60}'));
 assert.ok(server.includes('p.endsWith(".png")?"image/png"'));
 assert.ok(server.includes('Brand asset not published'));
 assert.ok(server.includes('"Content-Type":p.endsWith(".png")?"image/png":"image/svg+xml; charset=utf-8"'));
 assert.ok(server.includes('"X-Content-Type-Options":"nosniff"'));
 assert.ok(server.includes('"Content-Security-Policy":"default-src'));
});

test("Headway's only published brand is its own ATS-board uploaded employer image, not Ashby favicon or same-name business",()=>{
 const item=registry.records.find(x=>x.company==='Headway'&&x.platform==='ashby'&&x.source==='headway');
 assert.ok(item);
 assert.equal(item.file,'brand-headway.png');
 assert.equal(item.kind,'brand-board-icon');
 const meta=proof.records.find(x=>x.file===item.file);
 assert.equal(meta?.sourcePage,'https://jobs.ashbyhq.com/headway');
 assert.match(meta?.sourceUrl||'',/^https:\/\/app\.ashbyhq\.com\/api\/images\/org-theme-logo\//);
 assert.ok(meta?.attribution?.includes('not Ashby\'s generic favicon'));
 assert.equal(meta?.sha256,'11d2003cf45ad6f6257f2f93bc14a1bfdbb7d3a2b94eca76883b387f930ad64a');
 assert.ok(!registry.records.some(x=>x.company==='Headway Inc'||x.company==='Headway Digital Studio'));
});
