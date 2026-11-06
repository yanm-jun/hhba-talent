export declare const PDF_MAX_BYTES:number;
export declare const PDF_MAX_PAGES:number;
export declare const PDF_MAX_TEXT:number;
export declare class PDFResumeError extends Error {code:string;constructor(code:string,message:string)}
export declare function assertPdfBytes(buffer:ArrayBuffer):void;
export declare function pdfTextItemsToLines(items:unknown[]):string[];
export declare function extractPdfText(buffer:ArrayBuffer,options?:{
 signal?:AbortSignal;
 loadPdfJs?:()=>Promise<{getDocument:(input:Record<string,unknown>)=>{promise:Promise<{numPages:number;getPage:(n:number)=>Promise<{getTextContent:(options?:unknown)=>Promise<{items:unknown[]}>;cleanup?:()=>void}>}>;destroy:()=>Promise<void>};GlobalWorkerOptions?:{workerSrc:string}}>;
}):Promise<{text:string;pages:number;characters:number}>;
