export type VerifiedResumeAnchor={id:string;page:number;kind:string;text:string;source_text:string;verified:true;bbox:[number,number,number,number]};
export type PdfTextItem={str:string;transform:number[];width:number;height:number};
export type PdfViewport={width:number;height:number;transform:number[];convertToViewportPoint:(x:number,y:number)=>number[]};
export declare function matchVisualRegionsToPdfPage(input:{regions:unknown[];items:PdfTextItem[];viewport:PdfViewport;page:number}):VerifiedResumeAnchor[];
