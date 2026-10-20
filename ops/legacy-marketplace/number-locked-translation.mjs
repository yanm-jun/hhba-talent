/**
 * Numeric-integrity recovery for third-party machine translation.
 * Rebuild the translated sentence using ONLY official source numeric tokens.
 * Never re-use invented model numbers or invent unstated values.
 * Used only after normal full-context MT fails strict numeric validation.
 */
const NUMBERS=/(\d+(?:[.,]\d+)*(?:[%％])?)/g;
function tokens(text){return text.match(/\d+(?:[.,]\d+)*(?:[%％])?/g)||[]}
export async function translateWithSourceNumbers(source,translateBatch){
 if(typeof source!=="string"||source.length<1||source.length>1600)return null;
 const segments=source.split(NUMBERS);
 const originals=tokens(source);
 if(!originals.length||originals.length>16||segments.length>35)return null;
 const toTranslate=[];
 for(let i=0;i<segments.length;i+=2){
  const part=segments[i];
  // Don't send number-only delimiters to a translator.
  if(/[A-Za-z]{2,}/.test(part))toTranslate.push({index:i,text:part});
 }
 if(!toTranslate.length)return source;
 if(toTranslate.length>16)return null;
 const localized=new Map();
 for(let j=0;j<toTranslate.length;j+=8){
  const batch=toTranslate.slice(j,j+8);
  const results=await translateBatch(batch.map(x=>x.text));
  if(!Array.isArray(results)||results.length!==batch.length)return null;
  for(let k=0;k<batch.length;k++){
   const out=results[k];
   if(typeof out!=="string"||!out.trim()||!/[\u3400-\u9fff]/u.test(out)||
     tokens(out).length||out.includes("\uFFFD"))return null;
   localized.set(batch[k].index,out);
  }
 }
 const reconstructed=segments.map((item,i)=>i%2?item:(localized.get(i)??item)).join("");
 // Exact order and spellings of official source numbers, including % and commas.
 const translatedNumbers=tokens(reconstructed);
 if(originals.length!==translatedNumbers.length||
    originals.some((x,i)=>x!==translatedNumbers[i]))return null;
 if(!/[\u3400-\u9fff]/u.test(reconstructed))return null;
 return reconstructed;
}
