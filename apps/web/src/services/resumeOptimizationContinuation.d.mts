import type {ResumeSuggestion} from './targetedResumeOptimization';
export type OptimizationCheckpoint={pending:string[];suggestions:ResumeSuggestion[];reviewFeedback?:Record<string,string>};
export declare function continueDocumentOptimization(options:{
 blockIds:string[];wanted?:string[];reviewFeedback?:Record<string,string>;signal?:AbortSignal;
 request:(pending:string[],reviewFeedback:Record<string,string>)=>Promise<{queued?:boolean;suggestions?:ResumeSuggestion[];pending?:string[];reviewFeedback?:Record<string,string>;pauseError?:Error;invalidError?:Error}>;
 wait:(signal?:AbortSignal)=>Promise<void>;
 onCheckpoint?:(checkpoint:OptimizationCheckpoint)=>void;onQueued?:()=>void;onPaused?:(error:unknown)=>void;
}):Promise<ResumeSuggestion[]>;
