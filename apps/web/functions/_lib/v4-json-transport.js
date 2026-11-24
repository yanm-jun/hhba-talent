// V4 compressed request transport: no additional private CV storage.
// The decoded ceiling is a per-request memory safeguard, not an AI budget.
// A streaming reader enforces it before JSON parsing and rejects zip bombs.
export const V4_DECODED_BODY_BYTES=12*1024*1024;
export async function readV4Json(request){
 const encoding=request.headers.get('X-HHBA-JSON-Encoding')||'identity';
 if(!['gzip','identity'].includes(encoding)||!request.body||
  !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))throw Error('INVALID_REQUEST');
 const length=request.headers.get('Content-Length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>V4_DECODED_BODY_BYTES))throw Error('AI_REQUEST_SEGMENT_REQUIRED');
 let bytes=0;
 const bounded=new TransformStream({transform(chunk,controller){
  bytes+=chunk.byteLength;if(bytes>V4_DECODED_BODY_BYTES)throw Error('AI_REQUEST_SEGMENT_REQUIRED');controller.enqueue(chunk);
 }});
 let stream=request.body.pipeThrough(bounded);
 if(encoding==='gzip')stream=stream.pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let total=0,parts=[];
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   total+=part.value.byteLength;
   if(total>V4_DECODED_BODY_BYTES){await reader.cancel();throw Error('AI_REQUEST_SEGMENT_REQUIRED');}
   parts.push(decoder.decode(part.value,{stream:true}));
  }
  parts.push(decoder.decode());
  return JSON.parse(parts.join(''));
 }catch(e){if(e?.message==='AI_REQUEST_SEGMENT_REQUIRED')throw e;throw Error('INVALID_REQUEST');}
 finally{reader.releaseLock();}
}
