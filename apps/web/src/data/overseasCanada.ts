import {caRoutesA,caOfficial,caVerifiedOn,type CaGuideRoute} from './overseasCanadaA.ts';
import {caRoutesB} from './overseasCanadaB.ts';
import {caRoutesC} from './overseasCanadaC.ts';
import type {OverseasPathway} from './overseasNewZealand';
export {caOfficial,caVerifiedOn};
export type {CaGuideRoute};
export const allCanadaRoutes:CaGuideRoute[]=[...caRoutesA,...caRoutesB,...caRoutesC];
export const caRouteById:Record<string,CaGuideRoute>=Object.fromEntries(allCanadaRoutes.map(x=>[x.id,x]));
export const caPathways:OverseasPathway[]=allCanadaRoutes.map(r=>({
 id:r.id,name:r.name,english:r.english,category:r.category,summary:r.summary,audience:r.audience,
 requirement:r.thresholds.map(x=>x[1]),documents:r.documents.map(x=>x[1]),steps:r.steps.map(x=>x[1]),
 fees:r.budget.map(x=>x[1]),rights:r.rights.map(x=>x[1]),risks:r.risks,
 officialUrl:caOfficial[r.sourceKeys[0]],secondaryUrl:r.sourceKeys[1]?caOfficial[r.sourceKeys[1]]:undefined,
 highlights:r.highlights,availability:'check-official'
}));
if(caPathways.length!==14||new Set(caPathways.map(x=>x.id)).size!==14)throw new Error('Canada 14 distinct programmes missing or duplicate');
export const caClosedWarnings=[
 {label:'魁北克 PEQ',status:'2026-10-31已停止接受新的申请',source:caOfficial.peqClosed},
 {label:'Start-up Visa 加拿大创业签证',status:'2026-11-04暂停，2025 commitment旧件期限已在2026-06-30届满',source:caOfficial.startup},
 {label:'Express Entry 工作offer',status:'2026-11-03已变更LMIA和CRS高薪加分，旧办法不得沿用',source:caOfficial.reform}
];
