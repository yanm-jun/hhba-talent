import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProfile,validateProfile,planFields,planAIFieldSuggestions} from '../core.mjs';
import {accountApi} from '../account.mjs';

// This is synthetic GR-sector data, NOT an uploaded candidate's actual CV.
// Never commit private names, phone numbers, resumes or user-provided documents.
const candidate=JSON.parse(readFileSync(new URL('./resume-gr-synthetic.json',import.meta.url),'utf8'));
const profile=validateProfile(candidate);
const f=(id,label,kind='text',other={})=>({id,label,kind,type:kind==='select'?'select':'text',
 value:'',placeholder:'',name:'',idAttribute:'',options:[],excluded:false,
 maxLength:-1,required:false,...other});
const fields=[
 f('f1','姓名'),f('f2','电子邮箱','text',{type:'email'}),
 f('f3','手机号','text',{type:'tel'}),f('f4','毕业院校'),
 f('f5','所学专业'),f('f6','最高学历','select',
  {options:[{text:'本科',value:'b'},{text:'硕士',value:'m'}]}),
 f('f7','技能特长','textarea'),f('f8','工作经历','textarea'),
 f('f9','项目经历','textarea'),f('f10','个人简介','textarea'),
 f('f11','最高学位','select',{options:[{text:'学士',value:'b'}]}),
 f('f12','毕业年月','text',{type:'month'}),
 f('f13','现居城市'),f('f14','期望城市'),
 f('f15','期望薪资'),f('f16','身份证号码'),
 f('f17','政治面貌'),f('f18','当前公司名称'),
 f('f19','姓名','text',{value:'网站已有内容'})
];

test('uploaded CV-format profile is compatible with HHBA extension schema',()=>{
 assert.equal(candidate.schema,'hhba-apply-profile-v1');
 assert.equal(profile.degree,'');
 assert.equal(profile.graduation,'');
 assert.equal(profile.city,''); // preferred job city is NOT current city
 assert.equal(profile.email,'candidate@example.invalid');
 assert.ok(profile.experience.includes('甲公司'));
 assert.equal(Object.values(profile).filter(Boolean).length,10);
 assert.deepEqual(normalizeProfile(candidate),profile);
});
test('GR résumé maps only 10 truthful low-risk fields without inventing degree or dates',()=>{
 const out=planFields(fields,profile);
 assert.deepEqual(out.filter(p=>p.eligible).map(p=>p.id),
  ['f1','f2','f3','f4','f5','f6','f7','f8','f9','f10']);
 assert.equal(out.find(p=>p.id==='f6').optionValue,'b');
 assert.ok(out.slice(10).every(p=>!p.eligible));
 assert.ok(out.find(p=>p.id==='f19').reason.includes('已有内容'));
 assert.equal(out.find(p=>p.id==='f11').value,'');
 assert.equal(out.find(p=>p.id==='f14').key,'');
});
test('AI only suggests missing user-authored values; never invents employer or attributes',()=>{
 const fresh=[f('f1','请简述你在项目申报中的具体工作','textarea'),f('f2','岗位匹配理由','textarea'),
  f('f3','身份证号码'),f('f4','最高学位'),
  f('f5','现居城市'),f('f6','曾任职单位'),f('f7','工作经历','textarea')];
 const out=planAIFieldSuggestions(fresh,profile,[
  {id:'f1',key:'experience',confidence:.96,value:'伪造过的工作经历'},
  {id:'f2',key:'summary',confidence:.95,value:'凭空捏造'},
  {id:'f3',key:'fullName',confidence:1},
  {id:'f4',key:'degree',confidence:1},
  {id:'f5',key:'city',confidence:1},
  {id:'f6',key:'experience',confidence:1},
  {id:'f7',key:'experience',confidence:1}
 ]);
 assert.deepEqual(out.map(x=>x.id),['f1','f2']);
 assert.ok(out.every(x=>x.eligible&&x.checked===false));
 assert.equal(out[0].value,profile.experience);
 assert.equal(out[1].value,profile.summary);
 assert.ok(out.every(x=>!x.value.includes('捏造')&&!x.value.includes('伪造')));
});
test('external AI receives ONLY labels and field keys, never CV values',async()=>{
 const device={token:'hhbaext_'+'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString()};
 let request;
 const fake=async (url,opts)=>{request={url,opts};return new Response(JSON.stringify({
  ok:true,matches:[{id:'f1',key:'experience',confidence:.97}]
 }),{status:200})};
 const res=await accountApi(fake,'/ai/map',device,{
  consentToExternalAi:true,
  profileKeys:Object.keys(profile).filter(k=>profile[k]),
  fields:[{id:'f1',label:'请简述工作实践',kind:'textarea',value:profile.experience,
   phone:profile.phone,email:profile.email}]
 });
 assert.equal(res.matches[0].key,'experience');
 const body=request.opts.body;
 assert.ok(body.includes('experience'));
 for(const value of Object.values(profile).filter(Boolean)){
  if(value.length>=7)assert.equal(body.includes(value),false,'CV data must remain local');
 }
 assert.equal(request.opts.credentials,'omit');
 assert.equal(request.opts.method,'POST');
});
