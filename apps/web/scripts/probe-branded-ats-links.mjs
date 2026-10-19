const candidates=[
 {company:'Stripe',slug:'stripe',hostname:'stripe.com'},
 {company:'Coinbase',slug:'coinbase',hostname:'www.coinbase.com'},
 {company:'Airbnb',slug:'airbnb',hostname:'careers.airbnb.com'},
 {company:'Databricks',slug:'databricks',hostname:'www.databricks.com'}
];
for(const c of candidates){
 try{
  const r=await fetch('https://boards-api.greenhouse.io/v1/boards/'+c.slug+'/jobs',{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('HTTP_'+r.status);
  const json=await r.json();
  if(!Array.isArray(json?.jobs))throw Error('INVALID_RESPONSE');
  const groups=new Map(),examples=[];
  for(const job of json.jobs){
    try{
      const u=new URL(job.absolute_url);
      const g=groups.get(u.hostname)||{count:0,withMatchingGhId:0,hasNativeIdInUrl:0};
      g.count++;
      if(u.searchParams.get('gh_jid')===String(job.id))g.withMatchingGhId++;
      if(u.href.includes(String(job.id)))g.hasNativeIdInUrl++;
      groups.set(u.hostname,g);
      if(examples.length<3)examples.push({id:job.id,url:u.origin+u.pathname+
          (u.searchParams.get('gh_jid')?'?gh_jid='+encodeURIComponent(u.searchParams.get('gh_jid')):'')});
    }catch{}
  }
  console.log('BRANDED_ATS_DOMAIN',JSON.stringify({company:c.company,board:c.slug,jobs:json.jobs.length,
    hosts:Object.fromEntries(groups),examples}));
 }catch(e){console.log('BRANDED_ATS_ERROR',JSON.stringify({company:c.company,error:String(e.message||e)}))}
}
