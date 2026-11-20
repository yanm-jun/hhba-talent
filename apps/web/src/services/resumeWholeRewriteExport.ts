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
  !result.blocks.length||result.blocks.some(b=>!b.proposed.trim()))
  throw new Error('WHOLE_REWRITE_INCOMPLETE');
 return {
  details:{
   ...details,
   // A missing name is a conspicuous placeholder, never a made-up identity.
   fullName:details.fullName.trim()||'请填写姓名',
   headline:details.headline.trim()||jobTitle,
   summary:''
  },
  experiences:[],education:[],skills:[],
  sourceParagraphs:result.blocks.map(block=>block.proposed)
 };
}
export function downloadWholeRewriteDocx(result:ResumeWholeRewriteResult,
 jobTitle:string,details:ResumeDocumentDetails):void{
 const doc=wholeRewriteDocument(result,jobTitle,details);
 downloadResumeDocx(doc,jobTitle,'岗位定向简历正文（AI 改写后，请核对）');
}
