import type {VisualResumeLayout,PageResumeEdit} from './resumeVisualEditingApi';
export type PdfReviewPage={jpeg:Uint8Array;width:number;height:number;pageWidth:number;pageHeight:number};
export declare function buildRasterReviewPdf(pages:PdfReviewPage[],options?:{searchable?:boolean}):Uint8Array;
export declare function createOriginalPdfSearchableCopy(args:{
 document:any;layout:VisualResumeLayout;changes:PageResumeEdit[];
 signal?:AbortSignal;onPage?:(page:number,total:number)=>void;
 canvasFactory?:()=>HTMLCanvasElement;
}):Promise<Uint8Array>;
export declare function downloadOriginalPdfSearchableCopy(bytes:Uint8Array,filename:string):void;
export declare function verifyOriginalPdfSearchableCopy(args:{
 bytes:Uint8Array;expectedPages:number;changes:PageResumeEdit[];
 getDocument:(args:any)=>any;
}):Promise<boolean>;
export declare function createOriginalPdfReviewCopy(args:{
 document:any;layout:VisualResumeLayout;changes:PageResumeEdit[];
 signal?:AbortSignal;onPage?:(page:number,total:number)=>void;
 canvasFactory?:()=>HTMLCanvasElement;
}):Promise<Uint8Array>;
export declare function downloadOriginalPdfReviewCopy(bytes:Uint8Array,filename:string):void;
