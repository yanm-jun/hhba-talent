import {PROFILE_FIELDS,normalizeProfile,validateProfile,exportProfile,planFields,planAIFieldSuggestions} from "./core.mjs";
import {HHBA_PERMISSION,EXTENSION_SESSION_KEY,accountApi,cleanPairCode,validDeviceSession} from "./account.mjs";
const $=id=>document.getElementById(id);
const STORAGE="hhba.apply.profile.v1";
let profile=normalizeProfile({}),lastScan=null,lastPlan=[],tabId=null;
function status(message,bad=false){$("status").textContent=message;$("status").style.color=bad?"#b84b42":"#356c4e";}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function toggle(view){
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!=="view-"+view));
 document.querySelectorAll(".tab").forEach(v=>{v.classList.toggle("active",v.dataset.view===view);v.setAttribute("aria-selected",String(v.dataset.view===view));});
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>toggle(b.dataset.view)));
const formFields=$("profile-fields");
for(const [key,label] of PROFILE_FIELDS){
 const wrapper=el("label","field"),caption=el("span","",label);
 const input=["experience","projects","summary","skills"].includes(key)?el("textarea"):el("input");
 if(input.tagName==="INPUT")input.type="text";
 input.name=key;input.maxLength=["experience","projects"].includes(key)?12000:4000;
 input.placeholder=["experience","projects"].includes(key)?"请真实描述，复杂经历通常需手动检查":label;
 wrapper.append(caption,input);formFields.append(wrapper);
}
function renderProfile(){for(const [key] of PROFILE_FIELDS)formFields.querySelector('[name="'+key+'"]').value=profile[key]||""}
function captureProfile(){
 const data={};for(const [key] of PROFILE_FIELDS)data[key]=formFields.querySelector('[name="'+key+'"]').value;
 return validateProfile(data);
}
async function storeProfile(next){await chrome.storage.local.set({[STORAGE]:next});profile=next;renderProfile();}
$("profile-form").addEventListener("submit",async e=>{
 e.preventDefault();try{await storeProfile(captureProfile());status("已保存到当前浏览器扩展。")}catch(err){status(err.message,true)}
});
$("clear").addEventListener("click",async()=>{
 if(!confirm("确定删除这个浏览器扩展中的求职资料吗？此操作不可撤销。"))return;
 await chrome.storage.local.remove(STORAGE);profile=normalizeProfile({});renderProfile();lastScan=null;lastPlan=[];$("plan").replaceChildren();$("fill").classList.add("hidden");status("本地档案已清除。");
});
$("export").addEventListener("click",()=>{
 try{
  const raw=captureProfile();const blob=new Blob([exportProfile(raw)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="HHBA-求职档案.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);status("已导出档案，请妥善保管文件。");
 }catch(err){status(err.message,true)}
});
$("import").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>200000)throw Error("档案文件超过 200KB，请检查后重试");
  const next=validateProfile(JSON.parse(await file.text()));await storeProfile(next);
  status("已导入 HHBA 求职档案，请检查每项内容。");toggle("profile");
 }catch(err){status("导入失败："+err.message,true)}
 e.target.value="";
});
async function activeTab(){
 const tabs=await chrome.tabs.query({active:true,currentWindow:true});
 const tab=tabs[0];if(!tab?.id||!/^https?:\/\//.test(tab.url||""))throw Error("请在普通企业招聘网页中使用；浏览器内部页面不可填写。");
 tabId=tab.id;return tab;
}
async function connect(){
 const tab=await activeTab();
 await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
 return tab;
}
async function ask(type,data={}){
 const tab=await connect();
 return await chrome.tabs.sendMessage(tab.id,{type,...data});
}
function renderPlans(){
 $("plan").replaceChildren();
 const eligible=lastPlan.filter(x=>x.eligible);
 $("counts").classList.remove("hidden");
 $("counts").replaceChildren();
 const manual=lastScan?.manualWidgets?.length||0;
 for(const [n,label] of [[lastPlan.length+manual,"识别项目"],[eligible.length,"建议填写"],[lastPlan.length-eligible.length+manual,"待人工"]]){
  const box=el("span"),strong=el("strong","",String(n)),small=el("small","",label);box.append(strong,small);$("counts").append(box);
 }
 for(const p of lastPlan){
  const row=el("label","plan-row"),checkbox=el("input"),text=el("span","plan-text");
  checkbox.type="checkbox";checkbox.disabled=!p.eligible;checkbox.checked=p.checked;
  checkbox.addEventListener("change",()=>p.checked=checkbox.checked);
  text.append(el("strong","",p.label),el("small","",p.reason));
  if(p.eligible)text.append(el("em","",p.value));
  const focusButton=el("button","focus-field","定位");
  focusButton.type="button";focusButton.addEventListener("click",async()=>{
   try{const r=await ask("HHBA_FOCUS",{id:p.id});if(!r?.ok)throw Error(r?.error||"无法定位");status("已在招聘网页定位「"+p.label+"」。");}
   catch(e){status(e.message,true)}
  });
  row.append(checkbox,text,focusButton);$("plan").append(row);
 }
 $("fill").classList.toggle("hidden",!eligible.length);
}
$("sidepanel").addEventListener("click",()=>{
 if(!chrome.sidePanel?.open)return status("当前浏览器不支持侧边栏，请继续使用扩展弹窗。",true);
 chrome.tabs.query({active:true,currentWindow:true},tabs=>{
  const tab=tabs?.[0];if(!tab?.windowId)return status("无法识别当前窗口。",true);
  chrome.sidePanel.open({windowId:tab.windowId}).then(()=>window.close()).catch(()=>status("无法打开侧边栏，请继续使用扩展弹窗。",true));
 });
});
$("scan").addEventListener("click",async()=>{
 $("scan").disabled=true;status("正在识别当前表单…");$("results").replaceChildren();
 try{
  const data=await ask("HHBA_SCAN");if(!data?.ok)throw Error(data?.error||"识别失败");
  lastScan=data;lastPlan=planFields(data.fields,profile);
  $("site").textContent=(data.host||"当前页面")+" · "+(data.title||"网申表单");
  renderPlans();status("已识别 "+data.fields.length+" 个标准字段，"+(data.manualWidgets?.length||0)+" 个自定义控件需手动处理。");
 }catch(err){status(err.message,true)}finally{$("scan").disabled=false}
});
$("quickfill").addEventListener("click",async()=>{
 if($("quickfill").disabled)return;
 $("quickfill").disabled=true;status("正在识别并预填高置信度字段…");
 $("results").replaceChildren();
 try{
  // One explicit click triggers scan, strict local matching, fill and readback.
  // This has NO network requests, billing, CAPTCHA handling or auto-submission.
  const data=await ask("HHBA_SCAN");
  if(!data?.ok)throw Error(data?.error||"当前表单无法识别");
  lastScan=data;lastPlan=planFields(data.fields,profile);
  $("site").textContent=(data.host||"当前网页")+" · "+(data.title||"招聘申请表");
  renderPlans();
  const steps=lastPlan.filter(x=>x.eligible).map(x=>({id:x.id,value:x.value,optionValue:x.optionValue}));
  if(!steps.length){status("没有可以安全预填的普通字段，请手动核对其他项目。");return}
  const result=await ask("HHBA_FILL",{scanId:lastScan.scanId,steps});
  if(!result?.ok)throw Error(result?.error||"填写失败");
  for(const item of result.results){
   const p=lastPlan.find(x=>x.id===item.id);
   $("results").append(el("div","result "+(item.status==="filled"?"success":item.status==="failed"?"error":"warning"),
    (p?.label||item.id)+"："+(item.status==="filled"?"已填写":item.status==="failed"?"失败":"跳过")+" · "+item.reason));
  }
  status("已回读确认 "+result.filled+" 项，失败 "+result.failures+" 项；另有 "+(lastScan.manualWidgets?.length||0)+" 个自定义控件需手动处理。请在官网核对并提交，可撤销。");
 }catch(e){status(e?.message||"预填失败",true)}
 finally{$("quickfill").disabled=false}
});
$("ai-map").addEventListener("click",async()=>{
 if(!$("ai-consent").checked)return status("请先确认本次 AI 字段分析的内容与授权范围。",true);
 const session=await savedDeviceSession();
 if(!session)return status("请先在「连接账户」中使用一次性连接码连接 HHBA。",true);
 if(!$("ai-map").disabled){
  $("ai-map").disabled=true;status("正在请求 AI 分析当前网页的非敏感字段标签…");
  try{
   const scan=await ask("HHBA_SCAN");
   if(!scan?.ok)throw Error(scan?.error||"无法识别当前网页");
   const local=planFields(scan.fields,profile);
   // Never send a profile value. Unknown labels are untrusted; drop labels
   // with email, long digits, identity, password, consent or legal text.
   const sensitive=/(?:\d{6,}|@|https?:|www\.|身份证|证件|护照|验证码|密码|隐私|承诺|同意|授权|婚姻|健康|民族|宗教|政治|家庭|工资|薪酬|性别|出生|captcha|consent|agreement|salary|password)/i;
   const fields=scan.fields.filter((f,i)=>!local[i]?.eligible&&!f.value&&!f.excluded&&
    ['text','textarea'].includes(f.kind)&&typeof f.label==="string"&&f.label.trim()&&
    f.label.length<=80&&!sensitive.test(f.label))
    .slice(0,30).map(f=>({id:f.id,label:f.label,kind:f.kind}));
   const profileKeys=PROFILE_FIELDS.map(([key])=>key).filter(key=>Boolean(profile[key]));
   lastScan=scan;lastPlan=local;
   if(!fields.length||!profileKeys.length){
    renderPlans();status("没有适合 AI 分析的非敏感陌生字段，建议继续使用本地预填。");return;
   }
   const response=await accountApi(fetch,"/ai/map",session,{consentToExternalAi:true,profileKeys,fields});
   const suggestions=planAIFieldSuggestions(scan.fields,profile,response.matches);
   const byId=new Map(suggestions.map(x=>[x.id,x]));
   lastPlan=local.map(p=>p.eligible?p:(byId.get(p.id)||p));
   renderPlans();
   status("AI 建议 "+suggestions.length+" 项，默认均未勾选。请逐项核对并确认填写；不会自动提交、收费或扣次。");
  }catch(e){
   const message=e?.message||"AI 字段识别暂时不可用";
   status(message.includes("AI_NOT_ENABLED")?"AI 字段服务尚未正式开放。可继续使用免费的本地预填。":message,true);
  }finally{$("ai-map").disabled=false}
 }
});
$("fill").addEventListener("click",async()=>{
 if(!lastScan)return status("请先扫描当前页面。",true);
 const steps=lastPlan.filter(x=>x.eligible&&x.checked).map(x=>({id:x.id,value:x.value,optionValue:x.optionValue}));
 if(!steps.length)return status("没有勾选可填写字段。",true);
 $("fill").disabled=true;status("正在填写并核验…");
 try{
  const result=await ask("HHBA_FILL",{scanId:lastScan.scanId,steps});
  if(!result?.ok)throw Error(result?.error||"填写失败");
  $("results").replaceChildren();
  for(const item of result.results){
   const plan=lastPlan.find(x=>x.id===item.id);
   $("results").append(el("div","result "+(item.status==="filled"?"success":item.status==="failed"?"error":"warning"),(plan?.label||item.id)+"："+
    (item.status==="filled"?"已填写":item.status==="failed"?"失败":"跳过")+" · "+item.reason));
  }
  status("本次回读确认 "+result.filled+" 项，失败 "+result.failures+" 项。请检查官网再手动提交。");
 }catch(err){status(err.message,true)}finally{$("fill").disabled=false}
});
$("undo").addEventListener("click",async()=>{
 try{
  const result=await ask("HHBA_UNDO");if(!result?.ok)throw Error(result?.error||"撤销失败");
  status("已撤销 "+result.restored+" 个未被你再次修改的字段；页面已改变时请手动检查。");
 }catch(err){status(err.message,true)}
});
(async()=>{
 try{const result=await chrome.storage.local.get(STORAGE);profile=normalizeProfile(result[STORAGE]);renderProfile();
  const tab=await activeTab();$("site").textContent=(new URL(tab.url)).hostname;
  if(!Object.values(profile).some(Boolean)){toggle("profile");status("先建立一份真实求职档案，再扫描企业官网。");}
 }catch(err){status(err.message,true)}
})();


// HHBA account pairing is opt-in and read-only. All recruitment form filling
// above remains local and works without a linked account.
async function savedDeviceSession(){
 const row=await chrome.storage.session.get(EXTENSION_SESSION_KEY);
 const token=row[EXTENSION_SESSION_KEY];
 if(!validDeviceSession(token)){
  await chrome.storage.session.remove(EXTENSION_SESSION_KEY);
  return null;
 }
 return token;
}
async function refreshAccount(){
 const token=await savedDeviceSession();
 if(!token){$("account-state").textContent="未连接或已过期";$("account-balance").textContent="剩余次数：—";return}
 try{
  const result=await accountApi(fetch,"/wallet",token);
  $("account-state").textContent="已连接 · 只读 · 临时会话";
  $("account-balance").textContent="剩余次数："+result.wallet.available+" 次（已预占 "+result.wallet.reserved+" 次）";
 }catch(e){
  $("account-state").textContent="连接暂不可用";
  $("account-balance").textContent="剩余次数：—";
  status(e?.message||"无法读取次数账户",true);
 }
}
$("pair-connect").addEventListener("click",async()=>{
 const code=cleanPairCode($("pair-code").value);
 if(!code)return status("请先在 HHBA 网站生成12位一次性连接码。",true);
 // Must request the narrowly scoped optional permission directly in a click
 // event; do not ask for permission to read every recruitment website.
 $("pair-connect").disabled=true;
 try{
  const granted=await chrome.permissions.request({origins:[HHBA_PERMISSION]});
  if(!granted)throw Error("未授予 hhba.work 访问许可，连接未建立。");
  const res=await accountApi(fetch,"/claim",null,{code});
  const session={token:res.token,expiresAt:res.expiresAt};
  if(!validDeviceSession(session))throw Error("服务器返回的临时会话无效。");
  await chrome.storage.session.set({[EXTENSION_SESSION_KEY]:session});
  $("pair-code").value="";
  status("HHBA 账户连接成功。当前只支持次数查询，不会扣次或发送简历。");
  await refreshAccount();
 }catch(e){status(e?.message||"无法连接 HHBA，请稍后再试。",true)}
 finally{$("pair-connect").disabled=false}
});
$("pair-refresh").addEventListener("click",async()=>{
 $("pair-refresh").disabled=true;
 try{await refreshAccount()}
 finally{$("pair-refresh").disabled=false}
});
$("pair-disconnect").addEventListener("click",async()=>{
 const token=await savedDeviceSession();
 try{if(token)await accountApi(fetch,"/disconnect",token)}
 catch{/* Revoke via the HHBA website if the network is unavailable. */}
 finally{
  await chrome.storage.session.remove(EXTENSION_SESSION_KEY);
  $("account-state").textContent="已在本机断开";
  $("account-balance").textContent="剩余次数：—";
  status("本地连接已清除。如网络中断，请在 HHBA 网站撤销所有连接以立即让服务器令牌失效。");
 }
});
void refreshAccount();


// User-triggered navigation only. No website login token or resume content is
// transferred to the extension merely by opening the user's HHBA workspace.
$("open-hhba-account").addEventListener("click",()=>{
 chrome.tabs.create({url:"https://hhba.work/candidate/account/apply-assistant"});
});
$("open-hhba-resume").addEventListener("click",()=>{
 chrome.tabs.create({url:"https://hhba.work/candidate/account/resume"});
});
