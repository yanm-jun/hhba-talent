import type {ResumeBlock} from './targetedResumeOptimization';
export interface VerifiedWordHistoryEntry {revision:number;original:string;text:string;updated_at?:string;page_count?:number|null}
export type CheckedWordScoreBlocks=
 | {ok:true;reason:null;blocks:ResumeBlock[];applied:number}
 | {ok:false;reason:string;blocks:ResumeBlock[];applied:number};
export declare function checkedWordScoreBlocks(
 originalBlocks:ResumeBlock[],history:VerifiedWordHistoryEntry[],revision:number,full?:boolean
):CheckedWordScoreBlocks;
