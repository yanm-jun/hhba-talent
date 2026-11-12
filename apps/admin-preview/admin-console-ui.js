// Password-only console controls. Inert everywhere except admin.hhba.work.
if(location.hostname==='admin.hhba.work'){
 const ready=()=>{
  const actions=document.querySelector('.top-actions');
  if(!actions)return;
  const style=document.createElement('style');
  style.textContent='.hhba-sec-btn{border:1px solid #dce8df;background:#fff;color:#37634b;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px;font-weight:650}.hhba-sec-btn:hover{background:#eff7f1}.hhba-sec-dialog{width:min(450px,calc(100vw - 28px));padding:25px;border:0;border-radius:14px;box-shadow:0 20px 65px #0018}.hhba-sec-dialog::backdrop{background:#091e1a88}.hhba-sec-dialog label{font-size:12px;color:#547362;display:block;margin:12px 0 5px}.hhba-sec-dialog input{display:block;width:100%;padding:11px;border:1px solid #c9d9cd;border-radius:8px}.hhba-sec-dialog form{display:flex;flex-direction:column;gap:5px}.hhba-sec-dialog .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.hhba-sec-dialog p{font-size:12px;line-height:1.7}.hhba-sec-btn.primary{background:#216144;color:#fff;border-color:#216144}@media(max-width:600px){.hhba-sec-btn{padding:6px;font-size:11px}}';
  document.head.append(style);
  const button=(label,click)=>{const b=document.createElement('button');b.type='button';b.className='hhba-sec-btn';b.textContent=label;b.addEventListener('click',click);return b};
  const request=async(path,data)=>{
   const r=await fetch('/api/console-auth/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data||{})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'SERVER_UNAVAILABLE');return j;
  };
  const dialog=document.createElement('dialog');dialog.className='hhba-sec-dialog';
  const title=document.createElement('h3');title.textContent='修改管理员密码';
  const form=document.createElement('form');form.method='dialog';
  const add=(text,type,min)=>{const label=document.createElement('label');label.textContent=text;const input=document.createElement('input');input.type=type;input.required=true;if(min)input.minLength=min;input.maxLength=128;label.append(input);form.append(label);return input};
  const old=add('当前密码','password',14),fresh=add('新密码（至少 14 位）','password',14),confirm=add('确认新密码','password',14);
  const status=document.createElement('p');status.setAttribute('role','status');
  const row=document.createElement('div');row.className='actions';
  const cancel=button('取消',()=>dialog.close());
  const submit=document.createElement('button');submit.className='hhba-sec-btn primary';submit.type='submit';submit.textContent='保存新密码';
  row.append(cancel,submit);form.append(status,row);dialog.append(title,form);document.body.append(dialog);
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(fresh.value!==confirm.value){status.textContent='两次新密码不一致';return}
   submit.disabled=true;status.textContent='';
   try{
    await request('change',{password:old.value,newPassword:fresh.value});
    old.value='';fresh.value='';confirm.value='';
    status.textContent='密码已修改，其他登录会话已失效。';setTimeout(()=>dialog.close(),700);
   }catch(e){status.textContent=e.message==='LOGIN_INVALID'?'当前密码不正确。':'修改失败：'+e.message}
   finally{submit.disabled=false}
  });
  actions.prepend(button('修改密码',()=>dialog.showModal()));
  actions.prepend(button('退出登录',async()=>{
   if(!confirm('确认退出 HHBA 管理后台？'))return;
   try{await request('logout',{})}catch{/* best-effort clear cookie on server */}
   location.replace('/login/');
  }));
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
}
