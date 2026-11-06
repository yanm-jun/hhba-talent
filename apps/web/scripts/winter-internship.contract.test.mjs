import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('src/pages/HomePage.tsx'),main=read('src/main.tsx'),popup=read('src/components/WinterInternshipPopup.tsx'),page=read('src/pages/WinterInternshipPage.tsx'),data=read('src/data/winter2027Programs.ts'),css=read('src/styles/winter-internship.css');
const jobs=read('src/data/winter2027Jobs.ts'),siteIndex=read('src/services/siteSearchIndex.ts');
test('winter campaign replaces ONLY original homepage letter auto-popup',()=>{
 assert.ok(home.includes('<WinterInternshipPopup/>'));
 assert.ok(home.includes('<HomeOpenLetter autoOpen={false}/>'),'manual-only public letter component must be mounted');
 assert.ok(home.includes('读一封来自 HHBA 的信')&&home.includes('hhba:open-letter'),'public letter button must remain clickable');
 const letter=read('src/components/HomeOpenLetter.tsx');
 assert.ok(letter.includes('if (!autoOpen) return null;'),'letter must never auto-open during a regular visit');
 assert.ok(popup.includes("get('letter')!=='1'"),'explicit letter shares must not be covered by winter popup');
 assert.ok(existsSync(new URL('../src/components/HomeOpenLetter.tsx',import.meta.url)),'public letter source must stay present');
 for(const stable of ['<UnifiedJobMarket compact/>','<HomeCompanyMarquee/>','<HomePeopleBanner/>','我要应聘','我要招人'])assert.ok(home.includes(stable),stable+' must remain');
});
test('every homepage visit modal uses accessible close/escape/backdrop and real internal CTA',()=>{
 for(const part of ['aria-modal="true"','role="dialog"','aria-label="关闭寒假实习广告"',"event.key==='Escape'",'e.target===e.currentTarget','showOnHomeVisit','to="/winter-internship"'])assert.ok(popup.includes(part),part+' missing');
 assert.ok(popup.includes('images/hhba-join-team.webp'),'existing locally-hosted campaign photo missing');
 assert.ok(css.includes('hhba-winter-modal-overlay')&&css.includes('@media(max-width:600px)'),'responsive centered modal CSS missing');
 assert.ok(css.includes('width:min(780px,100%)')&&css.includes('height:min(450px,88dvh)'),'campaign should use compact 780 x 450 popup');
 assert.ok(!css.includes('width:min(1050px,100%)'),'former oversized popup width must be removed');
});
test('landing route and permanent programme-detail routes are public',()=>{
 for(const part of ["route==='/winter-internship'",'/^\\/winter-internship\\/[a-z0-9-]{3,100}$/.test(route)',"<WinterInternshipPage user={user}"])assert.ok(main.includes(part),part+' missing');
 assert.ok(page.includes('data-winter-page="directory"'));
 assert.ok(page.includes('data-winter-page="detail"'));
 assert.ok(page.includes("to={'/winter-internship/'+program.id}"));
 assert.ok(page.includes('href={p.sourceUrl}'));
 assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'));
});
test('directory contains source-backed programmes without invented job numbers',()=>{
 const ids=[...data.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(x=>x[1]);
 assert.equal(ids.length,8,'historical CMB review must be additional information, not a fabricated live job');
 assert.equal(new Set(ids).size,ids.length);
 for(const name of ['毕马威中国','德勤中国','摩根大通','APCO Worldwide'])assert.ok(data.includes(name),name+' missing');
 for(const source of ['kpmg.com','deloitte.com','jpmorganchase.com','oraclecloud.com'])assert.ok(data.includes(source));
 for(const id of ['ey-china-winter-2027-review','pwc-hk-2027-winter','hsbc-hk-2027-work-placement'])assert.ok(ids.includes(id),id+' missing');
 for(const company of ['安永中国','普华永道香港','汇丰银行'])assert.ok(data.includes(company),company+' missing');
 assert.ok(data.includes("workRightsNote:"),'Hong Kong eligibility risk must be shown');
 assert.ok(data.includes("verificationLevel:'date-conflict'"),'HSBC application cutoff discrepancy must be disclosed');
 assert.ok(data.includes("verificationLevel:'official-program'"),'EY and PwC should not be marked as currently verified open');
 assert.ok(data.includes('pip.erg.cuhk.edu.hk'),'PwC 2027 seasonal source must be disclosed');
 assert.ok(page.includes('查看补充招聘证据')&&page.includes('p.workRightsNote'),'full evidence and visa restriction must be shown');
 assert.ok(page.includes('verificationLabel(program)'),'cards must disclose evidence levels');
 assert.ok(!data.includes('currentOpenVerified:true'),'never invent open statuses');
 assert.ok(data.includes("checkedOn:'2026-11-04'"));
 assert.ok(!data.includes('currentOpenVerified:true'),'no false live availability');
});
test('concrete job first: only individual employer-issued postings appear in the primary list',()=>{
 const jobIds=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(x=>x[1]);
 assert.equal(jobIds.length,58,'41 prior plus three distinct mainland employer roles in batch08');
 assert.equal(new Set(jobIds).size,jobIds.length,'no duplicate role identity');
 for(const id of ['apco-shanghai-winter-start-1787','hsbc-hk-student-placement-1367003857','qima-hk-sales-intern-744000154586189']){
  assert.ok(jobIds.includes(id),id+' missing');
 }
 for(const id of ['bdo-hk-spring-assurance-2027','bdo-hk-spring-it-audit-2027','atkinsrealis-hk-winter-2027-r164310','rsm-hk-spring-audit-assurance-2027','rsm-hk-spring-tech-consulting-2027'])assert.ok(jobIds.includes(id),id+' missing from batch 02');
 for(const name of ['BDO 香港','AtkinsRéalis','RSM 罗申美香港'])assert.ok(jobs.includes(name),'batch02 employer '+name+' missing');
 for(const domain of ['oraclecloud.com','careers.hsbc.com','jobs.smartrecruiters.com','recruitment.bdo.com.hk','careers.atkinsrealis.com','www.rsm.global'])assert.ok(jobs.includes(domain));
 assert.ok(jobs.includes("2026 年 11 月 20 日")&&jobs.includes("2026 年 11 月 30 日"),'two different real BDO application deadlines must be preserved');
 assert.ok(jobs.includes('R-164310')&&jobs.includes('并非 13 个单独招聘岗位'),'engineering business lines must not be inflated into fake jobs');
 assert.ok(jobs.includes('确切起始月份尚未公布'),'RSM spring schedule is not a verified January start');
 for(const id of ['richemont-hk-talent-acquisition-jr134347','tianzh-international-haikou-audit-j10722','tianzh-international-xian-workcenter-j11175','crowe-hk-spring-audit-2027-review'])assert.ok(jobIds.includes(id),'missing batch03 job '+id);
 for(const employer of ['历峰集团 Richemont','天职国际','国富浩华香港 Crowe'])assert.ok(jobs.includes(employer),'batch03 employer missing '+employer);
 assert.ok(jobs.includes('JR134347')&&jobs.includes('2026 年 12 月至 2027 年 5 月'),'Richemont must have verifiable winter period');
 assert.ok(jobs.includes('J10722')&&jobs.includes('J11175'),'Tianzhi posting codes are real and must be preserved');
 assert.ok(jobs.includes("status:'year-conflict'")&&jobs.includes('2026年11月的近期搜索索引显示'),'Crowe conflicting employer page years must be shown');
 assert.ok(jobs.includes('未证明为同一招聘编号'),'third-party corroboration must not imply exact requisition identity');
 assert.ok(page.includes('job.reviewWarning')&&page.includes('job.evidenceUrl'),'source limitations and secondary citations must appear in details');
 assert.ok(jobs.includes('careers.richemont.com')&&jobs.includes('tzcpa.zhiye.com')&&jobs.includes('www.crowe.com'),'all three employers have official destinations');
 for(const id of ['ey-tw-2027-peak-season-intake','shinewing-hk-2027-winter-audit-tax-advisory','shinewing-hk-2027-tax-business-advisory-l0607873647','luoshu-final-year-quant-intern-2027'])assert.ok(jobIds.includes(id),'missing batch04 record '+id);
 for(const employer of ['安永台湾 EY','信永中和香港 SHINEWING','洛书投资'])assert.ok(jobs.includes(employer),employer+' missing');
 assert.ok(jobs.includes('2027 年 1 月 18 日')&&jobs.includes('2026 年 11 月 8 日'),'EY 2027 deadline and start must be preserved');
 assert.ok(jobs.includes("status:'program-intake'")&&jobs.includes('不拆分为四个虚拟岗位'),'EY business departments must not inflate separate job counts');
 assert.ok(jobs.includes("status:'source-verify'")&&jobs.includes('L0607873647'),'SHINEWING 2027 job-board records must show source limitations');
 assert.ok(jobs.includes("status:'winter-unverified'")&&jobs.includes('尚未证明与校招职位是同一批次'),'Luoshu winter timing must be explicit as unverified');
 assert.ok(jobs.includes('www.ey.com')&&jobs.includes('www.shinewing.hk')&&jobs.includes('www.luoshu.com'),'company career links required');
 assert.ok(page.includes("job.status==='verify-apply'?'hhba-winter-status-neutral'"),'source-unverified roles need caution badge in list');
 assert.ok(page.includes("job.status!=='deadline-conflict'&&job.status!=='year-conflict'"),'batch04 status caution must render in job detail');
 assert.ok(!jobs.includes("status:'open'"),'no unproven current availability');
 assert.ok(!jobs.includes("status:'open'"),'real-time availability must not be fabricated');
 assert.ok(!jobs.includes('jpm-2027-seasonal'),'JPM summer/fall seasonal programme is not a winter role');
 for(const part of ['data-winter-job={job.id}','winterJobById(slug)','data-winter-page="job-detail"','hhba-winter-role-list','PROGRAM_ONLY','data-winter-program-archive']){
  assert.ok(page.includes(part),part+' missing from job-first page');
 }
 assert.ok(page.includes("p.id!=='jpm-2027-seasonal'"),'not-yet-confirmed winter programme must stay out of archive');
 assert.ok(page.includes("p.kind==='专项计划'"),'program-only section must not duplicate concrete jobs');
 assert.ok(page.includes('PAGE_SIZE=10')&&page.includes('totalPages>1'),'job list must paginate');
 assert.ok(page.includes('按专业筛选寒假岗位')&&page.includes('按地区筛选寒假岗位')&&page.includes('按行业筛选寒假岗位'));
 assert.ok(page.includes('terms.every(term=>haystack.includes(term))'),'natural multi-term job search expected');
 assert.ok(page.includes("Number(b.majorTags.includes(major))-Number(a.majorTags.includes(major))"),'major-specific roles must rank above unrestricted');
 assert.ok(jobs.includes("status:'deadline-conflict'"),'HSBC conflicting deadline must be displayed');
 assert.ok(page.includes('job.workRightsNote'),'cross-border employment eligibility must be shown');
 assert.ok(siteIndex.includes('for(const job of WINTER_2027_JOBS)')&&siteIndex.includes("kind:'job'"),'global search must index concrete jobs');
 assert.ok(siteIndex.includes("kind:'page',title:p.company"),'unconfirmed programmes must be informational results, not job posts');
 assert.ok(!page.includes("data-winter-page=\"directory\"\n   <section className=\"hhba-winter-landing-hero\""),'large introduction cannot precede jobs');
});

test('site search and personal data flows are unchanged',()=>{
 assert.ok(!home.includes('siteSearchIndex'));
 assert.ok(popup.includes('useState(showOnHomeVisit)'),'each homepage mount must open campaign');
 assert.ok(popup.includes('const close=useCallback(()=>setOpen(false),[])'),'close must only affect current view');
 assert.ok(!popup.includes('localStorage')&&!popup.includes('sessionStorage'),'legacy suppress keys must never be read or written');
 assert.ok(!popup.includes('HIDE_KEY')&&!popup.includes('SESSION_KEY'),'old suppression keys must not gate campaign');
 assert.ok(!popup.includes('dontShowAgain')&&!popup.includes('type="checkbox"')&&!popup.includes('不再显示'),'nonfunctional opt-out checkbox must be removed');
 assert.ok(!css.includes('.hhba-winter-hide-choice')&&!css.includes('.hhba-winter-modal-actions'),'obsolete checkbox styles must be removed');
 assert.ok(!popup.includes('getRealAuthToken')&&!popup.includes('/api/resumes'),'never read private account or resume information');
 assert.ok(page.includes('过滤')||page.includes('筛选'),'filter UI should exist');
});


test('batch05 has seven distinct university-only ReCube winter records and two separately sourced Papergames roles',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 const recube=['product-uiux-260900318','sustainability-260900321','fullstack-260900315','digital-marketing-260900319','hardware-260900322','website-designer-260900317','data-ai-260900320'];
 for(const name of recube)assert.ok(ids.includes('recube-hk-winter-'+name),'missing real university posting '+name);
 for(const id of ['papergames-shanghai-recruiting-game-rd-intern-2027-review','papergames-shanghai-nikki-world-ecology-planning-280350'])assert.ok(ids.includes(id),'missing sourced Papergames role '+id);
 assert.equal(new Set(ids).size,51);
 assert.equal((jobs.match(/status:"campus-limited"/g)||[]).length,7,'restricted university listings must not be passed as direct public jobs');
 assert.equal((jobs.match(/status:"winter-unverified"/g)||[]).length,2,'two original daily internships must remain winter-unverified');
 assert.ok(jobs.includes('2026 年 11 月 14 日')&&jobs.includes('cpdc.osa.cuhk.edu.hk/en/job/'));
 assert.ok(jobs.includes('职位详情跳转需要校内认证')&&jobs.includes('非本岗位直投'));
 assert.ok(jobs.includes('www.shixiseng.com/intern/inn_rupynll1lq54')&&jobs.includes('www.deizao.cn/m/index/shixixq/jobid/280350'));
 assert.ok(jobs.includes('2027 年 1 月 6 日')&&jobs.includes('寒假到岗待核实'));
 assert.ok(data.includes('cmb-guangzhou-2027-winter-internship-review'));
 assert.ok(data.includes("verificationLevel:"+'"historical-only"'),'historical CMB cannot masquerade as an active role');
 assert.ok(!ids.some(id=>id.startsWith('cmb-')),'CMB historical programme is not an independent winter job');
 assert.ok(page.includes('企业官网（非直投）')&&page.includes('高校校内限制'));
 assert.ok(page.includes('historical-only'));
});


test('batch06 adds three independently sourced employers, nine unique 2027 H1 records with truthful deadlines',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(x=>x[1]);
 const sun=['sunlife-hk-strategic-finance-jr00128213','sunlife-hk-financial-reporting-jr00128231','sunlife-hk-actuarial-internship-jr00120885'];
 const man=['manulife-hk-2027-private-equity-jr26091338','manulife-hk-2027-data-finance-jr26091703','manulife-hk-2027-global-info-risk-jr26100089','manulife-hk-2027-marketing-strategy-jr26100142','manulife-hk-2027-tech-placement-jr26100136'];
 const informa='informa-markets-hk-2027-jan-jun-intern-l059656859';
 for(const id of [...sun,...man,informa])assert.ok(ids.includes(id),'batch06 missing distinct job '+id);
 assert.equal(ids.length,58,'historical batch06/batch07 roles plus three new mainland records');
 assert.equal(new Set(ids).size,58,'no duplicate record identifiers');
 assert.equal((jobs.match(/status:"closed"/g)||[]).length,9,'existing seven plus LVMH and CA Global Markets expired records');
 assert.ok(jobs.includes('2026年10月30日')&&jobs.includes('2026年11月1日'));
 assert.ok(jobs.includes('2026年11月7日'),'Informa third-party upcoming deadline');
 assert.ok(jobs.includes('JR00128213')&&jobs.includes('JR00128231'),'same-named finance jobs need distinct employer requisitions');
 assert.ok(jobs.includes('JR00120885')&&jobs.includes('包含1月入职的一条招聘记录'),'one actuarial program must not split Jul-Dec');
 assert.ok(jobs.includes('2027年1月至7月')&&jobs.includes('2027年1月至6月'),'Manulife PE month discrepancy should be documented');
 assert.ok(jobs.includes('L059656859')&&jobs.includes('openuniversity.recruit.com.hk'),'Informa job board evidence required');
 for(const hostname of ['sunlife.wd3.myworkdayjobs.com','manulife.wd3.myworkdayjobs.com','www.informa.com'])assert.ok(jobs.includes(hostname),hostname+' employer primary URL missing');
 assert.ok(page.includes('查看已截止公告')&&page.includes('查看雇主已截止岗位公告'),'closed jobs must not present generic apply CTA');
 assert.ok(page.includes('企业招聘首页（非直投）')&&page.includes('查看招聘平台原始记录'),'third-party direct-job distinction missing');
 assert.ok(!jobs.includes('status:"open"'),'never invent live openings');
 const ledger=read('../../docs/WINTER_2027_54_EMPLOYER_PIPELINE.md');
 assert.ok(ledger.includes('后续待逐项核验：**30**'),'latest outstanding candidates must reflect batch07');
 assert.ok(ledger.includes('**24条已处理、30条仍待核验**'),'batch07 cumulative candidate counts must be current');
});


test('batch07 keeps independently sourced January-2027 BNP, LVMH and Credit Agricole records with exact filled/expired labels',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 const bnp=['bnp-hk-2027-securities-services-ref118477','bnp-hk-2027-wealth-management-ref117528','bnp-hk-2027-global-markets-ref117487'];
 const lvmh='lvmh-hk-beauty-2027-jan-sscpc02515';
 const ca=['creditagricole-hk-2027-audit-intern-115888','creditagricole-hk-2027-finance-intern-115202','creditagricole-hk-2027-global-markets-115201'];
 for(const id of [...bnp,lvmh,...ca])assert.ok(ids.includes(id),id+' not indexed');
 assert.equal(ids.length,58,'all seven earlier batches plus the three new mainland jobs');
 assert.equal(new Set(ids).size,58,'no duplicated employer vacancy IDs');
 assert.equal((jobs.match(/status:"filled"/g)||[]).length,3,'three BNP posts all employer-confirmed filled');
 assert.equal((jobs.match(/status:"closed"/g)||[]).length,9,'two additional expired beyond prior seven');
 for(const ref of ['1234567890100118477','1234567890100117528','1234567890100117487','SSCPC02515','2026-115888','2026-115202','2026-115201'])assert.ok(jobs.includes(ref),'missing grounded employer number '+ref);
 for(const domain of ['group.bnpparibas/en/careers/job-offer/','lvmh.com/fr/nous-rejoindre/nos-offres/SSCPC02515','jobs.ca-cib.com'])assert.ok(jobs.includes(domain),domain+' missing');
 assert.ok(jobs.includes('2026年10月16日')&&jobs.includes('2026年10月31日'),'LVMH and CA Global Markets past deadlines must appear');
 assert.ok(jobs.includes('四个月兼职')&&jobs.includes('2027年1月6日'),'CA Global Markets four months vs LVMH intake date must be precise');
 assert.ok(jobs.includes('不提供工作签证担保'),'LVMH work rights warning must remain');
 assert.ok(jobs.includes('额外表格'),'CA finance two-part application requirement must be shown');
 assert.ok(jobs.includes("if(job.status==='filled')return"),'filled must not be labeled as expired applications');
 assert.ok(page.includes("job.status==='filled'?'查看已招满公告'"),'filled roles should have source-only list action');
 assert.ok(page.includes('查看雇主已招满岗位公告'),'filled detail must not promote application');
 assert.ok(!jobs.includes('status:"open"'),'no invented currently available slots');
 const ledger=read('../../docs/WINTER_2027_54_EMPLOYER_PIPELINE.md');
 assert.ok(ledger.includes('后续待逐项核验：**30**'),'remaining 30 companies');
 assert.ok(ledger.includes('**24条已处理、30条仍待核验**')&&ledger.includes('**41条岗位或招聘批次资料**'),'batch07 cumulative counts');
});

test('batch08 adds three distinct China mainland employers and searchable industry groups',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 for(const id of ['haier-qd-vision-algorithm-intern-20261104','hisense-qd-hr-intern-j44475','boe-bj-2027-software-intern-j54754'])assert.ok(ids.includes(id),id+' missing');
 for(const name of ['海尔集团','海信集团','京东方'])assert.ok(jobs.includes(name),name+' missing');
 for(const url of ['maker.haier.net/client/practicemobile/jobs.html','jobs.hisense.com/intern/jobs','boe.zhiye.com/campus/detail'])assert.ok(jobs.includes(url),url+' missing');
 for(const phrase of ['2027寒假到岗时间待核实','2027寒假开始日待企业确认','连续实习6个月以上'])assert.ok(jobs.includes(phrase),phrase+' missing disclaimer');
 assert.ok(page.includes('setKeyword(e.target.value)'),'typing must immediately update search');
 assert.ok(page.includes('winterIndustryGroup(j)===group'),'group facet must affect results');
 assert.ok(page.includes('visibleGroups.map'),'results must be grouped visually');
 assert.ok(page.includes('Number(b.region===\'中国内地\')-Number(a.region===\'中国内地\')'),'mainland records first by default');
 assert.ok(page.includes('matchedPrograms.map'),'keyword search must include programme-only records, without treating them as vacancies');
 const added=jobs.slice(jobs.indexOf('haier-qd-vision-algorithm-intern-20261104'),jobs.indexOf('apco-shanghai-winter-start-1787'));
 assert.equal((added.match(/status: "winter-unverified"/g)||[]).length,3,'new postings are real but winter timing unverified');
});

test('batch09 adds three mainland companies with explicit winter internship recruitment references',()=>{
 const roleIds=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 assert.equal(roleIds.length,58);
 assert.equal(new Set(roleIds).size,58);
 const ids=[
  'cmbc-ningbo-2027-winter-intern-30',
  'bondi-sh-2027-winter-discretionary-trader',
  'bondi-sh-2027-winter-cpp-developer',
  'changchun-wanda-vista-2027-short-winter-intern'
 ];
 for(const id of ids)assert.ok(roleIds.includes(id),id+' missing');
 for(const name of ['中国民生银行宁波分行','邦戴数科','长春万富酒店管理有限公司文华酒店分公司'])assert.ok(jobs.includes(name),name+' missing');
 for(const expected of ['2027年1—3月','2027寒假实习','2026年12月31日','2026-10-06','2026年10月26日','30人是本次公告招聘计划'])assert.ok(jobs.includes(expected),expected+' missing from truthful notices');
 for(const host of ['career.csu.edu.cn/job/view/id/1200470','career.cmbc.com.cn','www.bonditech.com.cn','www.jdjianli.com/campus/75580','www.ncss.cn/student/jobs/'])assert.ok(jobs.includes(host),host+' source absent');
 const page=read('src/pages/WinterInternshipPage.tsx');
 assert.ok(page.includes('教育文旅'),'short-term hotel must have usable category grouping');
 assert.ok(page.includes('酒店|文旅|旅游|教育|教学|餐饮|培训'),'hospitality category matcher missing');
 assert.ok(page.includes('setKeyword(e.target.value)')&&page.includes('terms.every(term=>haystack.includes(term))'),'search logic must remain usable');
 assert.ok(!jobs.includes('status:"open"')&&!jobs.includes('status: "open"'),'do not invent open status');
 const segment=jobs.slice(jobs.indexOf('cmbc-ningbo-2027-winter-intern-30'),jobs.indexOf('haier-qd-vision-algorithm-intern-20261104'));
 assert.equal((segment.match(/status: "source-verify"/g)||[]).length,4,'all four records need employer-source caveats');
});

test('batch10 adds three mainland employers with winter-origin truthfulness and unique identities',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 assert.equal(ids.length,58,'batch09 48 plus batch10 three');
 assert.equal(new Set(ids).size,58,'all job record IDs unique');
 const entries=[
  ['zuoyebang-hz-2026-winter-teaching-assistant-archive','作业帮素养'],
  ['alpha2-sh-winter-quant-strategy-source-check-2026','平方和投资'],
  ['gtht-sh-winter-convert-bond-underwriting-20260909','国泰海通证券']
 ];
 for(const [id,brand] of entries){
  assert.ok(ids.includes(id),id+' must appear');
  assert.ok(jobs.includes(brand),brand+' company must appear');
 }
 for(const evidence of ['career.hznu.edu.cn/campus/view/id/550661','www.alpha2fund.com/joinus.html','www.yinhangvip.com/internships','www.sina.cn/news/detail/5341185761608846.html','hr.gtht.com'])assert.ok(jobs.includes(evidence),'missing traceable source: '+evidence);
 const a=jobs.indexOf("id:'zuoyebang-hz-2026-winter-teaching-assistant-archive'");
 const b=jobs.indexOf("id:'cmbc-ningbo-2027-winter-intern-30'");
 assert.ok(a>=0&&b>a,'new records need to precede batch09');
 const added=jobs.slice(a,b);
 assert.equal((added.match(/\bid:'(?:zuoyebang|alpha2|gtht)-/g)||[]).length,3);
 assert.equal((added.match(/status: "closed"/g)||[]).length,1,'past Zuoyebang winter post must be closed');
 assert.equal((added.match(/status: "source-verify"/g)||[]).length,2,'third-party grouped/convertible leads require verification');
 assert.ok(added.includes('2026年1月24日')&&added.includes('2027寒假未见确认'),'past year must be disclosed');
 assert.ok(added.includes('可转寒假')&&added.includes('归类寒假'),'source type must not be hidden');
 assert.ok(!added.includes('status: "open"'),'no unverified real-time slots');
 const page=read('src/pages/WinterInternshipPage.tsx');
 assert.ok(page.includes('setKeyword(e.target.value)')&&page.includes('WINTER_GROUPS'),'existing live search and groups must be retained');
});

test('batch11 records 3 mainland employers, 7 separate jobs and real winter dates without inventing openings',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 assert.equal(ids.length,58);
 assert.equal(new Set(ids).size,58);
 const cases=[
  'hfbank-bj-2027winter-admin-support-20261105',
  'hfbank-bj-2027winter-corporate-assistant-20261105',
  'hfbank-bj-2027winter-lobby-assistant-20261105',
  'tabs-sh-2027winter-engineering-assistant-20270125',
  'tabs-sh-2027winter-biochemistry-assistant-20270125',
  'tabs-sz-2027winter-biomed-assistant-20270214',
  'roys-hz-2027winter-class-assistant-source-review'
 ];
 for(const id of cases)assert.ok(ids.includes(id),'missing independently sourced vacancy '+id);
 const comp=['恒丰银行北京分行','TABS创新实验室（北京泰博斯教育科技）','Roys乐亦思'];
 for(const name of comp)assert.ok(jobs.includes(name),name+' absent');
 for(const exact of ['2026年11月9日12:00','2027年1月25—31日','2027年2月14—20日','100—150元/天','2027寒假批次待核实'])assert.ok(jobs.includes(exact),'missing necessary disclosed detail '+exact);
 for(const host of ['fenbi.com/page/exam-information-detail/470270481820672','career.hfbank.com.cn','shixiseng.com/intern/inn_bpbngqctny7q','shixiseng.com/intern/inn_2nsclxzsc0qp','shixiseng.com/intern/inn_mqy9upzdcjnd','sohu.com/a/972045060_121123843','jdjianli.com/campus/51040'])assert.ok(jobs.includes(host),'source '+host+' absent');
 const segment=jobs.slice(jobs.indexOf("id:'hfbank-bj-2027winter-admin-support-20261105'"),jobs.indexOf("id:'zuoyebang-hz-2026-winter-teaching-assistant-archive'"));
 assert.equal((segment.match(/status: "source-verify"/g)||[]).length,4,'3 bank roles plus Roys need disclosure of source limitations');
 assert.equal((segment.match(/status: "platform-posting"/g)||[]).length,3,'3 TABS independent platform jobs must be distinguished from official direct apply');
 assert.ok(!segment.includes('status: "open"'),'cannot invent live applications');
 assert.ok(jobs.includes("'platform-posting'"),'status union and rendering must recognize platform jobs');
 assert.ok(page.includes("job.status==='platform-posting'?'查看平台岗位（申请需核实）'"),'platform CTA must distinguish direct from unofficial');
 assert.ok(page.includes("job.id==='roys-hz-2027winter-class-assistant-source-review'"),'Roys is a historical winter-related lead, not confirmed direct posting');
 assert.ok(siteIndex.includes('for(const job of WINTER_2027_JOBS)'),'global search must continue indexing new concrete role records');
});
