import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const list=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const found=JSON.parse(read('src/data/domesticAutumnVerifiedJobs20261028.json'));
const ui=read('src/components/DomesticAutumnMarket.tsx');
const market=read('src/components/UnifiedJobMarket.tsx');
const router=read('src/router.tsx');
const app=read('src/main.tsx');
assert.equal(list.totalScreenshotMentions,157);
assert.equal(list.uniqueCompanyNames,156);
assert.equal(list.entries.length,156);
assert.equal(new Set(list.entries.map(e=>e.name)).size,156,'Screenshot employer duplicates must be collapsed');
assert.equal(found.jobs.length,39);
assert.equal(found.jobs.filter(j=>j.recordKind==='job').length,20);
assert.equal(found.jobs.filter(j=>j.recordKind==='program').length,19);
for(const e of list.entries){
 assert(e.id&&e.name&&e.screenshotGroup);
 assert(['not_checked','announcement_evidenced','official_entry_evidenced'].includes(e.reviewStatus));
 if(e.reviewStatus==='official_entry_evidenced')assert(e.officialUrl?.startsWith('https://'));
 if(e.reviewStatus==='not_checked')assert(!e.officialUrl&&!e.evidenceUrl);
}
for(const j of found.jobs){
 assert(list.entries.some(e=>e.name===j.company),'Job/company must belong to screenshot list: '+j.company);
 assert(j.sourceUrl.startsWith('https://'),'No invented or insecure source');
 assert(j.status==='historical_public_announcement_current_open_unverified' || (j.company==='辉瑞'&&j.status==='official_job_page_observed_current_open_unverified'&&j.sourceUrl.startsWith('https://www.pfizer.com/about/careers/job/')), 'Every job must be either historical evidence or identified official Pfizer page');
 if(j.recordKind==='program')assert(j.locationScope!=='job','Program-wide cities must not be marked as individual');
 if(j.locationScope==='not_disclosed')assert.equal(j.cities.length,0);
}
assert(ui.includes('招聘项目城市范围（非逐岗）')&&ui.includes('不参与严格的专业＋城市岗位匹配'));
assert(ui.includes('data-hhba-recruitment-outbound="true"'),'Existing login gating remains in effect');
assert(market.includes('<DomesticAutumnMarket compact={compact}'),'Domestic roles must be in existing market');
assert(market.includes('官方原始岗位未提供可确认的专业字段'),'Do not infer unverified overseas majors');
assert(app.includes("if(route==='/candidate/domestic-autumn')return <DomesticAutumnPage"));
assert(router.includes("path==='/candidate/domestic-autumn'"));
console.log('DOMESTIC_AUTUMN_EVIDENCE_CONTRACT_OK',list.entries.length,found.jobs.length);
