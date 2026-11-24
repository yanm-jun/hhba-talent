/**
 * HHBA targeted resume optimization domain model.
 * Provider-neutral: no API keys, HTML, or model-specific response assumptions.
 * A presentation score measures evidence visibility, not newly acquired qualifications.
 */
export const AI_PROVIDERS = ['deepseek','openai','anthropic','gemini','qwen','zhipu','groq','openrouter'] as const;
export type AiProvider = typeof AI_PROVIDERS[number];
export type ResumeSection = 'summary'|'experience'|'education'|'skills'|'projects';
export type SuggestionAction = 'replace'|'append'|'request_evidence';
export type EvidenceStatus = 'verified'|'needs_user_confirmation';
export interface ResumeBlock { id:string; section:ResumeSection; text:string; }
export interface ResumeSuggestion {
 id:string; blockId:string; action:SuggestionAction; original:string; proposed:string;
 rationale:string; jobRequirement:string; evidenceStatus:EvidenceStatus;
}
export interface ResumeVersion { id:string; targetJobId:string; blocks:ResumeBlock[]; acceptedSuggestionIds:string[]; }
export interface ScoreBreakdown {
 presentation:number; evidenceCoverage:number; qualifications:number;
 missingRequired:string[]; explanation:string;
}
export function validateSuggestion(blocks:readonly ResumeBlock[],s:ResumeSuggestion):boolean {
 const block=blocks.find(b=>b.id===s.blockId);
 return !!block && !!s.id && !!s.rationale && !!s.jobRequirement &&
  block.text===s.original && !!s.proposed.trim() &&
  ['replace','append','request_evidence'].includes(s.action) &&
  ['verified','needs_user_confirmation'].includes(s.evidenceStatus);
}
export function applySuggestion(version:ResumeVersion,s:ResumeSuggestion,confirmedEvidence=false):ResumeVersion {
 if(!validateSuggestion(version.blocks,s)) throw new Error('STALE_OR_INVALID_SUGGESTION');
 if(s.action==='request_evidence') throw new Error('USER_EVIDENCE_REQUIRED');
 if(s.evidenceStatus==='needs_user_confirmation'&&!confirmedEvidence) throw new Error('USER_CONFIRMATION_REQUIRED');
 if(version.acceptedSuggestionIds.includes(s.id)) return version;
 return {...version,blocks:version.blocks.map(b=>b.id===s.blockId?{
  ...b,text:s.action==='replace'?s.proposed:b.text+String.fromCharCode(10)+s.proposed
 }:b),acceptedSuggestionIds:[...version.acceptedSuggestionIds,s.id]};
}
export function editResumeBlock(version:ResumeVersion,blockId:string,updatedText:string,{originalWord=false}:{originalWord?:boolean}={}):ResumeVersion {
 const text=updatedText.trim();
 if(!text||(!originalWord&&text.length>1600))throw new Error('INVALID_BLOCK_TEXT');
 if(!version.blocks.some(block=>block.id===blockId))throw new Error('UNKNOWN_RESUME_BLOCK');
 return {...version,blocks:version.blocks.map(block=>block.id===blockId?{...block,text}:block)};
}
export function compareScores(before:ScoreBreakdown,after:ScoreBreakdown){
 // Qualifications are factual and must not increase solely due to wording changes.
 return {
  presentationDelta:after.presentation-before.presentation,
  evidenceCoverageDelta:after.evidenceCoverage-before.evidenceCoverage,
  qualificationDelta:after.qualifications-before.qualifications,
  newlyMissing:after.missingRequired.filter(x=>!before.missingRequired.includes(x)),
  warning:after.qualifications>before.qualifications?'QUALIFICATION_CHANGE_REQUIRES_NEW_VERIFIED_EVIDENCE':null
 };
}
