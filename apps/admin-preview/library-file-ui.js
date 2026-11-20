import {LIB_HALL_NAMES,LIB_BATCH_SIZE,parseImportFile,parseImportText,planImportBatches,exportFailedCSV} from './library-file-import.js';

const el=id=>document.getElementById(id);
const f=new Intl.NumberFormat('zh-CN');
let loaded=false,job=null,running=false,pauseWanted=false,busyReading=false;
const dialog=()=>el('lib-import-dialog');
function setError(s=''){el('lib-import-error').textContent=s}
function download(name,content){
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function counter(v){return f.format(v||0)}
function render(){
 const box=el('lib-import-preview');box.hidden=!job;
 const state=el('lib-import-state'),fileName=el('lib-import-file-name');
 if(!job){
  el('lib-import-submit').hidden=false;
  el('lib-import-pause').hidden=true;
  el('lib-import-resume').hidden=true;
  el('lib-import-skip').hidden=true;
  el('lib-import-export-errors').hidden=true;
  el('lib-import-file').disabled=false;
  el('lib-import-text').disabled=false;
  el('lib-import-default-industry').disabled=false;
  el('lib-import-submit').disabled=busyReading;
  el('lib-import-submit').textContent=busyReading?'正在读取文件…':'开始自动分批导入';
  fileName.textContent='尚未选择文件';state.textContent='';return;
 }
 fileName.textContent=job.filename+' · 每批 '+LIB_BATCH_SIZE+' 条，共 '+job.batches.length+' 批';
 const done=job.success+job.duplicate+job.failed.length;
 el('lib-import-total').textContent=counter(job.total);
 el('lib-import-success').textContent=counter(job.success);
 el('lib-import-duplicate').textContent=counter(job.duplicate);
 el('lib-import-failed').textContent=counter(job.failed.length);
 el('lib-import-remaining').textContent=counter(Math.max(0,job.total-done));
 const progress=el('lib-import-progress');progress.max=Math.max(1,job.total);progress.value=Math.min(job.total,done);
 if(running)state.textContent='正在导入第 '+(job.cursor+1)+' / '+job.batches.length+' 批；已处理 '+counter(done)+' / '+counter(job.total)+' 条。';
 else if(job.error||job.paused)state.textContent='已暂停在第 '+(job.cursor+1)+' 批。已完成的结果保留，点击「重试并继续」会自动去重。';
 else if(job.cursor===job.batches.length)state.textContent='全部批次处理完毕：成功 '+counter(job.success)+'、重复 '+counter(job.duplicate)+'、失败 '+counter(job.failed.length)+' 条。';
 else state.textContent='已检查 '+counter(job.total)+' 行，准备分批导入。';
 el('lib-import-export-errors').hidden=job.failed.length===0;
 el('lib-import-pause').hidden=!running;
 el('lib-import-resume').hidden=running||!(job.error||job.paused);
 el('lib-import-skip').hidden=running||!job.error||job.error?.body?.error!=='INVALID_LIBRARY_RECORD';
 // A job can only be started from a fresh file. Retrying its interrupted batch uses the resume button.
 if(job.cursor>0||job.error||job.paused||job.cursor===job.batches.length)el('lib-import-submit').hidden=true;
 else el('lib-import-submit').hidden=running;
 el('lib-import-file').disabled=running;
 el('lib-import-text').disabled=running;
 el('lib-import-default-industry').disabled=running;
 el('lib-import-cancel').textContent=running?'暂停后关闭':'关闭';
}
function errorMessage(e){
 if(e?.body?.error==='D1_DAILY_LIMIT_REACHED')return 'Cloudflare D1 今日额度已满，自动暂停；不会继续向数据库发送剩余批次。';
 if(e?.body?.error==='LIBRARY_DATABASE_NOT_CONNECTED')return '当前环境尚未连接数据库，不能导入。';
 if([401,403].includes(e?.status))return '管理员身份验证失败或登录过期；请重新授权后点击重试。';
 if(e?.body?.error==='INVALID_LIBRARY_RECORD')return '本批包含数据库拒绝的记录，可以跳过本批并导出失败清单。';
 if(e?.status===404)return '此预览环境没有受保护的数据库 API；不允许用静态页面模拟导入。';
 return '网络或数据库请求失败，暂不认定本批数据已写入。可以安全重试当前批次。';
}
async function submitBatch(upload,rows){
 const resp=await fetch('/admin-preview/api/library',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json','Accept':'application/json','x-hhba-library-request':'1'},
  body:JSON.stringify({action:'import',upload_id:upload,rows:rows.map(({industry_id,enterprise,recruitment_url,verified})=>({industry_id,enterprise,recruitment_url,verified}))})
 });
 let data=null;try{data=await resp.json()}catch{}
 if(!resp.ok||data?.kind!=='HHBA_RECRUITMENT_LIBRARY_V1')throw {status:resp.status,body:data};
 for(const k of ['inserted','replayed','duplicates']){
  if(!Number.isSafeInteger(data[k])||data[k]<0)throw {status:502,body:{error:'INVALID_BATCH_RESPONSE'}};
 }
 if(data.inserted+data.replayed+data.duplicates!==rows.length)throw {status:502,body:{error:'INCONSISTENT_BATCH_COUNTS'}};
 return data;
}
async function run(){
 if(!job||running)return;
 running=true;pauseWanted=false;job.paused=false;job.error=null;setError();render();
 while(job.cursor<job.batches.length&&!pauseWanted){
  const batch=job.batches[job.cursor];
  try{
   const result=await submitBatch(job.upload_id,batch);
   job.success+=result.inserted+result.replayed;
   job.duplicate+=result.duplicates;
   job.cursor++;
  }catch(e){job.error=e;setError(errorMessage(e));break}
  render();
 }
 running=false;if(pauseWanted&&!job.error&&job.cursor<job.batches.length)job.paused=true;render();
 if(job.cursor===job.batches.length&&!job.error){
  setError(job.failed.length?'有格式错误记录未导入，可以下载失败清单。':'导入完成，原始 Excel 不会保存在服务器。');
  // Once at the end, refresh counters and current shelf; never repeat a full
  // summary and list query 38 times for a 3,800-row import.
  try{await window.hhbaLibrary?.refresh()}catch{/* counts remain read-only unavailable */}
 }else if(pauseWanted&&!job.error){setError('已暂停；点击「重试并继续」即可接着导入下一批。')}
}
function init(){
 if(loaded)return;loaded=true;
 for(const [id,label] of LIB_HALL_NAMES){
  const o=document.createElement('option');o.value=id;o.textContent=label;el('lib-import-default-industry').append(o);
 }
 el('lib-import-form').addEventListener('submit',async e=>{
  e.preventDefault();if(running||busyReading)return;
  const file=el('lib-import-file').files?.[0],paste=el('lib-import-text').value;
  if(!file&&!paste.trim()){setError('请先选择 Excel / CSV 文件，或者粘贴表格内容。');return}
  busyReading=true;job=null;setError();render();
  try{
   const data=file?await parseImportFile(file,{defaultIndustry:el('lib-import-default-industry').value}):
    parseImportText(paste,el('lib-import-default-industry').value);
   if(!data.total)throw Error('文件中没有可导入的数据行。');
   job={filename:file?file.name:'粘贴的表格',total:data.total,batches:planImportBatches(data.valid),
    success:0,duplicate:data.duplicate.length,failed:[...data.invalid],cursor:0,
    upload_id:crypto.randomUUID(),error:null,paused:false};
   if(!job.batches.length){setError('没有可写入的有效网址；请下载失败清单修正。')}
  }catch(e){setError(e?.message||'文件无法解析，请检查 Excel 表头与格式。')}
  finally{busyReading=false;render()}
  if(job?.batches.length)await run();
 });
 el('lib-import-pause').addEventListener('click',()=>{pauseWanted=true;el('lib-import-pause').disabled=true});
 el('lib-import-resume').addEventListener('click',()=>{el('lib-import-pause').disabled=false;void run()});
 el('lib-import-skip').addEventListener('click',()=>{
  if(!job||running||job.error?.body?.error!=='INVALID_LIBRARY_RECORD')return;
  const batch=job.batches[job.cursor]||[];
  job.failed.push(...batch.map(row=>({...row,reason:'服务器拒绝的批次（未写入）'})));
  job.cursor++;job.error=null;setError();render();void run();
 });
 el('lib-import-export-errors').addEventListener('click',()=>{
  if(job?.failed?.length)download('HHBA-招聘网址-失败清单.csv',exportFailedCSV(job.failed));
 });
 el('lib-template-download').addEventListener('click',()=>{
  download('HHBA-招聘网址导入模板.csv','\uFEFF行业馆,企业名称,招聘网址\r\n');
 });
 el('lib-import-file').addEventListener('change',()=>{job=null;setError();render()});
 el('lib-import-text').addEventListener('input',()=>{if(!running){job=null;render()}});
 for(const id of ['lib-import-close','lib-import-cancel'])el(id).addEventListener('click',()=>{
  if(running){pauseWanted=true;setError('将在当前批次结束后暂停，请勿关闭页面。');return}
  dialog().close();
 });
 dialog().addEventListener('cancel',e=>{if(running){e.preventDefault();pauseWanted=true}});
}
window.hhbaImport={
 open(defaultHall=''){
  init();if(running){if(!dialog().open)dialog().showModal();return}
  job=null;pauseWanted=false;busyReading=false;
  const form=el('lib-import-form');form.reset();
  el('lib-import-default-industry').value=defaultHall||'';
  el('lib-import-submit').hidden=false;
  el('lib-import-pause').disabled=false;
  setError();render();dialog().showModal();
 }
};
