// Original HHBA administrator console: employer resource library.
const dom=id=>document.getElementById(id);
const state={items:[],halls:[],hall:'all',term:'',status:'all',page:0,editable:false,loaded:false,coverage:null,brandIndex:[],stats:null};
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
 const matchingBrands=!q?[]:state.brandIndex.filter(b=>String(b.name||'').toLocaleLowerCase('zh-CN').includes(q));
 const relatedNames=new Set(matchingBrands.flatMap(b=>[b.parent_name,b.group_name]).filter(Boolean));
 return state.items.filter(x=>{
  if(state.hall!=='all'&&!belongs(x,state.hall))return false;
  const portals=x.portals||[];
  if(state.status==='missing'&&portals.length>0)return false;
  if(state.status==='pending'&&!portals.some(p=>p.status==='collected_unverified'))return false;
  if(state.status==='reviewed'&&!portals.some(p=>p.status==='legacy_reviewed'))return false;
  return !q||relatedNames.has(x.name)||[x.name,x.parent_name,...(x.aliases||[])].filter(Boolean)
   .some(s=>String(s).toLocaleLowerCase('zh-CN').replace(/\s/g,'').includes(q));
 });
}
function renderHalls(){
 const root=dom('library-halls');root.replaceChildren();
 const label=document.createElement('label');label.className='library-single-filter';
 label.textContent='行业分类';
 const select=document.createElement('select');
 select.id='library-hall-filter';select.setAttribute('aria-label','按行业筛选统一企业库');
 const options=[{id:'all',name:'全部行业（统一企业库）'},...state.halls];
 for(const hall of options){
  const option=document.createElement('option');option.value=hall.id;
  option.textContent=hall.name+' · '+(hall.id==='all'?state.items.length:count(hall.id))+' 家';
  option.selected=state.hall===hall.id;select.append(option);
 }
 select.addEventListener('change',()=>selectHall(select.value));
 label.append(select);root.append(label);
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
  if(e.parent_name){
   const small=document.createElement('small');small.textContent='上级：'+e.parent_name+(e.relation?' · '+e.relation:'');
   name.append(small);
   name.append(button('查看同集团',()=>{
    state.term=e.parent_name;dom('library-search').value=e.parent_name;
    selectHall('all');
   },'library-edit'));
  }
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
    pending?'待复核 '+pending:e.research_relationships?.length?'集团研究线索 · 待补招聘官网':'暂无独立招聘入口';
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
 const associations=state.items.reduce((n,x)=>n+(x.portals?.length||0),0);
 dom('library-portals').textContent=String(new Set(state.items.flatMap(x=>(x.portals||[]).map(p=>p.url))).size);
 dom('library-link-associations').textContent=associations+' 条企业-网址关联';
 const withPortal=state.items.filter(x=>(x.portals||[]).some(p=>safeLink(p.url))).length;
 const withoutPortal=state.items.length-withPortal;
 dom('library-missing-portals').textContent=String(withoutPortal);
 dom('library-coverage-note').textContent=withPortal+' 家有网址 / '+withoutPortal+' 家缺网址';
 dom('library-review').textContent=String(state.items.reduce((n,x)=>n+(x.portals||[]).filter(p=>p.status==='collected_unverified').length,0));
 const coverage=state.coverage;
 const research=state.stats?.automotive_research_nodes;
 const researchNote=research?' · 另有汽车集团研究节点 '+research+' 条（品牌 '+state.brandIndex.length+' 个，不按企业计）':'';
 dom('library-collection-status').textContent=coverage?
  '历史聊天收集清单：'+coverage.target_total.toLocaleString('zh-CN')+
  ' 条 · 已完整导入原始批次 '+coverage.imported_batch_records.toLocaleString('zh-CN')+
  ' 条 · 待补录 '+coverage.unimported_batch_records.toLocaleString('zh-CN')+
  ' 条原始记录未恢复。注意：记录数量不是网址数量；当前 '+withoutPortal+' 家候选企业没有招聘网址。'+researchNote:
  '历史批次导入进度暂不可用；不将当前企业数量冒充全部收集记录。';
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
 const url=local?(location.hostname.endsWith('.github.io')?'/hhba-talent/data/employer-library.json':'/data/employer-library.json'):api;
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 if(!r.ok)throw Error(r.status===403?'无管理员访问权限（Cloudflare Access）':'企业目录暂不可用 · HTTP '+r.status);
 const obj=await r.json();
 const loaded=local?obj:obj.ok?obj:null;
 if(!loaded||!Array.isArray(loaded.items)||loaded.halls?.length!==17)throw Error('企业目录格式不正确');
 state.items=loaded.items;state.halls=loaded.halls;
 state.coverage=loaded.collection_coverage||null;
 state.brandIndex=loaded.brand_index||loaded.research_brand_index||[];
 state.stats=loaded.stats||loaded.statistics||null;
 state.editable=!local&&loaded.editable===true;state.loaded=true;
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
   // Historical chat batches often only contain numbered company names.
   // Never invent an official URL just to accept a name-only import.
   if(parts.length===1){
    if(state.hall==='all')throw Error('仅粘贴企业名称时，请先选择左侧对应行业馆');
    const name=parts[0].replace(/^\d{1,4}\s*[.．、)）]\s*/,'').trim();
    if(name.length<2)throw Error('第'+(i+1)+'行企业名称无效');
    rows.push({name,industry_id:state.hall,portals:[]});
    continue;
   }
   if(parts.length<3||parts.length>4)throw Error('第'+(i+1)+'行格式错误');
   const [name,url,hall,parent_name='']=parts;
   const industry_id=byName.get(hall)|| (state.halls.some(h=>h.id===hall)?hall:null);
   if(!industry_id||!name)throw Error('第'+(i+1)+'行未填写有效企业名称和行业馆');
   rows.push({name,industry_id,parent_name,portals:url?[{url}]:[]});
  }
  if(!rows.length)throw Error('请先粘贴企业名单');
  // Duplicated entries in the same pasted chat batch merge locally rather
  // than rejecting all 100 lines or overwriting a verified prior portal.
  const byEntity=new Map();
  for(const row of rows){
   const id=row.name.normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();
   const old=byEntity.get(id);
   if(!old){byEntity.set(id,row);continue;}
   old.related_hall_ids=[...new Set([...(old.related_hall_ids||[]),
    ...(row.related_hall_ids||[]),row.industry_id])]
    .filter(h=>h!==old.industry_id);
   for(const p of row.portals||[])
    if(!old.portals.some(x=>x.url===p.url))old.portals.push(p);
  }
  void submit([...byEntity.values()]);
 }catch(e){showMessage(e.message);}
}
dom('library-search').addEventListener('input',e=>{state.term=e.target.value;state.page=0;render()});
dom('library-source-filter').addEventListener('change',e=>{state.status=e.target.value;state.page=0;render()});
dom('library-save').addEventListener('click',()=>void submit([inputRow()]));
dom('library-import').addEventListener('click',submitBulk);
dom('library-reload').addEventListener('click',()=>void refresh());
window.HHBA_LIBRARY_OPEN=()=>{if(!state.loaded)void refresh()};
