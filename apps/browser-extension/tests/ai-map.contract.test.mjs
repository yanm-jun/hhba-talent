import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planAIFieldSuggestions,planFields} from '../core.mjs';
import {accountApi,HHBA_EXTENSION_API} from '../account.mjs';

const profile={fullName:'测试本人',email:'test@example.com',experience:'亲自参加过真实的实习项目'};
const base=(id,label,kind='text',more={})=>({id,label,kind,type:'text',placeholder:'',
 name:'',idAttribute:'',excluded:false,value:'',maxLength:-1,required:false,...more});
const token={token:'hhbaext_'+'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()};

test('AI key mapping suggestions rehydrate ONLY local profile values, never model values',()=>{
 const fields=[base('f1','请填写称呼'),base('f2','介绍你的实践经历','textarea')];
 const result=planAIFieldSuggestions(fields,profile,[
  {id:'f1',key:'fullName',confidence:.98,value:'伪造姓名'},
  {id:'f2',key:'experience',confidence:.96,value:'伪造工作经历'}
 ]);
 assert.equal(result.length,2);
 assert.deepEqual(result.map(x=>x.value),['测试本人','亲自参加过真实的实习项目']);
 assert.ok(result.every(x=>x.eligible&&!x.checked));
 assert.ok(result.every(x=>x.reason.includes('请你核对')||x.reason.includes('需你核对')));
});
test('AI suggestions cannot bypass original privacy rules, existing values and type guard',()=>{
 const fields=[base('f1','身份证号码'),base('f2','已经填写','text',{value:'已有'}),base('f3','姓名'),
  base('f4','特殊说明','select'),base('f5','公司名称'),
  base('f6','普通内容','text',{type:'password'}),base('f7','实习经历摘要','text',{maxLength:2})];
 const hit=fields.map(f=>({id:f.id,key:'fullName',confidence:1}));
 assert.equal(planAIFieldSuggestions(fields,profile,hit).length,0);
 assert.equal(planFields([fields[2]],profile)[0].eligible,true);
});
test('AI label service requires separate token and consent; no resume values transmitted',async()=>{
 let captured;
 const fake=async(url,opts)=>{
  captured={url,opts};
  return new Response(JSON.stringify({ok:true,matches:[{id:'f1',key:'fullName',confidence:.98}]}),{status:200});
 };
 await assert.rejects(()=>accountApi(fake,'/ai/map',token,{consentToExternalAi:false,profileKeys:['fullName'],fields:[]}),/先确认/);
 assert.equal(captured,undefined);
 const data=await accountApi(fake,'/ai/map',token,{
  consentToExternalAi:true,profileKeys:['fullName'],fields:[{id:'f1',label:'称呼',kind:'text',value:'测试本人',secret:'never'}]
 });
 assert.equal(data.matches[0].key,'fullName');
 assert.equal(captured.url,HHBA_EXTENSION_API+'/ai/map');
 assert.equal(captured.opts.credentials,'omit');
 assert.equal(captured.opts.headers.Authorization,'Bearer '+token.token);
 const body=JSON.parse(captured.opts.body);
 assert.deepEqual(body,{consentToExternalAi:true,profileKeys:['fullName'],fields:[{id:'f1',label:'称呼',kind:'text'}]});
 assert.ok(!captured.opts.body.includes('测试本人'));
 assert.ok(!captured.opts.body.includes('never'));
});
test('V0.5 UI requires per-call opt-in and does NOT silently AI-fill or charge',()=>{
 const html=readFileSync(new URL('../popup.html',import.meta.url),'utf8');
 const popup=readFileSync(new URL('../popup.js',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.5.0');
 assert.ok(html.includes('id="ai-consent"'));
 assert.ok(html.includes('id="ai-map"'));
 assert.ok(popup.includes('if(!$("ai-consent").checked)'));
 assert.ok(popup.includes("lastPlan.filter(x=>x.eligible&&x.checked)"));
 assert.ok(popup.includes("planAIFieldSuggestions(scan.fields,profile,response.matches)"));
 assert.ok(popup.includes('accountApi(fetch,"/ai/map",session'));
 assert.ok(!popup.includes('AI_DEDUCT_CREDIT'));
 assert.ok(!popup.includes(".submit("));
});

test('V0.6 private AI disclosure is explicit and refreshed on every call',()=>{
 const html=readFileSync(new URL('../popup.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../popup.js',import.meta.url),'utf8');
 assert.ok(html.includes('ai-privacy-disclosure'));
 assert.ok(html.includes('服务商隐私政策'));
 assert.ok(html.includes('deepseek-privacy-policy.html'));
 assert.ok(html.includes('不会发送姓名、手机号、邮箱值、完整简历正文'));
 assert.ok(js.includes('$("ai-consent").checked=false'));
});
