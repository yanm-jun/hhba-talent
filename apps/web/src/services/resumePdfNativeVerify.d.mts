import type {OriginalFontPdfProof} from './resumePdfNativeFont.mjs';
import type {EmbeddedCjkPdfProof} from './resumePdfCjkFont.mjs';
export declare function verifyOriginalFontPdfPatch(input:{originalBytes:Uint8Array;editedBytes:Uint8Array;proof:OriginalFontPdfProof|EmbeddedCjkPdfProof;getDocument:(options:any)=>any;canvasFactory:()=>HTMLCanvasElement}):Promise<{ok:true;pageCount:1;originalFont:string;changedPixels:number}>;
