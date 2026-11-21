// Derive reassessment input from *server-verified Word revisions only*.
// No AI draft, CSS overlay or guessed replacement counts as a saved edit.
// A source node must map to exactly one position in the parsed source evidence.
export function checkedWordScoreBlocks(originalBlocks,history,revision){
 if(!Array.isArray(originalBlocks)||!Array.isArray(history)||
  !Number.isInteger(revision)||revision<0||revision>8||history.length<revision)
  return {ok:false,reason:'WORD_HISTORY_INCOMPLETE',blocks:[],applied:0};
 const blocks=originalBlocks.map(b=>({...b}));
 if(!blocks.length||blocks.some(b=>!b||typeof b.text!=='string'||typeof b.id!=='string'))
  return {ok:false,reason:'SOURCE_EVIDENCE_MISSING',blocks:[],applied:0};
 for(let step=0;step<revision;step++){
  const h=history[step];
  if(!h||h.revision!==step+1||typeof h.original!=='string'||
   typeof h.text!=='string'||!h.original.trim()||!h.text.trim()||
   h.original===h.text||h.original.length>300||h.text.length>300)
   return {ok:false,reason:'WORD_HISTORY_INCOMPLETE',blocks:[],applied:step};
  const hits=[];
  for(let i=0;i<blocks.length;i++){
   let from=0;
   while(from<blocks[i].text.length){
    const at=blocks[i].text.indexOf(h.original,from);
    if(at<0)break;
    hits.push({index:i,at});
    if(hits.length>1)break;
    from=at+h.original.length;
   }
   if(hits.length>1)break;
  }
  if(hits.length!==1)
   return {ok:false,reason:hits.length?'WORD_EDIT_AMBIGUOUS':'WORD_EDIT_OUTSIDE_PROFILE',
    blocks:[],applied:step};
  const {index,at}=hits[0],before=blocks[index].text;
  const next=before.slice(0,at)+h.text+before.slice(at+h.original.length);
  if(next.length>1600)
   return {ok:false,reason:'WORD_EDIT_OUTSIDE_PROFILE',blocks:[],applied:step};
  blocks[index]={...blocks[index],text:next};
 }
 return {ok:true,reason:null,blocks,applied:revision};
}
