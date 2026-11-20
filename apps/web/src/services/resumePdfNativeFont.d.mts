export type OriginalFontPdfProof={schema:'HHBA_PDF_NATIVE_FONT_V1';page:1;fontName:string;fontResource:string;offset:number;length:number;oldText:string;newText:string;originalByteLength:number};
export declare function patchPdfWithOriginalFont(bytes:Uint8Array,original:string,replacement:string):{bytes:Uint8Array;proof:OriginalFontPdfProof};
