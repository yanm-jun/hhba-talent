// Admin-only Agent policy client. All content is rendered with textContent.
if(location.hostname==='admin.hhba.work'){
 const byId=id=>document.getElementById(id);
 const definitions=[
  ['resume_evidence','简历证据准备','用户授权后读取简历文字、脱敏并保留事实依据','必需'],
  ['official_job_search','真实岗位搜索','调用当前 DeepSeek Search/Fetch 与企业招聘来源筛选','必需'],
  ['fit_scoring','证据匹配评分','依据已有招聘信息评分，不把分数说成录用概率','必需'],
  ['targeted_resume_rewrite','定向简历优化','用户选定岗位后，使用既有简历编辑 Agent 并本人确认','可选']
 ];
 let policy=null,busy=false;
 function status(t){byId('agent-policy-feedback').textContent=t}
 function setBusy(flag){busy=flag;byId('agent-policy-load').disabled=flag;
  byId('agent-policy-save').disabled=flag||!policy;byId('agent-enabled').disabled=flag||!policy;
  byId('agent-runs-load').disabled=flag;
  for(const input of byId('agent-skill-list').querySelectorAll('input'))input.disabled=flag||!policy;
 }
 async function jsonFetch(path,body=null){
  const options={method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json'}};
  if(body){options.headers['Content-Type']='application/json';
   options.headers['X-HHBA-AGENT-ADMIN']='1';options.body=JSON.stringify(body);}
  const response=await fetch(path,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'AGENT_API_UNAVAILABLE');
  return data;
 }
 function render(){
  const grid=byId('agent-skill-list');grid.replaceChildren();
  if(!policy)return;
  byId('agent-enabled').checked=policy.enabled;
  byId('agent-policy-state').textContent=policy.enabled?'已允许调用求职 Agent':'已暂停 Agent 许可';
  byId('agent-policy-version').textContent='策略版本 '+policy.revision+' · '+(policy.updated_at||'暂无修改时间');
  for(const [id,name,purpose,requirement] of definitions){
   const label=document.createElement('label');label.className='hhba-ag-skill';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=id;
   checkbox.checked=policy.skills.includes(id);checkbox.setAttribute('data-agent-skill',id);
   const body=document.createElement('div');const strong=document.createElement('strong');
   strong.textContent=name+' · '+requirement;const small=document.createElement('small');
   small.textContent=purpose;body.append(strong,small);label.append(checkbox,body);grid.append(label);
  }
  status('可编辑；保存会形成一条管理员审计记录。');
 }
 async function load(withRuns=false){
  if(busy)return;
  setBusy(true);status('正在读取真实 D1 配置…');
  try{
   const data=await jsonFetch('/admin-preview/api/candidate-agent'+(withRuns?'?runs=1':''));
   if(data.kind!=='HHBA_ADMIN_AGENT_POLICY_V1'||!data.policy?.configured)throw Error('POLICY_UNAVAILABLE');
   policy=data.policy;render();
   if(withRuns)renderRuns(data);
  }catch(e){
   policy=null;byId('agent-policy-state').textContent='无法读取配置';
   byId('agent-policy-version').textContent='请检查 D1 迁移与管理员权限';
   byId('agent-skill-list').replaceChildren();status('读取失败：'+e.message);
  }finally{setBusy(false)}
 }
 function renderRuns(data){
  const state=byId('agent-runs-status'),root=byId('agent-runs-content');root.replaceChildren();
  if(data.run_data_status!=='collected'||!data.runs){
   state.textContent='匿名执行记录暂不可用；未使用示例数据。';return;
  }
  const total=data.runs.counters.reduce((s,x)=>s+x.count,0);
  state.textContent='最近7天 Agent 执行 '+total+' 次（只计此 Agent 路径，不代表全部岗位推荐或成功投递）。';
  for(const r of data.runs.recent){
   const row=document.createElement('div');row.className='hhba-ag-run';
   const main=document.createElement('strong');
   main.textContent=r.status==='complete'?'匹配任务完成':'匹配任务失败';
   const detail=document.createElement('span');
   detail.textContent='技能 '+r.skill_count+' · 岗位 '+r.matched_count+
    ' · '+(r.elapsed_ms/1000).toFixed(1)+' 秒 · '+String(r.created_at||'').slice(0,19).replace('T',' ');
   row.append(main,detail);root.append(row);
  }
  if(!data.runs.recent.length){const p=document.createElement('p');
   p.textContent='尚无真实 Agent 运行记录。';root.append(p);}
 }
 async function save(){
  if(busy||!policy)return;
  const enabled=byId('agent-enabled').checked;
  const skills=[...byId('agent-skill-list').querySelectorAll('input:checked')].map(x=>x.value);
  if(!skills.length){status('请至少保留一个 Skill');return;}
  if(enabled&&!definitions.slice(0,3).every(x=>skills.includes(x[0]))){
   status('启用 Agent 时，简历分析、岗位搜索和匹配评分三项必需技能都必须开启。');return;
  }
  if(!window.confirm('保存后台 Agent Skills 设置？此操作不会自动开启生产服务或自动投递。'))return;
  setBusy(true);status('正在保存，并核验修改版本…');
  try{
   const result=await jsonFetch('/admin-preview/api/candidate-agent',{
    enabled,skills,expectedRevision:policy.revision
   });
   policy=result.policy;render();status('配置已保存，审计记录已写入。');
  }catch(e){
   status(e.message==='AGENT_POLICY_CONFLICT'?'另一窗口已修改配置，请重新读取后再保存。':
    '保存未成功：'+e.message);
  }finally{setBusy(false)}
 }
 byId('agent-policy-load')?.addEventListener('click',()=>void load());
 byId('agent-runs-load')?.addEventListener('click',async()=>{
  if(busy)return;byId('agent-runs-status').textContent='正在读取实际匿名运行记录…';
  try{renderRuns(await jsonFetch('/admin-preview/api/candidate-agent?runs=1'));}
  catch(e){byId('agent-runs-status').textContent='读取失败：'+e.message;}
 });
 byId('agent-policy-save')?.addEventListener('click',()=>void save());
 window.hhbaCandidateAgent={open:()=>{if(!policy)void load();}};
}
