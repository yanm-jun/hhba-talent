export type WordAnchor={id:string;text:string;page:number;bbox:[number,number,number,number]};
export declare function matchWordAnchors(input:{editableText:string[];items:Array<{str:string;transform:number[];width:number;height:number}>;viewport:{width:number;height:number;transform:number[];convertToViewportPoint:(x:number,y:number)=>number[]};page:number}):WordAnchor[];
