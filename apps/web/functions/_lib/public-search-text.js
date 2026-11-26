// Search snippets sometimes contain encoded numeric entities such as &#x610F;.
// Decode them as plain text, NEVER as HTML; React handles output escaping.
export function decodeSearchText(value){
 if(typeof value!=='string')return '';
 return value.replace(/&(?:#x([0-9a-f]{1,7})|#([0-9]{1,8})|(amp|lt|gt|quot|apos|nbsp));/gi,
  (whole,hex,dec,named)=>{
   if(named)return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[named.toLowerCase()]||whole;
   const cp=Number.parseInt(hex||dec,hex?16:10);
   return cp>0&&cp<=0x10ffff&&(cp<0xd800||cp>0xdfff)?
    String.fromCodePoint(cp):whole;
  });
}
