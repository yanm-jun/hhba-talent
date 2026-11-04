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
 assert.ok(popup.includes("get('letter')==='1'"),'explicit letter shares must not be covered by winter popup');
 assert.ok(existsSync(new URL('../src/components/HomeOpenLetter.tsx',import.meta.url)),'public letter source must stay present');
 for(const stable of ['<UnifiedJobMarket compact/>','<HomeCompanyMarquee/>','<HomePeopleBanner/>','我要应聘','我要招人'])assert.ok(home.includes(stable),stable+' must remain');
});
test('first visit modal uses accessible close/escape/backdrop and real internal CTA',()=>{
 for(const part of ['aria-modal="true"','role="dialog"','aria-label="关闭寒假实习广告"',"event.key==='Escape'",'e.target===e.currentTarget','sessionStorage.setItem','to="/winter-internship"'])assert.ok(popup.includes(part),part+' missing');
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
 assert.equal(jobIds.length,34,'25 prior plus batch06 3 Sun Life, 5 Manulife, 1 Informa');
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
 assert.ok(popup.includes("window.localStorage.getItem(HIDE_KEY)")&&popup.includes("window.localStorage.setItem(HIDE_KEY,'1')"),'explicit opt-out must persist in browser local storage');
 assert.ok(popup.includes('if(dontShowAgain)'),'closing without a checked box must not persist a preference');
 assert.ok(popup.includes('checked={dontShowAgain}')&&popup.includes('setDontShowAgain(e.target.checked)'),'checkbox must be controllable');
 assert.ok(popup.includes('aria-label="不再显示寒假实习广告"'),'user must be able to locate opt-out choice');
 assert.ok(!popup.includes('getRealAuthToken')&&!popup.includes('/api/resumes'),'never read private account or resume information');
 assert.ok(css.includes('.hhba-winter-hide-choice')&&css.includes('.hhba-winter-modal-actions'),'opt-out must have responsive inline CTA layout');
 assert.ok(page.includes('过滤')||page.includes('筛选'),'filter UI should exist');
});


test('batch05 has seven distinct university-only ReCube winter records and two separately sourced Papergames roles',()=>{
 const ids=[...jobs.matchAll(/\bid:['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
 const recube=['product-uiux-260900318','sustainability-260900321','fullstack-260900315','digital-marketing-260900319','hardware-260900322','website-designer-260900317','data-ai-260900320'];
 for(const name of recube)assert.ok(ids.includes('recube-hk-winter-'+name),'missing real university posting '+name);
 for(const id of ['papergames-shanghai-recruiting-game-rd-intern-2027-review','papergames-shanghai-nikki-world-ecology-planning-280350'])assert.ok(ids.includes(id),'missing sourced Papergames role '+id);
 assert.equal(new Set(ids).size,34);
 assert.equal((jobs.match(/status:"campus-limited"/g)||[]).length,7,'restricted university listings must not be passed as direct public jobs');
 assert.equal((jobs.match(/status:"winter-unverified"/g)||[]).length,2,'two additional daily internships must be marked as winter-unverified');
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
 const ids=[...jobs.matchAll(/\\bid:['"]([a-z0-9-]+)['"]/g)].map(x=>x[1]);
 const sun=['sunlife-hk-strategic-finance-jr00128213','sunlife-hk-financial-reporting-jr00128231','sunlife-hk-actuarial-internship-jr00120885'];
 const man=['manulife-hk-2027-private-equity-jr26091338','manulife-hk-2027-data-finance-jr26091703','manulife-hk-2027-global-info-risk-jr26100089','manulife-hk-2027-marketing-strategy-jr26100142','manulife-hk-2027-tech-placement-jr26100136'];
 const informa='informa-markets-hk-2027-jan-jun-intern-l059656859';
 for(const id of [...sun,...man,informa])assert.ok(ids.includes(id),'batch06 missing distinct job '+id);
 assert.equal(ids.length,34,'batch05 25 plus batch06 9 independent job IDs');
 assert.equal(new Set(ids).size,34,'no duplicate record identifiers');
 assert.equal((jobs.match(/status:"closed"/g)||[]).length,7,'two Sun Life Finance plus five Manulife official expired records');
 assert.ok(jobs.includes('2026年10月30日')&&jobs.includes('2026年11月1日'));
 assert.ok(jobs.includes('2026年11月7日'),'Informa third-party upcoming deadline');
 assert.ok(jobs.includes('JR00128213')&&jobs.includes('JR00128231'),'same-named finance jobs need distinct employer requisitions');
 assert.ok(jobs.includes('JR00120885')&&jobs.includes('包含1月入职的一条招聘记录'),'one actuarial program must not split Jul-Dec');
 assert.ok(jobs.includes('1—7月')&&jobs.includes('1—6月'),'Manulife PE month discrepancy should be documented');
 assert.ok(jobs.includes('L059656859')&&jobs.includes('openuniversity.recruit.com.hk'),'Informa job board evidence required');
 for(const hostname of ['sunlife.wd3.myworkdayjobs.com','manulife.wd3.myworkdayjobs.com','www.informa.com'])assert.ok(jobs.includes(hostname),hostname+' employer primary URL missing');
 assert.ok(page.includes('查看已截止公告')&&page.includes('查看雇主已截止岗位公告'),'closed jobs must not present generic apply CTA');
 assert.ok(page.includes('企业招聘首页（非直投）')&&page.includes('查看招聘平台原始记录'),'third-party direct-job distinction missing');
 assert.ok(!jobs.includes('status:"open"'),'never invent live openings');
 const ledger=read('../../docs/WINTER_2027_54_EMPLOYER_PIPELINE.md');
 assert.ok(ledger.includes('后续待逐项核验：**33**'));
 assert.ok(ledger.includes('**21条**')&&ledger.includes('**33条**'),'21 handled candidates, 33 outstanding');
});
