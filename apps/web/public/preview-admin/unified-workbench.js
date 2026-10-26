// HHBA unified management workbench.
// Enhances the EXISTING authenticated /management/ shell. This is a read-only
// integration surface until tenant-aware admin service and RBAC are available.
const groups=[
 {heading:'招聘与企业',items:[['recruitment','招聘业务'],['response','招聘履约'],['enterprise','企业档案']]},
 {heading:'企业信誉治理',items:[['inbox','审核待办'],['evidence','证据核验'],['care','员工关怀'],['scoring','双评分'],['appeals','申诉复核'],['improvements','真实改善'],['publication','公开发布']]},
 {heading:'企业发展帮扶',items:[['aid','帮扶审批'],['commercial','客户合作']]}
];
export const workspaceViews=Object.freeze({
 recruitment:'招聘业务',response:'招聘履约管理',enterprise:'企业档案',inbox:'审核待办',
 evidence:'证据核验',care:'员工关怀',scoring:'双评分审核',
 appeals:'申诉复核',improvements:'企业改善核验',publication:'公开评分审批',
 aid:'企业帮扶审批',commercial:'客户对接与订单核验'
});
const tasks=[
 {key:'response',title:'招聘责任核查',text:'站内申请送达、处理期限、回应结果和逾期核实'},
 {key:'evidence',title:'企业证据核验',text:'资料有效性、安全扫描与独立审查'},
 {key:'care',title:'员工反馈保护',text:'员工关系核验、隐私聚合与独立处理'},
 {key:'scoring',title:'企业双评分审核',text:'信誉值和善待值的候选结果审查'},
 {key:'appeals',title:'企业与员工申诉',text:'证据异议、身份保护和审查回避'},
 {key:'improvements',title:'真实改善核验',text:'逐条核实已经实施的改善措施'},
 {key:'publication',title:'版本发布审批',text:'两人独立签批、撤销和版本追溯'},
 {key:'aid',title:'企业发展帮扶审批',text:'资格、经营证据与交付能力'},
 {key:'commercial',title:'客户同意和订单核验',text:'买方同意、商机阶段与真实凭证'}
];
const byId=id=>document.getElementById(id);
const state={catalog:null,loading:false,loaded:false,error:null};
function text(tag,cls,value){
 const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=value;return node;
}
function button(label,view,open){
 const el=document.createElement('button');el.type='button';el.className='uw-entry';
 el.append(text('span','uw-entry-label',label),text('span','uw-entry-arrow','›'));
 el.addEventListener('click',()=>open(view));
 return el;
}
function blank(label){return text('span','uw-number',label);}
function statusRow(title,description,open,key){
 const line=document.createElement('div');line.className='uw-task-row';
 const content=document.createElement('div');content.className='uw-task-description';
 content.append(text('strong','',title),text('p','',description));
 const aside=document.createElement('div');aside.className='uw-task-aside';
 aside.append(blank('—'),text('small','','业务数据未接入'));
 const action=button('查看工作区',key,open);action.classList.add('uw-small-action');
 line.append(content,aside,action);return line;
}
function buildView(key,title){
 const section=document.createElement('section');section.className='page-view uw-view';section.hidden=true;
 section.id='view-'+key;section.setAttribute('aria-labelledby','uw-title-'+key);
 const head=document.createElement('header');head.className='page-heading uw-heading';
 const intro=document.createElement('div');
 intro.append(text('p','eyebrow','HHBA · 统一管理后台'),text('h1','',title),text('p','page-subtitle','公开静态界面预览 · 暂无真实企业业务接口'));
 intro.querySelector('h1').id='uw-title-'+key;head.append(intro);
 const root=document.createElement('div');root.className='uw-content';root.id='uw-content-'+key;
 section.append(head,root);return section;
}
function addNav(open){
 const sidebar=document.querySelector('.nav-area');
 const firstSecondary=sidebar?.querySelector('.nav-caption-secondary');
 if(!sidebar||!firstSecondary)return;
 for(const group of groups){
  const caption=text('p','nav-caption nav-caption-secondary',group.heading);
  sidebar.insertBefore(caption,firstSecondary);
  for(const [key,label] of group.items){
   const node=document.createElement('button');node.type='button';node.className='nav-link';
   node.dataset.view=key;node.append(text('span','uw-nav-marker','▦'),document.createTextNode(' '+label));
   sidebar.insertBefore(node,firstSecondary);
   // Existing dashboard.js handles all .nav-link clicks consistently.
  }
 }
 const list=byId('content');
 if(list)for(const [key,value] of Object.entries(workspaceViews))list.append(buildView(key,value));
}
function card(title,subtitle){
 const n=document.createElement('article');n.className='panel uw-panel';
 n.append(text('h2','',title),text('p','uw-muted',subtitle));return n;
}
function disconnectedBanner(){
 const n=document.createElement('div');n.className='uw-callout';
 n.append(text('strong','','独立企业业务服务尚未接入原后台'),
  text('p','','第 05—12 模块已有隔离开发代码，但其业务数据库、组织级权限及独立审核员认证尚未挂载到本管理服务。当前只显示真实连接状态，不生成模拟企业、审核数量或订单。'));
 return n;
}
function metric(title){
 const n=document.createElement('article');n.className='uw-metric';
 n.append(text('small','',title),text('strong','','—'),text('span','','尚无可核实的数据源'));return n;
}
function auditNotice(){
 const n=text('p','uw-caution','审核操作必须由有独立权限的服务器账号完成。此处仅展示安全整合入口；原单一管理员密码不具备企业级审核角色分离能力。');
 return n;
}
function render(key,open){
 const root=byId('uw-content-'+key);
 if(!root)return;
 root.replaceChildren();
 if(key==='recruitment'){
  const heading=card('招聘运营与企业规模','继续使用原管理后台真实岗位快照与同意采集的访问统计，不将岗位索引数认作实际签约客户。');
  heading.append(button('查看现有岗位数据', 'overview',open),button('访问与收藏分析','users',open));
  root.append(heading);
  const metrics=document.createElement('div');metrics.className='uw-metrics';
  for(const title of ['企业注册与认证','招聘岗位待审核','真实在招企业','人才授权检索'])metrics.append(metric(title));
  root.append(metrics,disconnectedBanner());return;
 }
 if(key==='inbox'){
  const panel=card('统一审核待办','各模块进入同一待办入口，但敏感审核队列需要后端按实际角色过滤。没有接口时不能将「零任务」作为事实。');
  const lines=document.createElement('div');lines.className='uw-task-list';
  for(const t of tasks)lines.append(statusRow(t.title,t.text,open,t.key));
  panel.append(lines);root.append(disconnectedBanner(),panel,auditNotice());return;
 }
 if(key==='enterprise'){
  const profile=card('统一企业档案','将同一已认证企业的招聘、证明、员工关怀、信誉、申诉和帮扶记录放进一张企业工作档案，但仅在真实企业列表与企业级授权查询可用后才显示个人或商业资料。');
  const ident=document.createElement('div');ident.className='uw-company-head';
  ident.append(text('span','uw-avatar','企'),text('strong','','企业名称：待接入真实组织数据'),text('span','uw-state','认证状态：未知'));
  profile.append(ident);
  const chips=document.createElement('div');chips.className='uw-grid-actions';
  for(const key of ['recruitment','evidence','care','scoring','appeals','improvements','aid','commercial'])
   chips.append(button(workspaceViews[key],key,open));
  profile.append(chips);root.append(disconnectedBanner(),profile,auditNotice());return;
 }
 const definition=tasks.find(t=>t.key===key);
 const custom={
 evidence:['资料安全与核验','第 05 模块：材料原件、初审意见、审核回避和有效期。'],
 care:['员工关怀与隐私','第 06 模块：员工身份分离、反馈保护、季度人数门槛。'],
 scoring:['双评分候选值','第 07 模块：评分依据、内部重算记录和失效状态。'],
 appeals:['独立申诉与纠正','第 08 模块：材料与流程异议、员工隐私、冲突回避。'],
 improvements:['企业真实改善','第 09 模块：已核实的改善事实、生效日期与公开记录。'],
 publication:['双人评分发布','第 10 模块：发布准备、不同人员两次审批、版本撤销。'],
 aid:['帮扶申请与资格','第 11 模块：企业申请、交付能力材料、资格有效性。'],
 commercial:['客户引荐与订单核验','第 12 模块：独立买方同意、机会阶段、真实订单凭证。']
 };
 const [name,detail]=custom[key]||[workspaceViews[key],'待接入'];
 const panel=card(name,detail);
 const tiles=document.createElement('div');tiles.className='uw-metrics';
 tiles.append(metric('已核验记录'),metric('待复核'),metric('存在争议'));
 panel.append(tiles);
 const footer=document.createElement('div');footer.className='uw-linkbar';
 footer.append(button('查看企业档案','enterprise',open),button('返回待办中心','inbox',open));
 panel.append(footer);
 root.append(disconnectedBanner(),panel,auditNotice());
}
function mountOverviewShortcuts(open){
 const overview=byId('view-overview');
 const firstMetrics=overview?.querySelector('.kpi-grid');
 if(firstMetrics&&!byId('uw-overview-shortcuts')){
  const area=document.createElement('section');area.id='uw-overview-shortcuts';
  area.className='panel uw-overview-shortcuts';
  area.append(text('h2','','今日需要处理'),text('p','uw-muted','统一进入企业认证、证据审核、评分申诉与帮扶审批。实际待办数量尚未接入，不以空白代表零。'));
  const actions=document.createElement('div');actions.className='uw-grid-actions';
  for(const [label,key] of [['审核待办中心','inbox'],['企业档案','enterprise'],['信誉治理','scoring'],['帮扶审批','aid']])
   actions.append(button(label,key,open));
  area.append(actions);firstMetrics.after(area);
 }
 const investor=byId('view-investor');
 if(investor&&!byId('uw-investor-integrity')){
  const box=document.createElement('section');box.className='panel uw-investor-integrity';
  box.id='uw-investor-integrity';
  box.append(text('h2','','新增企业业务指标 · 连接进度'),
    text('p','uw-muted','企业认证、员工关怀评分、帮扶审批、独立核验订单均尚未接入正式业务数据接口。没有可验证的经营记录时不展示虚构数值、增长率或营收。'));
  investor.append(box);
 }
}
export function mountUnifiedWorkbench(open){
 addNav(open);
 mountOverviewShortcuts(open);
 for(const key of Object.keys(workspaceViews))render(key,open);
 // This summary endpoint is a private, same-origin authenticated contract. It
 // exposes ONLY connectivity and null counts, not sensitive tenant data.
 void refreshUnifiedWorkbench();
}
export async function refreshUnifiedWorkbench(){
 if(state.loading)return;
 state.loading=true;
 const targets=document.querySelectorAll('.uw-service-status');
 try{
  const r=await fetch('./data/workspace.json',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(r.status===401){void 0;return}
  if(!r.ok)throw Error('业务目录接口暂不可用');
  const result=await r.json();
  if(result.kind!=='HHBA_ADMIN_WORKSPACE_V1'||result.sensitiveData!=='not_connected'||
     !Array.isArray(result.modules))throw Error('业务目录状态不可信');
  state.catalog=result;state.error=null;state.loaded=true;
 }catch(e){state.error=String(e?.message||e);state.loaded=false;}
 finally{state.loading=false}
}
