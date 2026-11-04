import {deRoutes,deOfficial,deVerifiedOn,type DeRoute} from './overseasGermanyA.ts';
import {deRoutesB} from './overseasGermanyB.ts';
import {deRoutesC} from './overseasGermanyC.ts';
import type {OverseasPathway} from './overseasNewZealand';
export {deOfficial,deVerifiedOn};
export type {DeRoute};
export const allGermanyRoutes=[...deRoutes,...deRoutesB,...deRoutesC];
export const germanyRouteById:Record<string,DeRoute>=Object.fromEntries(allGermanyRoutes.map(x=>[x.id,x]));
export const germanyPathways:OverseasPathway[]=allGermanyRoutes.map(r=>({
 id:r.id,name:r.name,english:r.english,category:r.category,summary:r.summary,audience:r.audience,
 requirement:r.core.map(x=>x.explain),documents:r.materials.map(x=>x.explain),steps:r.process.map(x=>x.explain),
 fees:r.finance.map(x=>x.explain),rights:r.rights.map(x=>x.explain),risks:r.risks,
 officialUrl:deOfficial[r.sources[0]],secondaryUrl:r.sources[1]?deOfficial[r.sources[1]]:undefined,
 highlights:r.highlights,availability:'check-official'
}));
if(germanyPathways.length!==9||new Set(germanyPathways.map(x=>x.id)).size!==9)throw new Error('Incomplete Germany pathway list: expected 9 independent visa guides');
