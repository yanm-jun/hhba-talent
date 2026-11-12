const el=id=>document.getElementById(id);
const screen=document.body?.dataset.adminScreen||'login';
const message=(s,ok=false)=>{const n=el('admin-message');if(n){n.textContent=s;n.className='status'+(ok?' ok':'')}};
const errors={
 LOGIN_INVALID:'账号或密码不正确。',LOGIN_RATE_LIMITED:'密码错误次数过多，请 15 分钟后再尝试。',
 SETUP_REQUIRED:'管理员密码尚未初始化。请使用一次性设置链接。',
 SETUP_LINK_EXPIRED:'一次性设置链接已经过期，请重新生成。',
 SETUP_NOT_AUTHORIZED:'设置链接无效，请使用最新的管理员设置链接。',
 INVALID_SETUP_INPUT:'密码需要至少 14 位，且不能使用过于简单的密码。',
 ADMIN_ALREADY_CONFIGURED:'密码已设置，请返回登录页面。',
 D1_DAILY_LIMIT_REACHED:'Cloudflare 数据库今日额度已满，密码尚未设置成功。请在额度恢复后重试。',
 INVALID_NEW_PASSWORD:'新密码格式不符合安全要求。',ADMIN_AUTH_SERVICE_UNAVAILABLE:'验证服务暂时不可用，请稍后再试。',
 ADMIN_HOST_NOT_CONFIGURED:'管理员独立域名尚未配置完成。',INVALID_ORIGIN:'请求没有通过安全验证，请刷新页面。'
};
function parseError(e){return errors[e?.error]||'请求未完成，请检查网络后重试。'}
async function call(action,body){
 const response=await fetch('/api/console-auth/'+action,{method:'POST',credentials:'same-origin',
  cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw data;return data;
}
for(const button of document.querySelectorAll('[data-toggle-password]')){
 button.addEventListener('click',()=>{
  const input=el(button.dataset.togglePassword),show=input.type==='password';
  input.type=show?'text':'password';button.textContent=show?'隐藏':'显示';
 });
}
const form=el('admin-'+screen+'-form'),button=el('admin-submit');
if(screen==='login'){
 fetch('/api/console-auth/status',{credentials:'same-origin',cache:'no-store'})
  .then(r=>r.json()).then(x=>{
   if(x.authenticated)location.replace('/admin-preview/');
   if(x.ok&&!x.configured)message('首次使用请通过专属一次性链接设置管理员密码。');
  }).catch(()=>{});
 form.addEventListener('submit',async e=>{
  e.preventDefault();button.disabled=true;message('');
  try{
   await call('login',{username:el('admin-username').value,password:el('admin-password').value});
   message('登录成功，正在进入后台……',true);location.replace('/admin-preview/');
  }catch(e){message(parseError(e));button.disabled=false}
 });
}else{
 const setupToken=(location.hash||'').replace(/^#/,'').trim();
 // Fragment never goes into HTTP request lines or Referrer headers.
 if(setupToken)history.replaceState(null,'','/setup/');
 if(!/^[a-zA-Z0-9_-]{43}$/.test(setupToken)){
  message('缺少有效的一次性设置凭证，请使用提供给你的完整安全设置链接。');
  button.disabled=true;
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(button.disabled)return;
  const pwd=el('admin-password').value,confirm=el('admin-confirm').value;
  if(pwd!==confirm){message('两次输入的密码不一致。');return}
  button.disabled=true;message('');
  try{
   await call('setup',{token:setupToken,password:pwd});
   message('管理员密码设置成功，正在进入后台……',true);
   el('admin-password').value='';el('admin-confirm').value='';
   location.replace('/admin-preview/');
  }catch(e){message(parseError(e));button.disabled=false}
 });
}
