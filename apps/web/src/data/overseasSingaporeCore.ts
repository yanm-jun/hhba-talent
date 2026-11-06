/* HHBA Singapore 2026: government-only MOM / ICA / EDB source registry.
 * Verify policy, salary, foreign-worker source, fees and application availability again at submission.
 */
import type {OverseasCategory,OverseasPathway} from './overseasNewZealand';
export const sgVerifiedOn='2026-11-06';
export const sgOfficial={
 ep:'https://www.mom.gov.sg/passes-and-permits/employment-pass',
 epEligibility:'https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility',
 epApply:'https://www.mom.gov.sg/passes-and-permits/employment-pass/apply-for-a-pass',
 epCompass:'https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility',
 epFacts:'https://www.mom.gov.sg/passes-and-permits/employment-pass/key-facts',
 sp:'https://www.mom.gov.sg/passes-and-permits/s-pass',
 spEligibility:'https://www.mom.gov.sg/passes-and-permits/s-pass/eligibility',
 spApply:'https://www.mom.gov.sg/passes-and-permits/s-pass/apply-for-a-pass',
 spFacts:'https://www.mom.gov.sg/passes-and-permits/s-pass/key-facts',
 wp:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker',
 wpFacts:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/key-facts',
 wpApply:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/apply-for-work-permit',
 wpSector:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/sector-specific-rules',
 wpServices:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/sector-specific-rules/services-sector-requirements',
 wpConstruction:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/sector-specific-rules/construction-sector-requirements',
 wpManufacturing:'https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker/sector-specific-rules/manufacturing-sector-requirements',
 one:'https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass',
 oneEligibility:'https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass/eligibility',
 oneFacts:'https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass/key-facts',
 oneApply:'https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass/apply-for-a-pass',
 pep:'https://www.mom.gov.sg/passes-and-permits/personalised-employment-pass',
 pepEligibility:'https://www.mom.gov.sg/passes-and-permits/personalised-employment-pass/eligibility',
 pepFacts:'https://www.mom.gov.sg/passes-and-permits/personalised-employment-pass/key-facts',
 pepApply:'https://www.mom.gov.sg/passes-and-permits/personalised-employment-pass/apply-for-a-pass',
 entre:'https://www.mom.gov.sg/passes-and-permits/entrepass',
 entreEligibility:'https://www.mom.gov.sg/passes-and-permits/entrepass/eligibility',
 entreFacts:'https://www.mom.gov.sg/passes-and-permits/entrepass/key-facts',
 entreDocs:'https://www.mom.gov.sg/passes-and-permits/entrepass/documents-required',
 entreApply:'https://www.mom.gov.sg/passes-and-permits/entrepass/apply-for-a-pass',
 student:'https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/student-s-pass',
 studentIHL:'https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/student-s-pass/student%27s-pass-application-renewal/institutes-of-higher-learning',
 studentPEI:'https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/student-s-pass/student%27s-pass-application-renewal/approved-private-education-institutions',
 whp:'https://www.mom.gov.sg/passes-and-permits/work-holiday-programme',
 whpEligibility:'https://www.mom.gov.sg/passes-and-permits/work-holiday-programme/eligibility',
 whpApply:'https://www.mom.gov.sg/passes-and-permits/work-holiday-programme/apply-for-a-pass',
 whpCompare:'https://www.mom.gov.sg/eservices/services/apply-for-work-holiday-pass',
 whvp:'https://www.mom.gov.sg/passes-and-permits/work-and-holiday-visa-programme',
 whvpEligibility:'https://www.mom.gov.sg/passes-and-permits/work-and-holiday-visa-programme/eligibility',
 whvpApply:'https://www.mom.gov.sg/passes-and-permits/work-and-holiday-visa-programme/apply-for-a-pass',
 tep:'https://www.mom.gov.sg/passes-and-permits/training-employment-pass',
 tepEligibility:'https://www.mom.gov.sg/passes-and-permits/training-employment-pass/eligibility',
 tepDocs:'https://www.mom.gov.sg/passes-and-permits/training-employment-pass/documents-required',
 tepApply:'https://www.mom.gov.sg/passes-and-permits/training-employment-pass/apply-for-a-pass',
 twp:'https://www.mom.gov.sg/passes-and-permits/training-work-permit',
 twpFacts:'https://www.mom.gov.sg/passes-and-permits/training-work-permit/key-facts',
 twpDocs:'https://www.mom.gov.sg/passes-and-permits/training-work-permit/documents-required',
 dp:'https://www.mom.gov.sg/passes-and-permits/dependants-pass',
 dpEligibility:'https://www.mom.gov.sg/passes-and-permits/dependants-pass/eligibility',
 dpApply:'https://www.mom.gov.sg/passes-and-permits/dependants-pass/apply-for-a-pass',
 ltvp:'https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/long-term-visit-pass',
 ltvpRules:'https://www.ica.gov.sg/reside/LTVP/',
 ltvpApply:'https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/long-term-visit-pass/long-term-visit-pass-application-renewal',
 pr:'https://www.ica.gov.sg/reside/PR/',
 prApply:'https://www.ica.gov.sg/information-and-e-services/citizenship-and-permanent-residence/permanent-residence',
 gip:'https://www.edb.gov.sg/en/incentives-and-programmes/global-investor-programme.html',
 gipOverview:'https://www.edb.gov.sg/content/dam/edb-en/how-we-help/global-investor-programme-funds/Gip%20Overview-English.pdf',
 gipFunds:'https://www.edb.gov.sg/en/incentives-and-programmes/global-investor-programme-select-funds.html',
 gipApproval:'https://www.ica.gov.sg/information-and-e-services/citizenship-and-permanent-residence/permanent-residence'
} as const;
export type SgTriple=[string,string,string];
export type SgRoute={
 id:string;name:string;english:string;category:OverseasCategory;summary:string;audience:string;
 highlights:string[]; eligibility:SgTriple[];documents:SgTriple[];steps:SgTriple[];
 budget:SgTriple[];timeline:SgTriple[];rights:SgTriple[];next:SgTriple[];
 faq:[string,string][];risks:string[];sourceKeys:(keyof typeof sgOfficial)[];
 noOffer?:boolean;availability?:'check-official'|'closed';
};
export function sgLines(data:string):SgTriple[]{
 return data.trim().split('\n').map(line=>{
  const fields=line.trim().split('¦').map(x=>x.trim());
  if(fields.length!==3 || fields.some(x=>!x))throw new Error('Bad Singapore detailed point: '+line);
  return fields as SgTriple;
 });
}
export function routeToPathway(r:SgRoute):OverseasPathway{
 return {id:r.id,name:r.name,english:r.english,category:r.category,summary:r.summary,audience:r.audience,
  requirement:r.eligibility.map(x=>x[1]),documents:r.documents.map(x=>x[1]),steps:r.steps.map(x=>x[1]),
  fees:r.budget.map(x=>x[1]),rights:r.rights.map(x=>x[1]),risks:r.risks,
  officialUrl:sgOfficial[r.sourceKeys[0]],secondaryUrl:sgOfficial[r.sourceKeys[1]],highlights:r.highlights,
  availability:r.availability||'check-official'};
}
