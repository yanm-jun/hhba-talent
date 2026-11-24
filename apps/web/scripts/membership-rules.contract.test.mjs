import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

const rules=read('../src/data/membershipRulesContent.ts');
const page=read('../src/pages/MembershipRulesPage.tsx');
const css=read('../src/styles/membership-rules.css');
const main=read('../src/main.tsx');
const homepage=read('../src/components/HomeWorkplacePromise.tsx');
const rights=read('../src/pages/LegalAidLandingPage.tsx');

test('public rules page has 16 distinct, detailed chapters and 15 concrete FAQ examples',()=>{
 const ids=[...rules.matchAll(/\{id:'([a-z-]+)',title:'/g)].map(match=>match[1]);
 assert.equal(ids.length,16,'all 16 chapters must exist');
 assert.equal(new Set(ids).size,16,'chapter anchor IDs must be unique');
 const questions=[...rules.matchAll(/\{q:'/g)];
 assert.equal(questions.length,15,'concrete questions should cover every important dispute');
 for(const name of ['服务总则与产品性质','收费、订单、账单及发票','会员期间与36个月上限',
  '前六个月职业成长服务','六个月连续缴费与进阶资格','争议发生时间与既有案件','拟提供的劳动法律服务',
  '案件数量、范围及额外费用','申请、审核、文书与结案流程','合作律所、律师权限与微信沟通',
  '真实性、滥用防范与双方义务','取消续费、退款与服务中断','个人信息、证据及AI处理',
  '咨询、投诉、复核与争议解决','平台责任与求职者权益','规则生效、变更及历史版本']){
  assert.ok(rules.includes(name),name+' missing');
 }
});

test('page is readable anonymously and reachable from both home and labor rights',()=>{
 assert.match(main,/MembershipRulesPage=lazy/);
 assert.match(main,/if\(route==='\/membership\/rules'\)return <MembershipRulesPage user=\{user\}\/>/);
 assert.doesNotMatch(homepage,/to="\/membership\/rules"/);
 assert.match(homepage,/href:'\/rights\/knowledge'/);
 assert.match(homepage,/href:'\/rights\/guide'/);
 assert.doesNotMatch(rights,/to="\/membership\/rules"/);
 assert.match(rights,/to="\/rights\/guide"/);
 assert.match(page,/<Shell user=\{user\}>/);
 assert.match(page,/chapters\.map\(/);
 assert.match(page,/id=\{'rules-'\+chapter\.id\}/);
 assert.match(page,/href=\{'#'\+item\.id\}/);
 assert.match(page,/faq\.map\(/);
 assert.match(page,/legalSources\.map\(/);
 assert.match(page,/window\.print\(\)/);
});

test('draft does not enable payment or falsely claim a lawyer assignment',()=>{
 assert.match(rules,/公开说明草案/);
 assert.match(rules,/尚未开放购买/);
 assert.match(rules,/律师委托目前均未开放|律师委托/);
 assert.match(rules,/正式开售前必须明确/);
 assert.match(rules,/不能使用「售出概不退款」/);
 assert.match(rules,/不包含心理咨询/);
 assert.match(rules,/不设按固定比例划拨利润/);
 const config=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 assert.equal(config.membership.purchaseEnabled,false);
 assert.equal(config.membership.caseIntakeEnabled,false);
 assert.ok(!Object.hasOwn(config,'distribution'));
 assert.equal(config.commitment.fundingPromise,false);
 assert.ok(!page.includes('onSubmit'));
 assert.ok(!page.includes('createSubscription'));
});

test('mobile, accessible navigation and print-friendly reading remain supported',()=>{
 assert.match(page,/aria-labelledby=/);
 assert.match(page,/id="rules-contents"/);
 assert.match(page,/id="rules-faq"/);
 assert.match(page,/id="rules-sources"/);
 assert.match(css,/\.hhba-rules-sidebar\{position:sticky/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media print/);
 assert.match(css,/:focus-visible/);
});

test('one ordered TOC matches all right-hand sections and chapters',()=>{
 assert.match(page,/const navigation=\[/);
 assert.match(page,/\.\.\.chapters\.map\(\(chapter,index\)=>\(\{id:'rules-'\+chapter\.id,title:chapter\.title/);
 assert.match(page,/\{id:'rules-compliance',title:'合规与重要提示'/);
 for(const id of ['rules-launch','rules-faq','rules-sources','rules-versions']){
  assert.ok(page.includes("id:'"+id+"'"),id+' missing from TOC');
  assert.ok(page.includes('id="'+id+'"'),id+' missing from article');
 }
 assert.match(page,/navigation\.map\(item=><li key=\{item\.id\}>/);
 assert.match(page,/href=\{'#'\+item\.id\}/);
 assert.match(page,/onClick=\{\(\)=>onNavigate\(item\.id\)\}/);
 assert.match(page,/id=\{'rules-'\+chapter\.id\}/);
});

test('clicked TOC highlights and right article scrolling updates current chapter with no window scroll hijack',()=>{
 assert.match(page,/const \[activeSection,setActiveSection\]=useState/);
 assert.match(page,/window\.addEventListener\('scroll',scheduleSync,\{passive:true\}\)/);
 assert.match(page,/element\.getBoundingClientRect\(\)\.top<=marker/);
 assert.match(page,/setActiveSection\(previous=>previous===next\?previous:next\)/);
 assert.match(page,/aria-current=\{activeSection===item\.id\?'location':undefined\}/);
 assert.match(page,/className=\{activeSection===item\.id\?'is-active':undefined\}/);
 assert.match(page,/window\.location\.hash\.slice\(1\)/);
 assert.match(page,/document\.getElementById\(initialHash\)\?\.scrollIntoView/);
 assert.match(page,/nav\.scrollTop\+=/);
 assert.doesNotMatch(page,/link\.scrollIntoView/);
 assert.match(css,/\.hhba-rules-nav li a\.is-active/);
 assert.match(css,/\.hhba-rules-chapter,.hhba-rules-compliance,.hhba-rules-document-footer\{scroll-margin-top:/);
});

test('mobile foldable TOC and sixteen chapter previous and next links are accessible',()=>{
 assert.match(page,/className="hhba-rules-mobile-toggle"/);
 assert.match(page,/aria-expanded=\{mobileMenuOpen\}/);
 assert.match(page,/aria-controls="rules-contents"/);
 assert.match(page,/setMobileMenuOpen\(false\)/);
 assert.match(page,/const chapterNavigation=\(index:number\)=>/);
 assert.match(page,/\{chapterNavigation\(index\)\}/);
 assert.match(page,/上一章/);
 assert.match(page,/下一章/);
 assert.match(css,/\.hhba-rules-mobile-toggle\{display:none\}/);
 assert.match(css,/\.hhba-rules-nav\.is-open\{display:block\}/);
 assert.match(css,/@media\(max-width:720px\)/);
});

test('previously excessive hero cards are replaced by a compact note and full compliance stays in the article',()=>{
 assert.match(page,/className="hhba-rules-inline-notice"/);
 assert.match(page,/className="hhba-rules-compliance-list"/);
 assert.match(page,/className="hhba-rules-document-overview"/);
 assert.doesNotMatch(page,/hhba-rules-snapshot|hhba-rules-compliance-grid/);
 const layout=page.indexOf('className="hhba-rules-layout"');
 const compliance=page.indexOf('id="rules-compliance"');
 assert.ok(layout>=0&&compliance>layout,'full compliance must appear inside document layout');
 assert.match(css,/\.hhba-rules-chapter-switch/);
});

test('one career workbench keeps all service entry points without fake member status',()=>{
 const auth=read('../src/pages/PhoneAuthPage.tsx');
 const personal=read('../src/pages/PersonalCenterPage.tsx');
 const rights=read('../src/pages/WorkplaceRightsPage.tsx');
 const dropdown=read('../src/components/CandidateAccountDropdown.tsx');
 const main=read('../src/main.tsx');
 const config=JSON.parse(read('../src/data/homepagePublicConfig.json'));
 assert.match(auth,/hhba-unified-auth/);
 assert.match(auth,/欢迎来到汇方职场/);
 assert.match(main,/if\(route==='\/auth'\)return <PhoneAuthPage/);
 assert.doesNotMatch(main,/return <AuthChoicePage/);
 assert.match(personal,/职业与权益/);
 assert.match(personal,/职业成长档案/);
 assert.doesNotMatch(personal,/会员与权益服务/);
 assert.match(personal,/hhba-workbench-overview/);
 assert.match(personal,/hhba-workbench-rights/);
 assert.doesNotMatch(personal,/hhba:career-stage:|hhba-career-switch|¥24\.90/);
 assert.match(rights,/¥24\.90/);
 assert.match(rights,/尚未开放购买/);
 assert.match(rights,/不包含仲裁和诉讼代理/);
 assert.doesNotMatch(dropdown,/\/candidate\/account\/rights/);
 assert.match(dropdown,/\/candidate\/account\/legal-aid/);
 assert.match(main,/if\(route==='\/candidate\/account\/rights'\)return <WorkplaceRightsPage/);
 assert.equal(config.membership.priceCents,2490);
 assert.equal(config.membership.purchaseEnabled,false);
 assert.equal(config.membership.caseIntakeEnabled,false);
});


test('public /rights uses the uploaded HHBA photo and an editorial layout, not the account hero',()=>{
 const rights=read('../src/pages/WorkplaceRightsPage.tsx');
 const visual=read('../src/styles/rights-editorial.css');
 const image=readFileSync(new URL('../public/images/hhba-rights-wind-hero.webp',import.meta.url));
 assert.equal(image.subarray(0,4).toString(),'RIFF','hero must be a real WebP asset');
 assert.equal(image.subarray(8,12).toString(),'WEBP','hero must be a real WebP asset');
 assert.ok(image.length>50000,'hero image quality must not be reduced to a thumbnail');
 assert.match(rights,/if\(!embedded\)return <Shell user=\{user\}>/);
 assert.match(rights,/src="\/images\/hhba-rights-wind-hero\.webp"/);
 assert.match(rights,/fetchPriority="high"/);
 assert.match(rights,/className="hhba-rights-editorial-cover"/);
 assert.match(rights,/className="hhba-rights-editorial-service-list"/);
 assert.match(rights,/className="hhba-rights-editorial-timeline"/);
 assert.match(rights,/className="hhba-rights-editorial-plan-price"/);
 assert.match(rights,/className="hhba-rights-editorial-disclosure"/);
 assert.match(rights,/¥24\.90/);
 assert.match(rights,/最长 36 个月/);
 assert.match(rights,/尚未开放购买/);
 assert.match(rights,/不包含仲裁和诉讼代理/);
 assert.match(rights,/to="\/rights\/knowledge"/);
 assert.match(rights,/to="\/membership\/rules"/);
 assert.match(visual,/\.hhba-rights-editorial-cover img/);
 assert.match(visual,/@media\(max-width:740px\)/);
});
test('public /rights compact layout preserves full original photo and tightens desktop/mobile whitespace',()=>{
 const visual=read('../src/styles/rights-editorial.css');
 const rights=read('../src/pages/WorkplaceRightsPage.tsx');
 assert.ok(visual.includes('.hhba-rights-editorial-cover{width:min(calc(100% - 48px),900px)'), 'photo should have a compact desktop maximum width');
 assert.ok(visual.includes('aspect-ratio:1672/941;object-fit:contain'), 'hero must preserve text, worker and full photo composition');
 assert.ok(visual.includes('.hhba-rights-editorial-intro{max-width:980px;margin:0 auto;padding:42px 24px 45px'), 'intro must not retain excessive 100px padding');
 assert.ok(visual.includes('font-size:clamp(27px,3.15vw,37px)'), 'intro headline should fit the editorial layout');
 assert.ok(visual.includes('.hhba-rights-editorial-timeline{background:#0b2444;color:#f6f9fd;padding:46px'), 'service timeline should remain compact');
 assert.ok(visual.includes('.hhba-rights-editorial-plan{max-width:980px;margin:0 auto;padding:52px'), 'price explanation spacing should be reduced');
 assert.ok(visual.includes('.hhba-rights-editorial-cover{width:calc(100% - 24px);border-radius:4px}'), 'photo should adapt to small screens without cropping');
 assert.ok(visual.includes('.hhba-rights-editorial-intro,.hhba-rights-editorial-plan,.hhba-rights-editorial-disclosure{display:block;padding:33px 18px}'), 'mobile sections should use reduced vertical padding');
 assert.ok(rights.includes('width="1672" height="941"'), 'image aspect ratio and source asset stay unchanged');
 assert.ok(!visual.includes('width:min(100%,1680px)'), 'oversized cover must not return');
});

test('existing private member workspace stays embedded and operational',()=>{
 const rights=read('../src/pages/WorkplaceRightsPage.tsx');
 const main=read('../src/main.tsx');
 assert.match(rights,/return <Shell user=\{user\} embedded=\{embedded\}>/);
 assert.match(rights,/className="hhba-rights-page"/);
 assert.match(rights,/const knowledgeHref=embedded\?'\/candidate\/account\/legal-aid':'\/rights\/knowledge'/);
 assert.match(main,/rights:<WorkplaceRightsPage user=\{user\} embedded\/>/);
 assert.match(main,/if\(route==='\/rights'\)return <WorkplaceRightsPage user=\{user\}\/>/);
 assert.match(main,/route==='\/candidate\/account\/rights'/);
});
