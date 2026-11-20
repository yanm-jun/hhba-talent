import type {OriginalFontPdfProof} from './resumePdfNativeFont.mjs';
export declare function verifyOriginalFontPdfPatch(input:{originalBytes:Uint8Array;editedBytes:Uint8Array;proof:OriginalFontPdfProof;getDocument:(options:any)=>any;canvasFactory:()=>HTMLCanvasElement}):Promise<{ok:true;pageCount:1;originalFont:string;changedPixels:number}>;
