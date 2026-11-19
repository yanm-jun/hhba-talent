import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/resume-versions.js';
const origin='https://preview.hhba.example';
const content={job_id:'job-42',job_title:'区域运营督导',company:'示例企业',confirmed_real:true,
 blocks:[{id:'experience-0',section:'experience',text:'负责区域门店运营'}],accepted_ids:['suggest-experience-0']};
function setup({role='candidate',enabled=true}={}){
 const records=[];
 const db={prepare(sql){return {
  async first(){
   if(sql.includes('sqlite_master'))return {name:'hhba_targeted_resume_versions'};
   throw Error('unexpected first');
  },
  bind(...values){return {
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {phone:'account-A',revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone:'account-A',role};
    throw Error('unexpected bound first');
   },
   async all(){
    if(sql.includes('FROM hhba_targeted_resume_versions')){
     return {results:records.filter(r=>r.phone===values[0]&&r.job_id===values[1])
      .slice(-10).reverse()};
    }
    throw Error('unexpected all');
   },
   async run(){
    if(sql.includes('INSERT INTO hhba_targeted_resume_versions')){
     if(records.filter(r=>r.phone===values[7]).length>=15)return {success:true,meta:{changes:0}};
     records.push({id:values[0],phone:values[1],job_id:values[2],job_title:values[3],
      company:values[4],content_json:values[5],created_at:values[6]});
     return {success:true,meta:{changes:1}};
    }
    if(sql.includes('DELETE FROM hhba_targeted_resume_versions')){
     const at=records.findIndex(r=>r.phone===values[0]&&r.id===values[1]);
     if(at===-1)return {success:true,meta:{changes:0}};
     records.splice(at,1);return {success:true,meta:{changes:1}};
    }
    if(sql.includes('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    throw Error('unexpected run');
   }
  };}
 }}};
 return {env:{HHBA_RESUME_VERSION_STORAGE_ENABLED:enabled?'1':'0',
  HHBA_PNVS_AUTH_DB:db},records};
}
function req(method='GET',suffix='?job_id=job-42',body=null,from=origin,auth=true){
 return new Request(origin+'/api/resume-versions'+suffix,{method,headers:{
  Origin:from,...(auth?{Authorization:'Bearer synthetic-token'}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
}
test('storage denies missing activation, cross-origin, unauthenticated and employer',async()=>{
 const inactive=setup({enabled:false});
 assert.equal((await onRequest({request:req(),env:inactive.env})).status,503);
 const s=setup();
 assert.equal((await onRequest({request:req('POST','',content,'https://elsewhere.example'),env:s.env})).status,403);
 assert.equal((await onRequest({request:req('GET','?job_id=job-42',null,origin,false),env:s.env})).status,401);
 assert.equal((await onRequest({request:req('POST','',{...content,accepted_ids:[]}),env:s.env})).status,400);
 assert.equal(s.records.length,0);
 const b=setup({role:'employer'});
 assert.equal((await onRequest({request:req(),env:b.env})).status,403);
});
test('account-bound save, list, and delete',async()=>{
 const s=setup();
 const stored=await onRequest({request:req('POST','',content),env:s.env});
 assert.equal(stored.status,201);
 const value=await stored.json();
 assert.equal(value.ok,true);
 assert.equal(s.records.length,1);
 const listed=await (await onRequest({request:req(),env:s.env})).json();
 assert.equal(listed.items.length,1);
 assert.equal(listed.items[0].version.blocks[0].text,content.blocks[0].text);
 assert.equal((await (await onRequest({request:req('GET','?job_id=another'),env:s.env})).json()).items.length,0);
 assert.equal((await onRequest({request:req('DELETE','?id='+value.id),env:s.env})).status,200);
 assert.equal(s.records.length,0);
});
test('bad document blocks do not persist',async()=>{
 const s=setup();
 const forged={...content,blocks:[{id:'bad/id',section:'experience',text:'changed'}]};
 assert.equal((await onRequest({request:req('POST','',forged),env:s.env})).status,400);
 assert.equal(s.records.length,0);
});

test('saving document contact fields requires explicit truthful confirmation',async()=>{
 const s=setup();
 const details={fullName:'张示例',headline:'区域运营',email:'sample@example.test',
  phone:'13000000000',location:'杭州',summary:'负责销售运营',educationDetails:'某高校·某专业'};
 const denied=await onRequest({request:req('POST','',{...content,details,confirmed_real:false}),env:s.env});
 assert.equal(denied.status,400);
 assert.equal(s.records.length,0);
 const created=await onRequest({request:req('POST','',{...content,details,accepted_ids:[]}),env:s.env});
 assert.equal(created.status,201);
 const stored=JSON.parse(s.records[0].content_json);
 assert.deepEqual(stored.details,details);
 assert.deepEqual(stored.acceptedSuggestionIds,[]);
});
test('oversized or extra document keys are rejected',async()=>{
 const s=setup();
 const fields={fullName:'真姓名',headline:'',email:'',phone:'',location:'',
  summary:'x'.repeat(801),educationDetails:''};
 const a=await onRequest({request:req('POST','',{...content,details:fields}),env:s.env});
 assert.equal(a.status,400);
 const b=await onRequest({request:req('POST','',{...content,details:{...fields,summary:'ok',admin:true}}),env:s.env});
 assert.equal(b.status,400);
});
