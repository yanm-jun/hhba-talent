// HHBA enterprise recruitment library. All values are live, protected D1 responses.
// The standalone localhost preview deliberately shows unavailable (never demo counts).
const LIB_API='/admin-preview/api/library';
// Read-only LAST VERIFIED production counters from 2026-11-12.
// Used ONLY on the isolated library preview when D1 returns quota error.
// Never represent these as live, and never invent employer-detail records.
const LIB_VERIFIED_SNAPSHOT={
 kind:'HHBA_RECRUITMENT_LIBRARY_V1',mode:'snapshot',asOf:'2026-11-12',
 total:{records:5288,linked:2573,unique_urls:1900,missing:2715},
 industries:[
  ['automotive',318,0],['semiconductor',278,0],['internet-ai',342,142],
  ['energy',299,0],['manufacturing',113,366],['finance',163,66],
  ['telecom',42,95],['biomed',54,275],['aerospace',20,298],
  ['logistics',42,286],['construction',24,194],
  ['consumer-hardware',76,171],['chem-materials',28,183],
  ['retail',70,182],['agri-food',34,187],
  ['culture-media',56,181],['education-research',13,89]
 ].map(([id,unique_urls,missing])=>({id,unique_urls,missing}))
};
function libIsDesignPreview(){
 return location.hostname==='admin.hhba.work'||
  location.hostname==='feat-admin-recruitment-libra.hhba-talent.pages.dev'||
  /^([a-f0-9]{8})\.hhba-talent\.pages\.dev$/.test(location.hostname);
}

const LIB_HALLS=[
 ['automotive','汽车馆','🚗'],['semiconductor','电子半导体馆','💻'],['internet-ai','互联网与AI馆','🧠'],
 ['energy','能源电力馆','⚡'],['manufacturing','智能制造馆','🏭'],['finance','金融馆','🏦'],
 ['telecom','通信馆','📡'],['biomed','医药生物馆','🧬'],['aerospace','航空航天馆','🚀'],
 ['logistics','交通物流馆','🚚'],['construction','建筑工程馆','🏗️'],
 ['consumer-hardware','家电与智能硬件馆','📱'],['chem-materials','化工新材料馆','🧪'],
 ['retail','商贸零售馆','🛒'],['agri-food','农业食品馆','🌾'],
 ['culture-media','文化传媒馆','🎬'],['education-research','教育科研馆','📚']
];
const libEl=id=>document.getElementById(id);
const libFmt=new Intl.NumberFormat('zh-CN');
const libState={started:false,summary:null,industry:null,page:1,hasMore:false,
 rows:[],controller:null,dirty:false,lastListError:null,total:null,archived:false};
function libCount(v){return Number.isSafeInteger(v)&&v>=0?libFmt.format(v):'—'}
function libMessage(text,tone=''){const e=libEl('lib-message');e.textContent=text;e.dataset.tone=tone}
function libErrorMessage(status,body){
 if(body?.error==='D1_DAILY_LIMIT_REACHED')return 'Cloudflare D1 今日读取额度已满。数据未改动，请额度恢复后再刷新。';
 if(body?.error==='LIBRARY_PREVIEW_READ_ONLY')return '当前为正式库只读预览，Excel 导入与修改将在完成数据库迁移及正式发布后开放。';
 if(status===401||status===403)return '请通过 Cloudflare Access 管理员验证后打开此资源库。';
 if(body?.error==='LIBRARY_DATABASE_NOT_CONNECTED')return '数据库尚未绑定到本预览环境，不能读取生产资料。';
 if(status===404)return '当前是独立静态预览，尚未连接受保护的资源库接口。';
 const code=body?.error;
 if(code==='DUPLICATE_IN_INDUSTRY')return '该行业馆已存在相同招聘网址，未重复添加。';
 if(code==='LIBRARY_DATABASE_UNAVAILABLE')return '数据库暂不可用；修改未能确认，请核对后重试。';
 if(code==='INVALID_LIBRARY_RECORD')return '企业名称、行业馆或 HTTPS 招聘网址格式不正确。';
 if(code==='LIBRARY_RECORD_NOT_FOUND')return '这条记录已被更新或删除，请刷新列表。';
 if(code==='MUTATION_ORIGIN_DENIED')return '请求未通过同源安全验证，不能修改资源库。';
 return '资源库请求失败（'+(code||status||'未知')+'），没有使用模拟数据。';
}
async function libRequest(params,init={}){
 const url=new URL(LIB_API,location.origin);
 for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(init.headers||{})},...init});
 const type=r.headers.get('content-type')||'';
 let body=null;
 if(type.includes('application/json')){try{body=await r.json()}catch{/* unreadable response */}}
 if(!r.ok||body?.kind!=='HHBA_RECRUITMENT_LIBRARY_V1')throw {status:r.status,body};
 return body;
}
function libButton(text,fn,cls='button-outline'){
 const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',fn);return b;
}
function libCell(tr,value){
 const td=document.createElement('td');td.textContent=value||'—';tr.append(td);return td;
}
function libStatus(row){
 if(row.status==='missing')return ['缺网址','missing'];
 if(row.status==='verified')return ['管理员确认','verified'];
 if(row.status==='previously_verified')return ['历史核实','historical'];
 return ['待复核','candidate'];
}
function libRenderSummary(){
 const s=libState.summary;
 const readOnly=s?.mode==='snapshot'||s?.readonly===true;
 libEl('lib-upload-all').disabled=readOnly;
 libEl('lib-upload-all').title=readOnly?'当前是只读快照／正式库只读预览；暂不可写入企业数据':'上传 Excel 或 CSV 文件';
 for(const [id,v] of [['lib-total-urls',s?.total?.unique_urls],['lib-total-rows',s?.total?.records],
  ['lib-total-linked',s?.total?.linked],['lib-total-missing',s?.total?.missing]])libEl(id).textContent=libCount(v);
 const root=libEl('lib-halls');root.replaceChildren();
 for(const [id,name,emoji] of LIB_HALLS){
  const data=s?.industries?.find(x=>x.id===id),btn=document.createElement('button');
  btn.type='button';btn.className='lib-hall'+(libState.industry===id?' selected':'');
  btn.setAttribute('aria-pressed',String(libState.industry===id));
  const head=document.createElement('div');head.className='lib-hall-head';
  const badge=document.createElement('span');badge.className='lib-hall-icon';badge.textContent=emoji;
  const label=document.createElement('strong');label.textContent=name;
  head.append(badge,label);
  const value=document.createElement('span');value.className='lib-hall-count';value.textContent=libCount(data?.unique_urls);
  const foot=document.createElement('span');foot.className='lib-hall-foot';
  foot.textContent=data?'个去重网址 · 待补 '+libCount(data.missing)+' 条':'待连接数据';
  btn.append(head,value,foot);btn.addEventListener('click',()=>{void libSelect(id)});
  root.append(btn);
 }
 if(s?.mode==='snapshot'){
  libEl('lib-updated').textContent='历史数量快照 · 截至 2026-11-12（非实时）';
 }else if(s?.archived){
  libEl('lib-updated').textContent='真实企业目录快照 · '+new Date(s.asOf).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京，非实时）';
 }else if(s?.asOf){
  libEl('lib-updated').textContent='实时查询：'+new Date(s.asOf).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京）';
 }else libEl('lib-updated').textContent='尚未连接';
}
async function libRefreshSummary(force=false){
 if(libState.summary&&!force){libRenderSummary();return}
 libMessage('正在读取各行业馆真实数量…');
 try{
  const result=await libRequest({mode:'summary'});
  libState.summary=result;libRenderSummary();
  if(result.archived){
   libMessage('已加载正式数据库导出的 5,288 条企业记录（只读快照）。点击任意行业馆进入企业与招聘网址目录，可搜索、分页和打开原始链接；这不是实时岗位状态。');
  }else{
   libMessage(result.readonly?
    '正式生产库只读预览：现在展示真实企业数量与资料目录。为保护正式数据，新增、修改和 Excel 导入在预览中暂不开放。':
    '已从受保护数据库读取行业统计。各馆去重数相加不等于全库去重数。','ok');
  }
 }catch(e){
  if(e.body?.error==='D1_DAILY_LIMIT_REACHED'&&libIsDesignPreview()){
   libState.summary=LIB_VERIFIED_SNAPSHOT;libRenderSummary();
   libMessage('Cloudflare D1 今日读取额度已满。这里显示 2026-11-12 最后核实的生产库统计快照（非实时）；企业明细和写入暂不可用，正式数据未清空。','error');
   return;
  }
  libState.summary=null;libRenderSummary();libMessage(libErrorMessage(e.status,e.body),'error');
 }
}
async function libSelect(industry){
 if(!LIB_HALLS.some(x=>x[0]===industry))return;
 libState.industry=industry;libState.page=1;libState.total=null;
 // A shelf opens as a real directory view, not a section hidden below 17 cards.
 libEl('lib-halls').hidden=true;
 libEl('lib-board-top').hidden=true;
 libEl('lib-entry-panel').hidden=false;
 libEl('lib-query').value='';libEl('lib-filter').value='all';
 libEl('lib-entry-panel').hidden=false;
 libEl('lib-current-hall').textContent=LIB_HALLS.find(x=>x[0]===industry)[1];
 const offline=libState.summary?.mode==='snapshot';
 const readOnly=offline||libState.summary?.readonly===true;
 libEl('lib-add').disabled=readOnly;libEl('lib-import').disabled=readOnly;
 libRenderSummary();
 libEl('lib-entry-panel').scrollIntoView({behavior:'smooth',block:'start'});
 if(offline){
  libState.rows=[];libState.hasMore=false;libState.lastListError='数据库限额已满，当前仅能查看截至 2026-11-12 的行业数量快照。企业名称和网址明细无法读取，并非没有企业。';
  libRenderRows();
  libMessage('当前显示历史数量快照；企业明细、搜索与修改必须在 D1 额度恢复后从真实数据库读取。','error');
  return;
 }
 await libFetchList();
}
async function libFetchList(){
 if(!libState.industry)return;
 if(libState.summary?.mode==='snapshot'){
  libState.rows=[];libState.hasMore=false;
  libState.lastListError='Cloudflare D1 暂不可读取企业明细。本馆数字为历史快照，不是空馆。';
  libRenderRows();return;
 }
 libState.controller?.abort();
 const controller=new AbortController();libState.controller=controller;
 const tbody=libEl('lib-rows');tbody.replaceChildren();
 const waiting=document.createElement('tr');libCell(waiting,'正在加载…').colSpan=5;tbody.append(waiting);
 libEl('lib-list-status').textContent='读取第 '+libState.page+' 页…';
 try{
  const data=await libRequest({mode:'list',industry:libState.industry,page:libState.page,
   status:libEl('lib-filter').value,q:libEl('lib-query').value.trim()},
   {signal:controller.signal});
  if(libState.controller!==controller)return;
  libState.rows=data.rows;libState.hasMore=data.hasMore;
  libState.total=Number.isSafeInteger(data.total)?data.total:null;
  libState.archived=data.archived===true;
  libState.lastListError=null;libRenderRows();
  libMessage(data.archived?
   '正在查看真实企业招聘资料的历史快照；每页 25 条，可查找企业与打开招聘网址，不消耗 D1 今日读取额度。':
   '列表已更新，每页最多 25 条，不进行整库下载。');
 }catch(e){
  if(controller.signal.aborted)return;
  libState.rows=[];libState.hasMore=false;libState.total=null;
  libState.lastListError=libErrorMessage(e.status,e.body);
  libRenderRows();libMessage(libState.lastListError,'error');
 }
}
function libRenderRows(){
 const root=libEl('lib-rows');root.replaceChildren();
 for(const record of libState.rows){
  const tr=document.createElement('tr');
  const company=libCell(tr,record.enterprise);company.className='lib-company';
  const urlCell=document.createElement('td');
  let safeUrl=null;
  if(record.recruitment_url){
   try{const candidate=new URL(record.recruitment_url);if(candidate.protocol==='https:'&&!candidate.username&&!candidate.password)safeUrl=candidate.href}catch{/* keep unsafe values non-clickable */}
  }
  if(safeUrl){
   const a=document.createElement('a');a.href=safeUrl;a.target='_blank';a.rel='noopener noreferrer';
   a.textContent=record.recruitment_url;a.title=record.recruitment_url;urlCell.append(a);
  }else urlCell.textContent=record.recruitment_url||'尚未补录';
  urlCell.className='lib-url';tr.append(urlCell);
  const s=libStatus(record),td=document.createElement('td');const tag=document.createElement('span');
  tag.className='lib-tag '+s[1];tag.textContent=s[0];td.append(tag);tr.append(td);
  const src=libCell(tr,record.source_batch||record.source_kind||'—');src.className='lib-source';src.title=record.source_kind||'';
  const actions=document.createElement('td');actions.className='lib-actions';
  const edit=libButton('编辑',()=>libEdit(record));
  const del=libButton('删除',()=>{void libRemove(record)},'lib-danger');
  edit.disabled=libState.summary?.readonly===true;del.disabled=edit.disabled;
  actions.append(edit,del);
  tr.append(actions);root.append(tr);
 }
 if(!libState.rows.length){const tr=document.createElement('tr'),td=document.createElement('td');
  td.colSpan=5;td.className='lib-empty';td.textContent=libState.lastListError||'当前筛选条件下没有记录，请更改筛选条件。';tr.append(td);root.append(tr)}
 libEl('lib-list-status').textContent=libState.lastListError?
  '查询不可用 · 未返回企业明细':
  (libState.total!==null?'共 '+libFmt.format(libState.total)+' 条 · ':'')+
  '第 '+libState.page+' 页 · 本页 '+libState.rows.length+' 条'+(libState.hasMore?' · 还有下一页':'');
 libEl('lib-prev').disabled=libState.page<=1;
 libEl('lib-next').disabled=!libState.hasMore;
}
function libModal(record=null){
 const dialog=libEl('lib-edit-dialog'),form=libEl('lib-edit-form');
 form.reset();libEl('lib-key').value=record?.source_key||'';
 libEl('lib-edit-title').textContent=record?'编辑企业招聘入口':'新增企业招聘入口';
 libEl('lib-name').value=record?.enterprise||'';
 libEl('lib-url').value=record?.recruitment_url||'';
 libEl('lib-industry').value=record?.industry_id||libState.industry;
 libEl('lib-verified').checked=record?.status==='verified';
 libEl('lib-edit-error').textContent='';dialog.showModal();
}
function libEdit(record){libModal(record)}
async function libMutate(method,payload){
 const result=await libRequest({}, {method,headers:{'Content-Type':'application/json','x-hhba-library-request':'1'},
  body:JSON.stringify(payload)});
 libState.summary=null;await libRefreshSummary(true);await libFetchList();return result;
}
async function libRemove(record){
 if(!confirm('确认永久删除「'+record.enterprise+'」的这条招聘网址记录？此操作会记录管理员审计日志。'))return;
 try{await libMutate('DELETE',{source_key:record.source_key,confirm:'DELETE'});
  libMessage('已删除该条记录并写入审计日志。','ok');
 }catch(e){libMessage(libErrorMessage(e.status,e.body),'error')}
}
function libBackToHalls(){
 libState.controller?.abort();
 libState.industry=null;
 libEl('lib-entry-panel').hidden=true;
 libEl('lib-halls').hidden=false;
 libEl('lib-board-top').hidden=false;
 libRenderSummary();
 libEl('lib-board-top').scrollIntoView({behavior:'smooth',block:'start'});
}
function libInit(){
 if(libState.started)return;libState.started=true;
 const industrySelect=libEl('lib-industry');
 for(const [id,name] of LIB_HALLS){const opt=document.createElement('option');opt.value=id;opt.textContent=name;industrySelect.append(opt)}
 libEl('lib-back-halls').addEventListener('click',libBackToHalls);
 libEl('lib-refresh').addEventListener('click',async()=>{await libRefreshSummary(true);if(libState.industry)await libFetchList()});
 libEl('lib-search-form').addEventListener('submit',e=>{e.preventDefault();libState.page=1;void libFetchList()});
 libEl('lib-filter').addEventListener('change',()=>{libState.page=1;void libFetchList()});
 libEl('lib-prev').addEventListener('click',()=>{if(libState.page>1){libState.page--;void libFetchList()}});
 libEl('lib-next').addEventListener('click',()=>{if(libState.hasMore){libState.page++;void libFetchList()}});
 libEl('lib-add').addEventListener('click',()=>libModal());
 libEl('lib-import').addEventListener('click',()=>window.hhbaImport?.open(libState.industry));
 libEl('lib-upload-all').addEventListener('click',()=>window.hhbaImport?.open(''));
 for(const id of ['lib-edit-close','lib-edit-cancel'])libEl(id).addEventListener('click',()=>libEl('lib-edit-dialog').close());

 libEl('lib-edit-form').addEventListener('submit',async e=>{
  e.preventDefault();const key=libEl('lib-key').value;
  const row={industry_id:libEl('lib-industry').value,enterprise:libEl('lib-name').value.trim(),
   recruitment_url:libEl('lib-url').value.trim(),verified:libEl('lib-verified').checked};
  const btn=libEl('lib-save');btn.disabled=true;libEl('lib-edit-error').textContent='';
  try{
   await libMutate(key?'PATCH':'POST',key?{source_key:key,row}:{action:'add',row});
   libEl('lib-edit-dialog').close();libMessage(key?'已保存修改并记录审计。':'已新增招聘入口并记录审计。','ok');
  }catch(err){libEl('lib-edit-error').textContent=libErrorMessage(err.status,err.body)}
  finally{btn.disabled=false}
 });

}
window.hhbaLibrary={open(){libInit();void libRefreshSummary()},async refresh(){await libRefreshSummary(true);if(libState.industry)await libFetchList()}};
