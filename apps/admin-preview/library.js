// Original HHBA administrator console: employer resource library.
const dom=id=>document.getElementById(id);
const state={items:[],halls:[],hall:'all',term:'',page:0,editable:false,loaded:false};
const PAGE_SIZE=40,api='/admin-preview/api/library';
const button=(label,onClick,extra='')=>{
 const b=document.createElement('button');b.type='button';b.textContent=label;
 b.className=extra;b.addEventListener('click',onClick);return b;
};
const safeLink=(url)=>{
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}
};
const belongs=(x,id)=>x.industry_id===id||x.related_hall_ids?.includes(id);
const count=id=>state.items.filter(x=>belongs(x,id)).length;
const showMessage=(txt)=>{dom('library-message').textContent=txt;};
function selectHall(hall){
 state.hall=hall;state.page=0;render();
}
function filtered(){
 const q=state.term.toLocaleLowerCase('zh-CN').replace(/\s/g,'');
 return state.items.filter(x=>(state.hall==='all'||belongs(x,state.hall))&&
  (!q||[x.name,x.parent_name,...(x.aliases||[])].filter(Boolean)
   .some(s=>String(s).toLocaleLowerCase('zh-CN').replace(/\s/g,'').includes(q))));
}
function renderHalls(){
 const root=dom('library-halls');root.replaceChildren();
 root.append(button('全部企业 · '+state.items.length,()=>selectHall('all'),
  'library-hall'+(state.hall==='all'?' active':'')));
 for(const hall of state.halls)root.append(button(hall.name+' · '+count(hall.id),
  ()=>selectHall(hall.id),'library-hall'+(state.hall===hall.id?' active':'')));
}
function render(){
 renderHalls();
 const list=filtered(),rows=dom('library-rows');rows.replaceChildren();
 dom('library-result-count').textContent='找到 '+list.length+' 家企业 / 集团成员';
 const start=state.page*PAGE_SIZE;
 for(const e of list.slice(start,start+PAGE_SIZE)){
  const tr=document.createElement('tr');
  const name=document.createElement('td');
  const strong=document.createElement('strong');strong.textContent=e.name;name.append(strong);
  if(e.parent_name){const small=document.createElement('small');small.textContent='上级：'+e.parent_name+(e.relation?' · '+e.relation:'');name.append(small);}
  const type=document.createElement('td');type.textContent=[e.industry_id,...(e.related_hall_ids||[])]
   .map(id=>state.halls.find(h=>h.id===id)?.name||'待分类').join(' / ');
  const site=document.createElement('td');const verified=(e.portals||[]).filter(p=>p.status==='legacy_reviewed').length;
  const pending=(e.portals||[]).filter(p=>p.status==='collected_unverified').length;
  if(!e.portals?.length){const span=document.createElement('span');span.textContent='暂无企业独立招聘入口';span.className='library-muted';site.append(span);}
  else{
   for(const p of e.portals.slice(0,3)){
    const url=safeLink(p.url);
    if(!url){const note=document.createElement('small');note.textContent='非HTTPS来源 · 待复核';site.append(note);continue;}
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    const label=p.scope==='group_shared_candidate'?'集团共用线索':p.scope==='discovery_candidate'?'公告/检索线索':
     p.status==='legacy_reviewed'?'历史已审':'待复核线索';
    a.textContent=label+' · '+new URL(url).hostname;
    site.append(a);
   }
  }
  const status=document.createElement('td');status.textContent=verified?'历史已审 '+verified+(pending?' / 待复核 '+pending:''):
    pending?'待复核 '+pending:'仅集团关系';
  const action=document.createElement('td');
  if(state.editable)action.append(button('补充/修改',()=>editEmployer(e),'library-edit'));
  else action.textContent='只读';
  for(const td of [name,type,site,status,action])tr.append(td);
  rows.append(tr);
 }
 dom('library-pager').replaceChildren(
  button('上一页',()=>{state.page--;render()},'library-page'),
  document.createTextNode('第 '+(state.page+1)+' / '+Math.max(1,Math.ceil(list.length/PAGE_SIZE))+' 页'),
  button('下一页',()=>{state.page++;render()},'library-page'));
 const controls=dom('library-pager').querySelectorAll('button');
 controls[0].disabled=state.page<=0;
 controls[1].disabled=start+PAGE_SIZE>=list.length;
 dom('library-total').textContent=String(state.items.length);
 dom('library-portals').textContent=String(state.items.reduce((n,x)=>n+(x.portals?.length||0),0));
 dom('library-groups').textContent=String(state.items.filter(x=>x.parent_name).length);
 dom('library-review').textContent=String(state.items.reduce((n,x)=>n+(x.portals||[]).filter(p=>p.status==='collected_unverified').length,0));
 dom('library-write-state').textContent=state.editable?'管理员可修改 · 批量最多100家':
   '只读 · 未接通管理员数据库或未授权';
 dom('library-editor').hidden=!state.editable;
}
function editEmployer(e){
 dom('library-name').value=e.name;
 dom('library-hall-select').value=e.industry_id;
 dom('library-parent').value=e.parent_name||'';
 dom('library-url').value='';
 dom('library-editor').scrollIntoView({behavior:'smooth',block:'start'});
 showMessage('正在补充 '+e.name+'；不填写招聘网址可单独更新分类或集团归属。');
}
const dataSet=async()=>{
 const local=!['hhba.work','hhba-talent.pages.dev'].includes(location.hostname)&&
  !location.hostname.endsWith('.hhba-talent.pages.dev');
 const url=local?'/data/employer-library.json':api;
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 if(!r.ok)throw Error(r.status===403?'无管理员访问权限（Cloudflare Access）':'企业目录暂不可用 · HTTP '+r.status);
 const obj=await r.json();
 const loaded=local?obj:obj.ok?obj:null;
 if(!loaded||!Array.isArray(loaded.items)||loaded.halls?.length!==17)throw Error('企业目录格式不正确');
 state.items=loaded.items;state.halls=loaded.halls;state.editable=!local&&loaded.editable===true;state.loaded=true;
};
async function refresh(){
 showMessage('正在读取企业资源目录…');
 try{
  await dataSet();
  const options=dom('library-hall-select');
  options.replaceChildren();
  for(const h of state.halls){const o=document.createElement('option');o.value=h.id;o.textContent=h.name;options.append(o);}
  render();showMessage('已载入 '+state.items.length+' 家企业实体。历史审核不代表实时招聘状态。');
 }catch(e){showMessage(e.message||'读取失败');}
}
const textValue=id=>dom(id).value.trim();
function inputRow(){
 return {name:textValue('library-name'),industry_id:textValue('library-hall-select'),
  parent_name:textValue('library-parent'),portals:textValue('library-url')?[{url:textValue('library-url')}]:[]};
}
async function submit(items){
 if(!state.editable){showMessage('当前只读，未执行修改。');return}
 if(!items.length||items.length>100){showMessage('单次支持1至100家。');return}
 try{
  const r=await fetch(api,{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
  const payload=await r.json();
  if(!r.ok||!payload.ok)throw Error(payload.error||'保存失败');
  dom('library-url').value='';dom('library-bulk').value='';
  await refresh();showMessage('已保存 '+payload.imported+' 家；新链接标记待复核，不直接宣称为在招职位。');
 }catch(e){showMessage('保存失败：'+e.message);}
}
function submitBulk(){
 const lines=textValue('library-bulk').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines.length>100){showMessage('最多100行，请分批导入。');return}
 const byName=new Map(state.halls.map(h=>[h.name,h.id]));
 const rows=[];
 try{
  for(const [i,line] of lines.entries()){
   const parts=line.split(/\t|,|，/).map(s=>s.trim());
   if(parts.length<3||parts.length>4)throw Error('第'+(i+1)+'行格式错误');
   const [name,url,hall,parent_name='']=parts;
   const industry_id=byName.get(hall)|| (state.halls.some(h=>h.id===hall)?hall:null);
   if(!industry_id||!name)throw Error('第'+(i+1)+'行未填写有效企业名称和行业馆');
   rows.push({name,industry_id,parent_name,portals:url?[{url}]:[]});
  }
  if(!rows.length)throw Error('请先粘贴企业名单');
  void submit(rows);
 }catch(e){showMessage(e.message);}
}
dom('library-search').addEventListener('input',e=>{state.term=e.target.value;state.page=0;render()});
dom('library-save').addEventListener('click',()=>void submit([inputRow()]));
dom('library-import').addEventListener('click',submitBulk);
dom('library-reload').addEventListener('click',()=>void refresh());
window.HHBA_LIBRARY_OPEN=()=>{if(!state.loaded)void refresh()};
