/**
 * Test-fixture migration bridge. Production uses only the official OpenAI
 * transport; these historical synthetic fixtures still model the former
 * separate search, fetch, and model interfaces. The adapter is test-only.
 */
export function adaptOldSearchFixtures(mock){
 return async (url,opts={})=>{
  const parsed=new URL(url);
  if(parsed.origin==='https://api.openai.com'&&parsed.pathname==='/v1/responses'){
   const request=JSON.parse(opts.body||'{}');
   if(request.tools?.some(t=>t.type==='web_search')){
    const reply=await mock('https://fixture-provider.invalid/v1/tools/search',{
     ...opts,body:JSON.stringify({query:request.input,count:25,need_content:false})});
    if(!reply.ok)return reply;
    let data;
    try{data=await reply.json()}catch{return Response.json({status:'completed',output:[]})}
    if(!Array.isArray(data?.results))return Response.json({status:'completed',output:[]});
    return Response.json({status:'completed',output:[
     {type:'web_search_call',status:'completed',action:{sources:data.results}}
    ]});
   }
   return mock('https://fixture-provider.invalid/responses',opts);
  }
  if(opts.method==='GET'){
   const reply=await mock('https://fixture-provider.invalid/v1/tools/fetch',{
    ...opts,method:'POST',body:JSON.stringify({url})});
   if(!reply.ok)return reply;
   let data;
   try{data=await reply.json()}catch{return Response.json({status:'completed',output:[]})}
   return new Response(data.content||'',{
    status:200,headers:{'content-type':'text/plain; charset=utf-8'}
   });
  }
  return mock(url,opts);
 };
}
