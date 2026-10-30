import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';

const page=readFileSync(new URL('../src/pages/TalentJinanGuidePreview.tsx',import.meta.url),'utf8');
const shared=readFileSync(new URL('../src/components/talent/UnifiedPolicyGuide.tsx',import.meta.url),'utf8');
const policyShared=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const list=readFileSync(new URL('../src/pages/TalentJinanPolicyPreview.tsx',import.meta.url),'utf8');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/talent-jinan-guide-preview.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/TalentServicePage.tsx',import.meta.url),'utf8');
let passed=0;
function check(label,run){run();passed++;console.log('✓ '+label)}
check('Only Jinan living subsidy has preview detail link; old detail remains intact',()=>{
 assert.ok(list.includes("record.id==='sd-jinan-2026-talent-living'"));
 assert.ok(policyShared.includes("'/talent-service/policy/'+encodeURIComponent(item.id)"));
 assert.ok(routes.includes("kind==='policy-guide-preview'&&fragments[2]==='jinan'"));
 assert.ok(routes.includes("kind==='policy-layout-preview'&&fragments[2]==='jinan'"));
 const original=TALENT_POLICY_RECORDS.find(x=>x.id==='sd-jinan-2026-talent-living');
 assert.equal(original?.city,'济南');
});
check('Six actionable steps each have rationale, action, outcome',()=>{
 const i=page.indexOf('const steps:Step[]=['),j=page.indexOf('const checks=[',i);
 const block=page.slice(i,j);
 for(const keyword of ['title:','why:','action:','done:'])assert.ok(block.includes(keyword));
 assert.equal((block.match(/title:'/g)||[]).length,6);
 assert.equal((block.match(/why:'/g)||[]).length,6);
 assert.equal((block.match(/action:'/g)||[]).length,6);
 assert.equal((block.match(/done:'/g)||[]).length,6);
});
check('Direct official application portal and individual government documents are distinguished',()=>{
 assert.ok(page.includes("portal:'https://rc.jinan.gov.cn/'"));
 const governmentLinks=[...page.matchAll(/https:\/\/(?:www|jnxxq)\.jinan\.gov\.cn\/[^']+/g)];
 assert.ok(governmentLinks.length>=7,'Need 2026 government guidance and local official release');
 assert.ok(page.includes('网站当前可达性及登录后页面未能实时验证'));
});
check('Policy descriptions preserve 2026 district filing rules and categories without college promises',()=>{
 for(const s of ['5,000 元/月','4,000 元/月','3,000 元/月','2,000 元/月','1,500 元/月','1,000 元/月'])assert.ok(page.includes(s));
 for(const s of ['毕业时间不超过3年','3年及以上','无自有住房','实际租房','全球TOP200'])assert.ok(page.includes(s),s);
 assert.ok(page.includes('不代表已获得政府的人才类别认定'));
});
check('Personal data stays in client-only checkbox state, no fake government application',()=>{
 assert.ok(shared.includes('useState<Record<string,boolean>>({})'));
 assert.ok(shared.includes('已核对 {progress}/{data.checks.length} 项'));
 assert.ok(shared.includes('type="checkbox" checked={Boolean(selected[String(i)])}'));
 assert.ok(!shared.includes('localStorage')&&!shared.includes('fetch(')&&!page.includes('身份证号'));
});
check('Applicant can switch between master, doctor, A-D to get separate conditions and materials',()=>{
 for(const s of ["master:{","doctor:{","senior:{"])assert.ok(page.includes(s),s);
 for(const s of ["setBranch(key)","active.conditions.map","active.materials.map"])assert.ok(shared.includes(s),s);
});
check('FAQ has accordion, text search, and real payment and repeat benefit rules',()=>{
 assert.ok(shared.includes('setFaqQuery(e.target.value)'));
 assert.ok(shared.includes('aria-expanded={openFaq===x.i}'));
 assert.ok(page.includes('下一季度'));
 assert.ok(page.includes('不能直接叠加'));
});
check('District government published contact phone and official sources link correctly',()=>{
 for(const number of ['0531-88152310','0531-51806989','0531-85872683','0531-66604391'])assert.ok(page.includes(number));
 assert.ok(shared.includes('data.contacts.map(c=>'));
 assert.ok(shared.includes("href={'tel:'+selectedContact.phone}"));
 assert.ok(page.includes('OFFICIAL.contact'));
});
check('Responsive CSS isolated and six confirmed homepage blocks untouched',()=>{
 assert.ok(css.includes('@media(max-width:630px)'));
 assert.ok(css.includes('.jgd-step'));
 assert.ok(!css.includes('.htl-quick')&&!css.includes('.ts-sub-tile{'));
 for(const s of ['htl-intro','htl-quick','htl-city-grid','htl-housing-grid','htl-policy-list','htl-match'])assert.ok(home.includes(s));
});
console.log(JSON.stringify({passed,expected:9,city:'济南',policy:'sd-jinan-2026-talent-living',entry:'/talent-service/policy-guide-preview/jinan'},null,2));
