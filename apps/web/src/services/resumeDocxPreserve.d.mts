// Types for the existing dependency-free OOXML patcher.
export type DocxTextEdit={original:string;text:string};
export declare function editOriginalDocxStrict(raw:Uint8Array|ArrayBuffer,edits:DocxTextEdit[],options?:{allowExpansion?:boolean}):Promise<Uint8Array>;
export declare function prepareVerifiedOriginalDocxExport(options:{
 original:Uint8Array|ArrayBuffer;
 edits:DocxTextEdit[];
 verifyLayout:(args:{original:Uint8Array;edited:Uint8Array;oldText:string;newText:string})=>Promise<{
  passed:boolean;page_count:number;changed_pixels:number;
  changed_region:{page:number;x:number;y:number;width:number;height:number}
 }>
}):Promise<{bytes:Uint8Array;verified:true;pageCount:number}>;
export declare function inspectOriginalDocxStrict(raw:Uint8Array|ArrayBuffer,options?:{allowParagraphRuns?:boolean}):Promise<{
 mode:'strict_original_docx';editable_text:string[];paragraph_text:string[];entries:string[]
}>;

export declare function distributeStyledText(originalRuns:string[],replacement:string):string[];
