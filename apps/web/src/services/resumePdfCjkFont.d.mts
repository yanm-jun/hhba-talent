export type EmbeddedCjkPdfProof={schema:'HHBA_PDF_CJK_CID_V1';page:1;fontName:string;fontResource:string;offset:number;length:number;oldText:string;newText:string;originalByteLength:number;oldGlyphs:string;newGlyphs:string};
export declare function patchPdfWithOriginalCjkFont(bytes:Uint8Array,original:string,replacement:string):{bytes:Uint8Array;proof:EmbeddedCjkPdfProof};
