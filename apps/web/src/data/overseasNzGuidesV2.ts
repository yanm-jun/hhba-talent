import type {DetailedGuide} from '../components/OverseasDetailedGuide';
import {nzDetailedGuides} from './overseasNzGuidesV2a.ts';
import {nzDetailedGuidesPart2} from './overseasNzGuidesV2b.ts';
import {nzPathways} from './overseasNewZealand.ts';
export const nzCompleteGuidesV2:Record<string,DetailedGuide>={...nzDetailedGuides,...nzDetailedGuidesPart2};
for(const path of nzPathways){
 if(!nzCompleteGuidesV2[path.id])throw new Error('NZ missing full V2 guide: '+path.id);
}
