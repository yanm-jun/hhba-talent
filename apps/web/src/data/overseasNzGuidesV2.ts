import type {DetailedGuide} from '../components/OverseasDetailedGuide';
import {nzDetailedGuides} from './overseasNzGuidesV2a';
import {nzDetailedGuidesPart2} from './overseasNzGuidesV2b';
import {nzPathways} from './overseasNewZealand';
export const nzCompleteGuidesV2:Record<string,DetailedGuide>={...nzDetailedGuides,...nzDetailedGuidesPart2};
for(const path of nzPathways){
 if(!nzCompleteGuidesV2[path.id])throw new Error('NZ missing full V2 guide: '+path.id);
}
