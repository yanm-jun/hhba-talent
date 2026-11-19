import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const topicData=JSON.parse(read('src/data/laborRightsTopics.json'));
const subData=JSON.parse(read('src/data/laborRightsSubtopics.json'));
const intentData=JSON.parse(read('src/data/laborRightsSearchIntents.json'));
const hub=read('src/pages/LegalAidLandingPage.tsx');
const guide=read('src/pages/WorkValueGuidePage.tsx');
const css=read('src/styles/hhba-work-value-guide.css');
const contract=read('src/data/hhbaWorkValueGuide.ts');
const tips=JSON.parse(contract.match(/export const GUIDE_TIPS:GuideTip\[\]=([\s\S]*);\s*$/)?.[1]||'null');
const tipIds=new Set(tips.map(tip=>tip.id));

const normal=(s)=>s.trim().toLocaleLowerCase();
const match=(sentence)=>intentData.intents.filter(intent=>intent.phrases.some(p=>normal(sentence).includes(normal(p))));

test('question-intent dictionary is complete, conservative and linked to actual law pages',()=>{
 assert.equal(intentData.schemaVersion,1);
 assert.equal(intentData.intents.length,14);
 const base=new Set(topicData.topics.map(t=>t.slug));
 const sub=new Set(subData.topics.map(t=>t.slug));
 for(const intent of intentData.intents){
  assert(base.has(intent.primary),'unknown base law topic '+intent.id);
  assert(intent.phrases.length>=3,'missing colloquial expressions '+intent.id);
  assert(intent.phrases.every(s=>typeof s==='string'&&s.trim().length>=2),'empty phrase '+intent.id);
  assert(intent.subtopics.every(s=>sub.has(s)),'unpublished detailed topic '+intent.id);
  assert.equal(intent.featuredActions.length,3,'each intent needs three actionable recommendations: '+intent.id);
  assert.equal(new Set(intent.featuredActions).size,3,'featured actions must not repeat: '+intent.id);
  assert(intent.featuredActions.every(id=>tipIds.has(id)),'all recommended actions must exist: '+intent.id);
 }
});

test('everyday user descriptions lead to expected topic categories, not a generated verdict',()=>{
 const cases=[
  ['公司三个月不发工资','unpaid'],
  ['领导今天扣钱了','deduction'],
  ['销售提成一直没结算','commission'],
  ['入职后一直没签合同','contract'],
  ['试用期工资怎么算','probation'],
  ['试用期不交社保','insurance'],
  ['加班不给钱怎么办','overtime'],
  ['未休年假怎么办','leave'],
  ['被裁员补偿怎么算','dismissal'],
  ['不给离职证明','certificate'],
  ['公司强制调岗','transfer'],
  ['竞业限制影响找工作','noncompete'],
  ['劳动仲裁怎么申请','arbitration'],
  ['上班受伤怎么申请','injury']
 ];
 for(const [query,id] of cases)assert(match(query).some(v=>v.id===id),'unmatched: '+query+' -> '+id);
 assert(!match('今天下午吃什么').length,'unrelated questions should not return a legal verdict');
 assert.deepEqual(match('公司三个月不发工资').find(v=>v.id==='unpaid')?.subtopics,[],
  'unpaid salary should not be labeled as payroll deduction');
});

test('official subtopic references point to the correct published law texts',()=>{
 const urls=[...new Set(subData.topics.flatMap(t=>t.laws.map(l=>l.url)))];
 assert(urls.includes('https://www.court.gov.cn/fabu/xiangqing/472691.html'),
  '2025 judicial interpretation should link to its published full text, not press coverage');
 assert(urls.includes('https://www.beijing.gov.cn/zhengce/gwywj/201105/t20110506_780976.html'),
  'implementing regulation should have a readable official full-text page');
 assert(urls.includes('https://shanghai.chinatax.gov.cn/tax/zcfw/zcfgk/sbf/202202/t462174.html'),
  '2018 amended social insurance law should be linked');
 assert(urls.includes('https://rsj.wuhan.gov.cn/zwgk_17/zc/qtzdgkwj/zcfg/202001/t20200108_676323.html'),
  'annual leave regulation must cite the full text published by a government HR authority');
 assert(!urls.some(u=>u.includes('nhsa.gov.cn/art/2010/10/28')||u.includes('/zixun/xiangqing/472691.html')));
 assert(!urls.some(u=>u.includes('P020231117343285173532.pdf')),
  'known broken annual-leave PDF must not reappear');
 assert(!topicData.topics.some(topic=>topic.laws.some(law=>
  law.url==='https://fgk.chinatax.gov.cn/zcfgk/c100009/c5193025/content.html')),
  'full topic pages should share the reliable verified labor-contract law text');
 assert(topicData.topics.filter(topic=>topic.laws.some(law=>
  law.url==='https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html')).length>=6,
  'the six original labor-contract-law references must resolve to the published official text');
 for(const t of subData.topics)for(const law of t.laws)assert(/^https:\/\//.test(law.url),t.slug);
});

test('search remains private and selected action opens on exact deep link',()=>{
 assert.match(hub,/matchingIntents\(query\)/);
 assert.match(hub,/featuredActions\.indexOf\(tip\.id\)/);
 assert.match(hub,/\.sort\(\(a,b\)=>b\.score-a\.score/);
 assert.match(hub,/建议下一步/);
 assert.match(hub,/const matchingIntents=\(raw:string\)=>/);
 assert.match(hub,/intent\.subtopics\.includes\(topic\.slug\)/);
 assert.match(hub,/relatedSlugs\.add\(intent\.primary\)/);
 assert.match(hub,/本页使用关键词和常见说法匹配/);
 assert.doesNotMatch(hub,/\bfetch\(|navigator\.sendBeacon|<textarea|input type="file"/);
 assert.match(guide,/setSelectedTipId/);
 assert.match(guide,/selectedTip\.steps\.map/);
 assert.match(guide,/new URLSearchParams\(window\.location\.search\)\.get\('tip'\)/);
 assert.match(guide,/window\.addEventListener\('popstate',syncTip\)/);
 assert.match(guide,/返回职场指南/);
 assert.match(css,/\.hhba-edition-article\{/);
 assert.match(contract,/export const GUIDE_TIPS:GuideTip\[\]=/);
});
