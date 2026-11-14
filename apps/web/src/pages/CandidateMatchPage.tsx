import {ChangeEvent,DragEvent,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,Building2,FileText,FileUp,LockKeyhole,LoaderCircle,MapPin,Plane,ShieldCheck,Sparkles,Wallet,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {Link} from '../router';
import {CandidateMatchNativeDialog} from '../components/CandidateMatchNativeDialog';
import {listPrivateResumes,privateResumeAvailable,fetchPrivateResumeForLocalReview,uploadPrivateResume,type PrivateResume} from '../services/privateResumes';
import {linkMatchHistoryResume} from '../services/matchHistory';
import {getRealAuthToken} from '../services/realAuth';
import {matchServiceReady,submitResumeForMatching,submitExtractedResumeText,extractResumeTextLocally,type MatchResponse,type MatchedJob,type MatchOptions,MatchError} from '../services/resumeMatch';
import '../styles/resume-match.css';

const supportedTypes='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxResumeSize=3*1024*1024;
const defaultSearchPreferences={
 industry_hint:'',preferred_cities:'',location_mode:'PRIORITY' as const,
 travel_preference:'UNSPECIFIED' as const,salary_min_k:'',salary_max_k:'',employer_models:[] as string[]
};
const employerModelChoices=[
 {value:'dealer_network',label:'经销商 / 代理商网络'},
 {value:'chain_stores',label:'连锁门店 / 直营网点'},
 {value:'regional_teams',label:'全国 / 区域运营团队'},
 {value:'brand_service_network',label:'品牌终端 / 服务网点'}
];
function inferResumeCapabilityHints(text:string){
 const checks=[
  ['区域与渠道管理',/区域管理|渠道管理|经销商|4S店|DCC|门店运营|终端管理|巡店/i],
  ['销售转化与客户运营',/销售漏斗|线索转化|客户管理|成交|试驾|邀约|到店|销售业绩/i],
  ['团队培训与质量管理',/培训|带教|督导|巡店|考核|质检|团队管理|录音回收/i],
  ['数据分析与经营复盘',/数据分析|Excel|SQL|指标|转化率|报表|统计|经营分析/i],
  ['市场与品牌运营',/品牌推广|市场营销|活动策划|新媒体|内容运营|品牌运营/i],
  ['项目与流程建设',/项目管理|流程建设|SOP|标准化|体系搭建|流程优化/i]
 ] as const;
 return checks.filter(([,pattern])=>pattern.test(text)).map(([label])=>label);
}


export function CandidateMatchPage({user}:{user:User|null}){
 const [file,setFile]=useState<File|null>(null);
 const [savedFiles,setSavedFiles]=useState<PrivateResume[]>([]);
 const [savedId,setSavedId]=useState('');
 const deepLinkPending=useRef<string|null>(new URLSearchParams(window.location.search).get('resume'));
 const [previewText,setPreviewText]=useState('');
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const previewController=useRef<AbortController|null>(null);
 const [vaultError,setVaultError]=useState('');
 const [saveConsent,setSaveConsent]=useState(false);
 const [saveBusy,setSaveBusy]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 const [drag,setDrag]=useState(false);
 const [consent,setConsent]=useState(false);
 const [availability,setAvailability]=useState<'loading'|'ready'|'disabled'>('loading');
 const [options,setOptions]=useState<MatchOptions>({
  country:'CN',remote_only:false,role_hint:'',limit:10,
  search_preferences:{...defaultSearchPreferences}
 });
 const searchPreferences={...defaultSearchPreferences,...options.search_preferences};
 const capabilityHints=previewLoaded?inferResumeCapabilityHints(previewText):[];
 function updateSearchPreferences(patch:Partial<typeof defaultSearchPreferences>){
  setOptions(current=>({...current,search_preferences:{
   ...defaultSearchPreferences,...current.search_preferences,...patch
  }}));
 }
 const [working,setWorking]=useState(false);
  const [partialJobs,setPartialJobs]=useState<MatchedJob[]>([]);
  const [stage,setStage]=useState<'preparing'|'connected'|'searching'|'reading'|'writing'|'waiting'>('preparing');
 const [elapsedSeconds,setElapsedSeconds]=useState(0);
 useEffect(()=>{
  if(!working)return;
  const started=Date.now();setElapsedSeconds(0);
  const timer=window.setInterval(()=>setElapsedSeconds(Math.floor((Date.now()-started)/1000)),1000);
  return()=>window.clearInterval(timer);
 },[working]);
 const [error,setError]=useState('');

 const [result,setResult]=useState<MatchResponse|null>(null);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  void matchServiceReady(abort.signal).then(ok=>{if(!abort.signal.aborted)setAvailability(ok?'ready':'disabled')});
  return()=>{abort.abort();controller.current?.abort();previewController.current?.abort()};
 },[]);
 useEffect(()=>{
  let active=true;
  const reload=()=>{
   if(!privateResumeAvailable||!user||!getRealAuthToken()){
    previewController.current?.abort();
    if(active){setPreviewText('');setPreviewLoaded(false);setConsent(false);}
    if(active){setSavedFiles([]);setSavedId('');}return;
   }
   void listPrivateResumes().then(rows=>{if(active){
    setSavedFiles(rows);setVaultError('');
    const requested=deepLinkPending.current;
    if(requested){
     deepLinkPending.current=null;
     if(/^[0-9a-f-]{36}$/.test(requested)&&rows.some(item=>item.id===requested))setSavedId(requested);
     else setVaultError('指定的简历不在当前账号，请从列表中选择。');
    }
   }})
    .catch(e=>{if(active){setSavedFiles([]);setVaultError(e instanceof Error?e.message:'私有简历暂时无法读取。');}});
  };
  reload();
  window.addEventListener('hhba:private-resumes-changed',reload);
  window.addEventListener('hhba:real-auth-changed',reload);
  return()=>{active=false;window.removeEventListener('hhba:private-resumes-changed',reload);
   window.removeEventListener('hhba:real-auth-changed',reload);};
 },[user?.id]);
 function choose(candidate:File|null){
  previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setConsent(false);
  setError('');setResult(null);setSaveConsent(false);setSaveNotice('');
  if(!candidate){setFile(null);return}
  if(!/\.(pdf|docx)$/i.test(candidate.name)||!candidate.size||candidate.size>maxResumeSize){
    setFile(null);setError('请选择不超过 3 MB 的 PDF 或 DOCX 文件。');return;
  }
  setSavedId('');setFile(candidate);
 }
 async function preview(){
  if((!file&&!savedId)||working||previewBusy)return;
  setPreviewBusy(true);setError('');setPreviewText('');setPreviewLoaded(false);
  const abort=new AbortController();previewController.current=abort;
  try{
   let selected=file;
   if(!selected&&savedId){
    const entry=savedFiles.find(x=>x.id===savedId);
    if(!entry)throw new MatchError(404,'已保存的简历不存在，请重新选择。');
    const bytes=await fetchPrivateResumeForLocalReview(entry);
    if(abort.signal.aborted)return;
    selected=new File([bytes],entry.name,{type:entry.type});
   }
   if(!selected)throw new MatchError(400,'请先选择简历。');
   const text=await extractResumeTextLocally(selected,abort.signal);
   if(!abort.signal.aborted){setPreviewText(text);setPreviewLoaded(true);}
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof Error?e.message:'无法读取简历文字。');
  }finally{setPreviewBusy(false);previewController.current=null;}
 }
 async function saveResume(){
  if(!file||savedId||!saveConsent||saveBusy||!user||!getRealAuthToken())return;
  setSaveBusy(true);setSaveNotice('');
  try{
   const item=await uploadPrivateResume(file,true);
   setSavedId(item.id);setSavedFiles(all=>all.some(x=>x.id===item.id)?all:[item,...all]);
   window.dispatchEvent(new Event('hhba:private-resumes-changed'));
   setSaveConsent(false);
   if(result?.history_id){
    try{
     await linkMatchHistoryResume(result.history_id,item.id);
     setSaveNotice('简历已保存到「我的简历」，并关联到本次 AI 匹配历史。');
    }catch{
     setSaveNotice('简历已保存到「我的简历」，但与匹配历史的关联暂未完成；历史推荐内容仍可单独查看。');
    }
   }else setSaveNotice('简历已保存到「我的简历」，下次可以直接选择使用，不必重复上传。');
  }catch(e){setSaveNotice(e instanceof Error?e.message:'简历保存失败，请稍后重试。')}
  finally{setSaveBusy(false)}
 }
 async function run(){
  if((!file&&!savedId)||!consent||working||previewBusy||availability!=='ready'||!getRealAuthToken())return;
  setWorking(true);setStage('preparing');setElapsedSeconds(0);setError('');setResult(null);setPartialJobs([]);
  const abort=new AbortController();
  controller.current=abort;
  try{
   let matched:MatchResponse;
   if(previewLoaded){
    // Once the user has reviewed/edited text, NEVER fall back to re-reading the unedited file.
    matched=await submitExtractedResumeText(previewText,options,consent,abort.signal,savedId||undefined,setStage,setPartialJobs);
   }else{
    let selected=file;
    if(!selected&&savedId){
     const entry=savedFiles.find(item=>item.id===savedId);
     if(!entry)throw new MatchError(404,'已保存的简历已改变，请重新选择。');
     const bytes=await fetchPrivateResumeForLocalReview(entry);
     if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
     selected=new File([bytes],entry.name,{type:entry.type});
    }
    if(!selected)throw new MatchError(400,'请选择简历。');
    matched=await submitResumeForMatching(selected,options,consent,abort.signal,savedId||undefined,setStage,setPartialJobs);
   }
   setResult(matched);setPartialJobs([]);
   // Keep selected file for return-to-edit. No automatic re-analysis.
   setConsent(false);
  }catch(e){
   if((e as Error)?.name!=='AbortError')setError(e instanceof MatchError?e.message:'智能匹配暂时失败，请稍后再试。');
  }finally{setWorking(false);controller.current=null}
 }
 return <Shell user={user}>
  <section className="hhba-ai-page">
    <nav className="hhba-ai-breadcrumb"><Link to="/candidate"><ArrowLeft size={15}/> 我要应聘</Link>
     <span>/</span><strong>简历智能匹配</strong></nav>
    <div className="hhba-ai-hero">
      <div className="hhba-ai-kicker"><BriefcaseBusiness size={16}/> 汇方职场 · HHBA · AI JOB MATCH</div>
      <h1>上传简历，寻找合适岗位。</h1>
      <p>HHBA 将结合你的简历与公开岗位，为你生成个性化推荐。</p>
    </div>
    {availability==='loading'&&<p className="hhba-ai-service-check"><LoaderCircle size={17} className="spin"/>正在检查平台智能匹配服务…</p>}
    {availability==='disabled'&&<div className="hhba-ai-admin-note" role="status">
       <LockKeyhole size={19}/><div><strong>智能匹配服务暂未启用。</strong>
       <p>请稍后再试，或直接浏览公开岗位。</p>
       <button type="button" onClick={()=>{setAvailability('loading');void matchServiceReady().then(ok=>setAvailability(ok?'ready':'disabled'))}}>重新检测服务状态</button>
       </div></div>}
    <div className="hhba-ai-layout">
      <section className="hhba-ai-upload">
        <header><h2><FileUp size={20}/> 1. 上传简历</h2><p>PDF 或 DOCX，最大 3 MB。只有点击开始并同意授权后才分析，不会自动向企业投递。</p></header>
        {user&&privateResumeAvailable&&<div className="hhba-ai-saved-picker">
          <label htmlFor="hhba-ai-existing">使用「我的简历」中已经保存的文件（无需重新上传）</label>
          <select id="hhba-ai-existing" value={savedId} disabled={working}
           onChange={e=>{previewController.current?.abort();setPreviewText('');setPreviewLoaded(false);setConsent(false);setSavedId(e.target.value);setFile(null);setResult(null);setError('');}}>
           <option value="">不使用已保存文件，改为下面选择新文件</option>
           {savedFiles.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          {!savedFiles.length&&<p>还没有保存的简历。可从 <Link to="/candidate/account/resume">我的简历</Link> 上传。</p>}
          {vaultError&&<p role="status">{vaultError}</p>}
        </div>}
        {!getRealAuthToken()&&<p className="hhba-ai-service-check">AI 简历匹配需要先 <Link to="/candidate/login">登录 HHBA 求职账号</Link>。</p>}
        <input id="hhba-ai-resume" className="sr-only" type="file" accept={supportedTypes}
          onChange={(e:ChangeEvent<HTMLInputElement>)=>choose(e.target.files?.[0]||null)}/>
        <label htmlFor="hhba-ai-resume" className={'hhba-ai-drop '+(drag?'dragging':'')}
          onDragOver={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0]||null)}}>
          <FileText size={26}/>
          <strong>{savedId?'已选择私有简历：'+(savedFiles.find(x=>x.id===savedId)?.name||'') :file?file.name:'点击选择文件，或将简历拖到这里'}</strong>
          <span>{file?(file.size/1024/1024).toFixed(2)+' MB · 可以分析':'仅支持可提取文字的 PDF / DOCX；扫描图片暂不支持'}</span>
        </label>
        <div className="hhba-ai-review-tools">
         <button type="button" disabled={(!file&&!savedId)||working||previewBusy}
          onClick={()=>void preview()}>{previewBusy?'正在读取简历文字…':'可选：预览并编辑用于匹配的简历文字'}</button>
         {previewLoaded&&<div className="hhba-ai-text-review">
          <label htmlFor="hhba-ai-text-preview">文字预览（最多 20,000 字）</label>
          <textarea id="hhba-ai-text-preview" rows={6} maxLength={20000} value={previewText}
           disabled={working} onChange={e=>{setPreviewText(e.target.value);setConsent(false);}}/>
          <small>请先删除不希望用于本次匹配的内容。</small>
         </div>}
        </div>
        <header className="hhba-ai-section-title"><h2>2. 补充求职画像</h2>
          <p>这些信息帮助 AI 找到更适合你的企业和岗位。不填写也能匹配，AI 不会只按你填写的职位名称搜索。</p></header>
        <section className="hhba-ai-capability-panel" aria-label="简历能力自动识别">
          <div className="hhba-ai-capability-heading"><Sparkles size={17}/><strong>AI 自动识别简历核心能力</strong><span>无需手动填写</span></div>
          {previewLoaded&&capabilityHints.length>0?
           <><div className="hhba-ai-capability-tags">{capabilityHints.map(tag=><span key={tag}>{tag}</span>)}</div>
            <small>以上是根据简历文字初步识别的能力线索；DeepSeek 还会结合完整经历、业绩和岗位职责继续分析。</small></>:
           <p>开始匹配时，AI 会自动提取你的真实职责、工作成果、专业技能和可迁移能力。点击上方「预览简历文字」可以先检查简历内容。</p>}
        </section>
        <div className="hhba-ai-preference-block">
          <div className="hhba-ai-preference-grid">
            <label>优先岗位方向（选填）
              <textarea rows={2} maxLength={240} value={options.role_hint}
               placeholder="例如：区域督导、渠道运营、零售运营、销售培训；也可以不填"
               onChange={e=>setOptions(x=>({...x,role_hint:e.target.value}))}/>
              <small>岗位名称只是搜索起点，AI 会自动拓展相邻岗位和跨行业机会。</small>
            </label>
            <label>优先行业（选填）
              <input type="text" maxLength={120} value={searchPreferences.industry_hint}
               placeholder="例如：汽车、消费品、零售、智能硬件；不填则不限行业"
               onChange={e=>updateSearchPreferences({industry_hint:e.target.value})}/>
              <small>只影响搜索优先级，不会排除其他行业中合适的岗位。</small>
            </label>
          </div>
          <div className="hhba-ai-preference-section">
            <h3><MapPin size={16}/> 工作地点与出差要求</h3>
            <div className="hhba-ai-preference-grid">
              <label>优先城市（选填）
                <input type="text" maxLength={120} value={searchPreferences.preferred_cities}
                 placeholder="例如：上海、杭州、苏州"
                 onChange={e=>updateSearchPreferences({preferred_cities:e.target.value})}/>
                <small>多个城市可用顿号或逗号分隔。</small>
              </label>
              <label>地点要求
                <select value={searchPreferences.location_mode}
                 onChange={e=>updateSearchPreferences({location_mode:e.target.value as typeof defaultSearchPreferences.location_mode})}>
                  <option value="PRIORITY">优先这些城市，也可推荐全国其他城市</option>
                  <option value="ONLY">仅限填写的城市</option>
                  <option value="NATIONWIDE">全国不限城市</option>
                </select>
                <small>选择“仅限填写的城市”时，请至少填写一个城市。</small>
              </label>
              <label>出差接受程度
                <select value={searchPreferences.travel_preference}
                 onChange={e=>updateSearchPreferences({travel_preference:e.target.value as typeof defaultSearchPreferences.travel_preference})}>
                  <option value="UNSPECIFIED">未限定，按岗位情况推荐</option>
                  <option value="FREQUENT_OK">接受全国出差 / 跨区域工作</option>
                  <option value="OCCASIONAL">可以偶尔出差，不接受长期驻外</option>
                  <option value="NO">不接受需要出差的岗位</option>
                </select>
                <small>AI 会读取职位详情中的出差要求，不会自行猜测。</small>
              </label>
            </div>
          </div>
          <div className="hhba-ai-preference-section">
            <h3><Wallet size={16}/> 期望薪资（选填）</h3>
            <div className="hhba-ai-salary-row">
              <label>最低月薪（K）
                <input type="number" min="0" max="500" step="1" inputMode="decimal"
                 value={searchPreferences.salary_min_k} placeholder="例如 15"
                 onChange={e=>updateSearchPreferences({salary_min_k:e.target.value})}/>
              </label>
              <span>至</span>
              <label>最高月薪（K）
                <input type="number" min="0" max="500" step="1" inputMode="decimal"
                 value={searchPreferences.salary_max_k} placeholder="例如 20"
                 onChange={e=>updateSearchPreferences({salary_max_k:e.target.value})}/>
              </label>
              <span>元 / 月</span>
            </div>
            <small>公开薪资会参与排序；企业未公开薪资的岗位仍可推荐，并明确标注“薪资未披露”。</small>
          </div>
          <div className="hhba-ai-preference-section">
            <h3><Building2 size={16}/> 优先寻找的企业经营模式（选填）</h3>
            <p>可多选；不选择则不限企业类型。以下只是搜索重点，不会成为企业筛选边界。</p>
            <div className="hhba-ai-employer-models">
              {employerModelChoices.map(item=><label key={item.value}>
                <input type="checkbox" checked={searchPreferences.employer_models.includes(item.value)}
                 onChange={e=>updateSearchPreferences({employer_models:e.target.checked?
                  [...searchPreferences.employer_models,item.value]:
                  searchPreferences.employer_models.filter(x=>x!==item.value)})}/>
                <span>{item.label}</span>
              </label>)}
            </div>
          </div>
          <div className="hhba-ai-search-promise"><Sparkles size={16}/>
            <span><strong>不局限于预设企业名单</strong>：DeepSeek 将从简历能力和企业经营场景自主发现雇主，再核验具体岗位与企业官方投递页面。</span>
          </div>
        </div>
        <header className="hhba-ai-section-title"><h2>3. 确认 AI 分析与隐私</h2></header>
        <label className="hhba-ai-consent"><input type="checkbox" checked={consent}
          onChange={e=>setConsent(e.target.checked)}/>
          <span>我已阅读并同意 <Link to="/candidate/account/privacy">《隐私说明》</Link>，并单独授权 HHBA 将本次简历文字（系统会尝试遮盖邮箱、手机号、身份证号、个人网址及微信/QQ号，但不保证完全匿名）、求职偏好和提取出的能力线索发送给 DeepSeek API，用于联网搜索与岗位匹配。</span>
        </label>
        <p className="hhba-ai-notice"><ShieldCheck size={15}/>系统仅尝试遮盖部分标识信息，无法保证完全匿名；建议先预览并编辑不愿分享的内容。不会自动向企业投递或公开。</p>
        {error&&<p className="hhba-ai-error" role="alert"><XCircle size={17}/>{error}</p>}
        <button className="hhba-ai-submit" type="button" onClick={()=>void run()}
          disabled={(!file&&!savedId)||!consent||working||previewBusy||(previewLoaded&&previewText.replace(/\s/g,'').length<30)||availability!=='ready'||!getRealAuthToken()}>
          {working?<><LoaderCircle className="spin" size={18}/> 正在进行深度岗位研究与匹配…</>:
           <><BriefcaseBusiness size={17}/> 开始智能匹配 <ArrowRight size={17}/></>}
        </button>
      </section>
      <aside className="hhba-ai-aside">
        <div className="hhba-ai-aside-card"><h3>只需三步</h3>
           <ol><li>上传简历</li><li>智能匹配为你寻找岗位</li>
             <li>直接查看 Top 10 推荐理由与岗位链接</li></ol>
         </div>
         <p className="hhba-ai-aside-footnote">工作地点仅限中国大陆；招聘状态请以岗位原始网页为准。</p>
      </aside>
    </div>
    {(working||result||partialJobs.length>0)&&<CandidateMatchNativeDialog
      result={result||{matches:partialJobs}}
      pending={working&&!result} notice={working?'':error} stage={stage} elapsedSeconds={elapsedSeconds}
      resumeStorage={result&&file&&!savedId?{
        available:true,saved:false,consent:saveConsent,saving:saveBusy,
        notice:saveNotice,onConsent:setSaveConsent,onSave:()=>void saveResume()
       }:result&&savedId?{available:false,saved:true,consent:false,saving:false,
        notice:saveNotice,onConsent:()=>{},onSave:()=>{}}:undefined}
      onClose={()=>{if(working)controller.current?.abort();setPartialJobs([]);setResult(null);setWorking(false);}}/>}
     <div className="hhba-ai-footer"><Link to="/candidate/jobs">不上传简历，直接搜索公开岗位 <ArrowRight size={15}/></Link></div>
  </section>
 </Shell>;
}
