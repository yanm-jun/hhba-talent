import type {ResumeSuggestion} from './targetedResumeOptimization';
export type OptimizationCheckpoint={pending:string[];suggestions:ResumeSuggestion[]};
export declare function continueDocumentOptimization(options:{
 blockIds:string[];wanted?:string[];signal?:AbortSignal;
 request:(pending:string[])=>Promise<{queued?:boolean;suggestions?:ResumeSuggestion[];pending?:string[];pauseError?:Error;invalidError?:Error}>;
 wait:(signal?:AbortSignal)=>Promise<void>;
 onCheckpoint?:(checkpoint:OptimizationCheckpoint)=>void;onQueued?:()=>void;onPaused?:(error:unknown)=>void;
}):Promise<ResumeSuggestion[]>;
