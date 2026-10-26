import {PROFILE_FIELDS,normalizeProfile,validateProfile,exportProfile,planFields} from "./core.mjs";
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
 for(const [n,label] of [[lastPlan.length,"识别字段"],[eligible.length,"建议填写"],[lastPlan.length-eligible.length,"待处理"]]){
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
  renderPlans();status("已识别 "+data.fields.length+" 个字段；请核对后决定是否填写。");
 }catch(err){status(err.message,true)}finally{$("scan").disabled=false}
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
