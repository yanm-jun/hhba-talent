import type {VerifiedResumeAnchor} from './resumeVisualAnchors.mjs';
export type InlinePdfPreviewPlan={safe:false;reason:string}|{safe:true;reason:null;fontPx:number;text:string};
export declare function planInlinePdfPreview(input:{
 anchor:VerifiedResumeAnchor;replacement:string;pageWidth:number;pageHeight:number;
 measure:(text:string,fontPx:number)=>number;onWhite:boolean;
}):InlinePdfPreviewPlan;
export declare function whitePdfPatchBackground(
 canvas:HTMLCanvasElement,box:[number,number,number,number]
):boolean;
