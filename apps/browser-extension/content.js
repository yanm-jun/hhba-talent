/* HHBA isolated-world agent. Invoked only after explicit user action.
   Does not submit forms, upload files, bypass CAPTCHAs or call network APIs. */
(function(){
 if(globalThis.__hhbaApplyAgentInstalled)return;
 globalThis.__hhbaApplyAgentInstalled=true;
 let current=new Map(), scanId="", scanUrl="", snapshot=[];
 const forbidden=/(password|hidden|submit|reset|button|image|file|search)/i;
 const highRisk=/(身份证|证件|政治面貌|民族|家庭|亲属|紧急联系人|密码|验证码|诚信|背景调查|声明|签名|授权|同意|隐私|婚姻|生育|健康|敏感|薪资|社保|银行卡|护照|人脸|企业名称|工作单位|备注.*声明|captcha|otp|consent|agreement|privacy)/i;
 const clean=s=>String(s||"").replace(/[\s\u00a0]+/g," ").trim().slice(0,180);
 const txt=el=>clean(el?.textContent||"");
 function labelOnlyText(label){
  // The <label> element can wrap <select> and all its <option> children.
  // Text from options must not become the field's label.
  const copy=label.cloneNode(true);
  copy.querySelectorAll("input,select,textarea,button,option,svg,script,style").forEach(n=>n.remove());
  return clean(copy.textContent||"");
 }
 function visible(el){
  if(el.disabled||el.closest('[hidden],[aria-hidden="true"]'))return false;
  const style=getComputedStyle(el);
  if(style.display==="none"||style.visibility==="hidden")return false;
  return !!(el.getClientRects().length);
 }
 function fieldLabel(el){
  const labels=el.labels?Array.from(el.labels).map(labelOnlyText).filter(Boolean):[];
  if(labels.length)return labels.join(" ").slice(0,180);
  const aria=el.getAttribute("aria-label");if(aria)return clean(aria);
  const labelled=el.getAttribute("aria-labelledby");
  if(labelled){
   const str=labelled.split(/\s+/).map(x=>document.getElementById(x)).map(txt).filter(Boolean).join(" ");
   if(str)return str.slice(0,180);
  }
  const wrap=el.closest("label");if(wrap)return labelOnlyText(wrap).slice(0,180);
  const group=el.closest(".ant-form-item,.el-form-item,.arco-form-item,.form-item,.form-group,.layui-form-item,td");
  if(group){
   const l=group.querySelector("label,.ant-form-item-label,.el-form-item__label,.arco-form-item-label,th");
   if(l)return txt(l);
  }
  const prev=el.previousElementSibling;
  if(prev&&/LABEL|SPAN|DIV|TH/.test(prev.tagName)&&txt(prev).length<70)return txt(prev);
  return "";
 }
 function scan(){
  current=new Map();
  const fields=[];
  const elements=document.querySelectorAll("input,textarea,select");
  let pos=0;
  for(const el of elements){
   const type=(el.getAttribute("type")||"text").toLowerCase();
   if(forbidden.test(type)||!visible(el)||el.readOnly)continue;
   // Radio/checkbox/custom widgets are surfaced to the user, never modified in V0.1.
   const kind=el.matches("select")?"select":type==="checkbox"?"checkbox":type==="radio"?"radio":
     el.matches("textarea")?"textarea":"text";
   const label=fieldLabel(el);
   const placeholder=clean(el.getAttribute("placeholder"));
   const name=clean(el.getAttribute("name"));
   const idAttribute=clean(el.id);
   const groupText=clean(el.closest("fieldset,.ant-form-item,.el-form-item,.arco-form-item,.form-group")?.querySelector("legend,label")?.textContent);
   const context=[label,placeholder,name,idAttribute,groupText,el.getAttribute("autocomplete")].join(" ");
   const id="f"+(++pos);
   current.set(id,el);
   const options=kind==="select"?Array.from(el.options).map(opt=>({text:clean(opt.text),value:opt.value,disabled:opt.disabled})):
    [];
   fields.push({id,kind,type,label,placeholder,name,idAttribute,options,required:el.required,maxLength:el.maxLength,
    value:kind==="checkbox"||kind==="radio"?(el.checked?"已填写":""):(String(el.value||"")?"已填写":""),
    excluded:highRisk.test(context)});
  }
  scanId=String(Date.now())+"-"+Math.random().toString(36).slice(2,8);
  scanUrl=location.href;
  return {ok:true,scanId,host:location.hostname,title:document.title,
   fields,notice:"只扫描当前网页中的可见标准控件；iframe、复杂自定义控件需人工核对。"};
 }
 function setNative(el,value){
  const own=(el.tagName==="TEXTAREA"?HTMLTextAreaElement:el.tagName==="SELECT"?HTMLSelectElement:HTMLInputElement).prototype;
  const set=Object.getOwnPropertyDescriptor(own,"value")?.set;
  if(!set)throw Error("浏览器无法设置此控件");
  set.call(el,value);
  el.dispatchEvent(new Event("input",{bubbles:true}));
  el.dispatchEvent(new Event("change",{bubbles:true}));
 }
 function fill(data){
  if(!data||data.scanId!==scanId||scanUrl!==location.href)return {ok:false,error:"页面已变化，请重新扫描"};
  if(!Array.isArray(data.steps))return {ok:false,error:"缺少填写指令"};
  if(data.steps.length>200)return {ok:false,error:"单次填写字段过多"};
  const results=[];
  // Preserve previous writes across multiple user-triggered batches until explicitly undone.
  snapshot=snapshot.filter(r=>r.el.isConnected&&String(r.el.value||"")===r.written);
  const done=new Set();
  for(const step of data.steps){
   const el=current.get(step.id),key=step.id;
   if(done.has(key)){results.push({id:key,status:"skipped",reason:"重复字段"});continue}
   done.add(key);
   if(!el||!el.isConnected||!visible(el)){results.push({id:key,status:"failed",reason:"字段已消失或隐藏"});continue}
   if(el.readOnly||el.disabled){results.push({id:key,status:"skipped",reason:"网页已锁定此字段"});continue}
   if(el.value){results.push({id:key,status:"skipped",reason:"原有内容未覆盖"});continue}
   if(highRisk.test([fieldLabel(el),el.name,el.id,el.placeholder].join(" "))){
    results.push({id:key,status:"skipped",reason:"敏感字段需人工确认"});continue;
   }
   if(el.type==="password"||el.type==="file"||el.type==="checkbox"||el.type==="radio"){
    results.push({id:key,status:"skipped",reason:"不修改需要本人确认的控件"});continue;
   }
   if(typeof step.value!=="string"||step.value.length>12000){results.push({id:key,status:"failed",reason:"字段值无效"});continue}
   const old=String(el.value||"");
   try{
    if(el.tagName==="SELECT"){
      const allowed=Array.from(el.options).find(o=>o.value===step.optionValue&&!o.disabled);
      if(!allowed)throw Error("原选项不存在，请重新扫描");
      setNative(el,allowed.value);
    }else setNative(el,step.value);
    const expected=el.tagName==="SELECT"?step.optionValue:step.value;
    const actual=String(el.value||"");
    if(actual!==expected)throw Error("回读不一致，请手动检查");
    if(el.validity&&!el.validity.valid)throw Error("网站校验未通过");
    snapshot.push({el,old,written:actual});
    results.push({id:key,status:"filled",reason:"已写入并回读确认"});
   }catch(e){
    // No misleading failed status that leaves the invalid value on the live website.
    if(el.isConnected&&String(el.value||"")!==old){try{setNative(el,old)}catch{}}
    results.push({id:key,status:"failed",reason:e?.message||"写入失败"});
   }
  }
  return {ok:true,results,filled:results.filter(x=>x.status==="filled").length,failures:results.filter(x=>x.status==="failed").length};
 }
 function focus(data){
  const el=current.get(data?.id);
  if(!el||!el.isConnected)return {ok:false,error:"字段已变化，请重新扫描"};
  el.scrollIntoView({behavior:"smooth",block:"center"});
  el.focus({preventScroll:true});
  return {ok:true};
 }
 function undo(){
  let count=0;
  for(const r of snapshot){
   if(!r.el.isConnected||String(r.el.value||"")!==r.written)continue;
   try{setNative(r.el,r.old);count++}catch{}
  }
  snapshot=[];
  return {ok:true,restored:count};
 }
 chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(!message||typeof message!=="object"||!["HHBA_SCAN","HHBA_FILL","HHBA_UNDO","HHBA_FOCUS"].includes(message.type))return;
  try{
   const result=message.type==="HHBA_SCAN"?scan():message.type==="HHBA_FILL"?fill(message):message.type==="HHBA_FOCUS"?focus(message):undo();
   reply(result);
  }catch(e){reply({ok:false,error:e?.message||"网页处理失败"})}
  return true;
 });
})();
