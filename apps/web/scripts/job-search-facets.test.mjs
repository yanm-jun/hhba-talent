import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNaturalQuery,locationFacts,extractRequirementFacts,searchFacts,searchJobs,classifyJobType}
 from '../src/services/jobSearchFacets.mjs';
const role=(id,title,location,other={})=>({
 id,company:'Example',title,location,platform:'greenhouse',
 source:'example',url:'https://job-boards.greenhouse.io/example/jobs/'+id,
 domestic:false,remote:false,...other
});
const jobs=[
 role('a','Software Engineer','Singapore'),
 role('b','Senior Software Engineer','New York, NY'),
 role('c','Account Executive, Enterprise Sales','New York, US'),
 role('d','Remote Account Executive','United States, Remote',{remote:true}),
 role('e','Software Engineering Intern','Singapore',{remote:true}),
 role('f','Sales Specialist','Singapore',{remote:true}),
 role('g','Software Engineer','Anywhere',{remote:true})
];
const facets=new Map([
 ['a',{countryCode:'SG',cityKey:'singapore',education:'BACHELOR',experienceMinYears:3,skills:['python','sql'],jobType:'REGULAR'}],
 ['b',{countryCode:'US',cityKey:'new york',education:'BACHELOR',experienceMinYears:5,skills:['python'],jobType:'REGULAR'}],
 ['c',{countryCode:'US',cityKey:'new york',education:null,experienceMinYears:1,skills:[],jobType:'REGULAR'}],
 ['d',{countryCode:'US',cityKey:null,education:null,experienceMinYears:null,skills:[],jobType:'REGULAR'}],
 ['e',{countryCode:'SG',cityKey:'singapore',education:null,experienceMinYears:0,skills:[],jobType:'INTERNSHIP'}],
 ['f',{countryCode:'SG',cityKey:'singapore',education:'UNRESTRICTED',experienceMinYears:0,skills:[],jobType:'REGULAR'}],
 ['g',{countryCode:null,cityKey:null,education:null,experienceMinYears:null,skills:[],jobType:'REGULAR'}]
]);
test('recognizes complete Chinese city plus English job intent without residual literal noise',()=>{
 const q=parseNaturalQuery('新加坡软件工程师');
 assert.equal(q.countryCode,'SG');
 assert.equal(q.cityKey,'singapore');
 assert.deepEqual(q.roleKeys,['software']);
 assert.deepEqual(q.terms,[]);
 assert.deepEqual(searchJobs(jobs,{q:'新加坡软件工程师'},facets).rows.map(j=>j.id),['a','e']);
});
test('US sales maps English Account Executive and Sales jobs, not unrelated engineers',()=>{
 const q=parseNaturalQuery('美国销售');
 assert.equal(q.countryCode,'US');
 assert.deepEqual(q.roleKeys,['sales']);
 assert.deepEqual(searchJobs(jobs,{q:'美国销售'},facets).rows.map(j=>j.id),['c','d']);
});
test('remote and no degree required mean strict official evidence; unknown education never matches',()=>{
 const q=parseNaturalQuery('不限学历的远程工作');
 assert.equal(q.remote,true);
 assert.equal(q.education,'UNRESTRICTED');
 assert.deepEqual(q.terms,[]);
 assert.deepEqual(searchJobs(jobs,{q:'不限学历的远程工作'},facets).rows.map(j=>j.id),['f']);
});
test('remote must be true not ambiguous null or false; country unknown must not be US',()=>{
 assert.equal(searchJobs(jobs,{q:'美国远程销售'},facets).rows.length,1);
 assert.equal(searchJobs(jobs,{q:'美国远程销售'},facets).rows[0].id,'d');
 assert.equal(locationFacts('Remote / Worldwide').countryCode,null);
 assert.equal(locationFacts('San Francisco, CA').countryCode,'US');
 assert.equal(locationFacts('San Francisco, CA').cityKey,'san francisco');
 assert.equal(locationFacts('London, United Kingdom').countryCode,'GB');
});
test('country, city, type, education, experience and skills use AND not fuzzy OR',()=>{
 assert.deepEqual(searchJobs(jobs,{location_country:'SG',city:'singapore',recruitment_type:'INTERNSHIP'},facets)
  .rows.map(j=>j.id),['e']);
 assert.deepEqual(searchJobs(jobs,{q:'新加坡 python 软件工程师',education:'BACHELOR',experience:'1-3'},facets)
  .rows.map(j=>j.id),['a']);
 assert.equal(searchJobs(jobs,{q:'新加坡 python 软件工程师',education:'MASTER'},facets).rows.length,0);
 assert.deepEqual(searchJobs(jobs,{experience:'unreported',location_country:'US'},facets).rows.map(j=>j.id),['d']);
});
test('classifies internships and campus positions without calling all ordinary titles officially social',()=>{
 assert.deepEqual(classifyJobType('Software Engineering Intern').jobType,'INTERNSHIP');
 assert.deepEqual(classifyJobType('2027 Graduate Software Engineer').jobType,'CAMPUS');
 assert.deepEqual(classifyJobType('Software Engineer').jobType,'REGULAR');
});
test('extracts only explicit source requirements and avoids treating absence as no restrictions',()=>{
 const facts=extractRequirementFacts('<h3>Required qualifications</h3> Minimum 3 years of relevant experience in Python and SQL. Bachelor’s degree required. Responsibilities include building resilient systems and supporting customers in international organizations.');
 assert.equal(facts.experienceMinYears,3);
 assert.deepEqual(facts.skills,['python','sql']);
 // Apostrophe in source must be normalized, or handled conservatively as unknown.
 assert.ok([null,'BACHELOR'].includes(facts.education));
 const unknown=extractRequirementFacts('We value applicants from many different backgrounds. Learn and grow while developing high quality products together with teammates. We are a team and we welcome all different candidates.');
 assert.equal(unknown.education,null);
 assert.equal(unknown.experienceMinYears,null);
 const unrestricted=extractRequirementFacts('No degree required. No prior experience required. We value motivated candidates and provide extensive training and on-the-job opportunities for everyone in our customer support team.');
 assert.equal(unrestricted.education,'UNRESTRICTED');
 assert.equal(unrestricted.experienceMinYears,0);
});
test('real native ATS titles and original JD alone create source-constrained facets',()=>{
 const fact=searchFacts({title:'Customer Support Intern',location:'Toronto, Canada',
 recruitmentType:null,domestic:false},'<h3>Requirements</h3> Minimum 2 years of professional experience with Salesforce and Excel. We want great communication and customer problem solving skills.');
 assert.equal(fact.countryCode,'CA');
 assert.equal(fact.cityKey,'toronto');
 assert.equal(fact.jobType,'INTERNSHIP');
 assert.equal(fact.experienceMinYears,2);
 assert.deepEqual(fact.skills,['excel','salesforce']);
});


test('no-degree remote fallback includes only explicit no-degree and unknown education with warning mode, never known mandatory degree',()=>{
 const strict=searchJobs(jobs,{q:'不限学历的远程工作'},facets);
 assert.deepEqual(strict.rows.map(j=>j.id),['f']);
 const broad=searchJobs(jobs,{q:'不限学历的远程工作',education:'UNRESTRICTED_OR_UNREPORTED'},facets);
 assert.deepEqual(broad.rows.map(j=>j.id),['d','e','f','g']);
 assert.ok(broad.rows.every(j=>j.remote===true));
 assert.ok(broad.rows.every(j=>(facets.get(j.id)?.education??null)===null||
  facets.get(j.id).education==='UNRESTRICTED'));
});
test('explicit social recruitment never silently includes normal titles inferred from absence of internship',()=>{
 const verified=role('h','Software Engineer','Singapore',{recruitmentType:'SOCIAL'});
 const all=[...jobs,verified];
 assert.deepEqual(searchJobs(all,{q:'社招'},facets).rows.map(j=>j.id),['h']);
 assert.ok(searchJobs(all,{recruitment_type:'REGULAR'},facets).rows.some(j=>j.id==='a'));
 assert.ok(searchJobs(all,{recruitment_type:'REGULAR'},facets).rows.some(j=>j.id==='h'));
 assert.deepEqual(searchJobs(all,{recruitment_type:'SOCIAL'},facets).rows.map(j=>j.id),['h']);
});
