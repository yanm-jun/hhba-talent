// Transport compression is lossless. The full original body is retained in
// memory only for the authorized request, never uploaded to a new storage bucket.
export async function v4JsonRequest(init:RequestInit,enabled:boolean):Promise<RequestInit>{
 if(!enabled||typeof init.body!=='string'||typeof CompressionStream!=='function'||new TextEncoder().encode(init.body).byteLength<512*1024)return init;
 if(init.signal?.aborted)throw init.signal.reason;
 const compressed=await new Response(new Blob([init.body],{type:'application/json'}).stream().pipeThrough(new CompressionStream('gzip'))).blob();
 if(init.signal?.aborted)throw init.signal.reason;
 const headers=new Headers(init.headers);headers.set('X-HHBA-JSON-Encoding','gzip');
 return {...init,headers,body:compressed};
}
