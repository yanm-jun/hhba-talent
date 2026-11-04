import type {DetailedGuide} from '../components/OverseasDetailedGuide';
import {auPathways} from './overseasAustralia';
import {auV2PartA} from './overseasAuGuidesV2a';
import {auV2PartB} from './overseasAuGuidesV2b';
import {auV2PartC} from './overseasAuGuidesV2c';
export const auCompleteGuidesV2:Record<string,DetailedGuide>={...auV2PartA,...auV2PartB,...auV2PartC};
for(const pathway of auPathways){
 if(!auCompleteGuidesV2[pathway.id])throw new Error('AU missing full V2 guide: '+pathway.id);
}
