import type {ResumeWholeRewriteResult} from './resumeWholeRewriteApi';
import type {ResumeDocument,ResumeDocumentDetails} from './resumeDocument';
import {downloadResumeDocx} from './resumeDocx';

/**
 * A *separately laid-out* Word document for the user's reviewed whole-resume
 * draft. It is never mislabeled as an in-place edit of the original DOCX.
 * The original Word remains safely preserved by the private resume vault.
 */
export function wholeRewriteDocument(result:ResumeWholeRewriteResult,
 jobTitle:string,details:ResumeDocumentDetails):ResumeDocument{
 if(result.coverage.source_blocks!==result.coverage.analyzed_blocks||
  result.blocks.length!==result.coverage.analyzed_blocks||
  !result.blocks.length||result.blocks.some(b=>!b.proposed.trim())||
  new Set(result.blocks.map(b=>b.blockId)).size!==result.blocks.length)
  throw new Error('WHOLE_REWRITE_INCOMPLETE');
 if(details.fullName.trim().length<2)
  throw new Error('请先填写真实姓名，再生成岗位定向 Word。');
 // The planner can reorder SOURCE IDs only, never drop or invent a block.
 // Group headings to produce a professional CV rather than a raw text dump.
 const validOrder=Array.isArray(result.recommended_order)&&
  result.recommended_order.length===result.blocks.length&&
  new Set(result.recommended_order).size===result.blocks.length&&
  result.recommended_order.every(id=>result.blocks.some(b=>b.blockId===id));
 const byId=new Map(result.blocks.map(block=>[block.blockId,block]));
 const ordered=validOrder?
  result.recommended_order!.map(id=>byId.get(id)!):
  result.blocks;
 const sections=new Map<string,typeof ordered>();
 for(const block of ordered){
  if(!sections.has(block.section))sections.set(block.section,[]);
  sections.get(block.section)!.push(block);
 }
 return {
  details:{
   ...details,
   // A missing name is a conspicuous placeholder, never a made-up identity.
   fullName:details.fullName.trim(),
   headline:details.headline.trim()||jobTitle,
   summary:''
  },
  experiences:[],education:[],skills:[],
  // Preserve this for backwards-compatible inspection; Word chooses the
  // explicitly grouped output instead and never prints both copies.
  sourceParagraphs:ordered.map(block=>block.proposed),
  structuredSourceParagraphs:[...sections.values()].flatMap(group=>
   group.map(block=>({section:block.section,text:block.proposed})))
 };
}
export function downloadWholeRewriteDocx(result:ResumeWholeRewriteResult,
 jobTitle:string,details:ResumeDocumentDetails):void{
 const doc=wholeRewriteDocument(result,jobTitle,details);
 downloadResumeDocx(doc,jobTitle,'岗位定向简历正文（AI 改写后，请核对）');
}
