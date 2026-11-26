// A budget for ONE hosting invocation, never a cap on a research task, model
// tokens, search rounds or candidate count. Reserve capacity to checkpoint and
// release the task lease before the platform forcibly terminates the request.
export const PHASE_YIELD='AI_PHASE_RESOURCE_YIELD';
export function phaseResourceBudget({initial=8,soft=24,hard=34,progressReserve=0,mode='legacy'}={}){
 // Classified accounting records actual binding-call categories separately.
 // A single conservative aggregate admission ceiling remains: it protects
 // Cloudflare's shared request headroom and is never a whole-task limit.
 const classified=mode==='classified';
 let used=initial,denied=false;const counts={},groups={network:0,database:0,storage:0,browser:0,maintenance:0},extra={d1Statements:0};
 const category=kind=>kind==='fetch'?'network':kind==='d1'?'database':kind==='r2'?'storage':kind==='browser'?'browser':'maintenance';
 // Explicit progress allowance is shared with the same physical hosting limit.
 // It is not a separate platform quota and cannot consume terminal headroom.
 const reserve=Math.max(0,Math.min(hard-soft,Math.floor(progressReserve)||0));
 let reservedWrites=0;
 const remainingReserve=()=>reserve-reservedWrites;
 const researchUsed=()=>used-reservedWrites;
 const remainingResearch=()=>Math.max(0,Math.min(soft-researchUsed(),hard-used-remainingReserve()));
 const canPublishProgress=kind=>{
  if(used>=hard)return false;
  if(used<soft-2)return true;
  // Preserve the final reserved write for a validated report, not activity
  // or repeated candidate bursts. Normal research can still continue.
  return kind==='report'?remainingReserve()>0:kind==='candidate'&&remainingReserve()>1;
 };
 const observe=(kind,n=1)=>{
  used+=n;counts[kind]=(counts[kind]||0)+n;
  if(classified)groups[category(kind)]+=n;
 };
 const availableFor=kind=>{
  if(!classified)return remainingResearch();
  // Work classes have separate measured usage, not separate invented Cloudflare
  // quotas; any idle class can consume the shared research headroom.
  return Math.max(0,remainingResearch());
 };
 const take=(kind,n=1)=>{
  if(used+n>hard-remainingReserve()){denied=true;throw Object.assign(Error(PHASE_YIELD),{code:PHASE_YIELD,resource_kind:category(kind)});}
  observe(kind,n);
 };
 const statements=new WeakMap();
 const wrapStatement=statement=>{const wrapped=new Proxy(statement,{get(target,key){
  const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;
  if(key==='bind')return (...args)=>wrapStatement(v.apply(target,args));
  if(['run','all','first','raw'].includes(key))return (...args)=>{take('d1');return v.apply(target,args);};
  return v.bind(target);
 }});statements.set(wrapped,statement);return wrapped;};
 const wrapDb=db=>new Proxy(db,{get(target,key){
  const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;
  if(key==='prepare')return (...args)=>wrapStatement(v.apply(target,args));
  if(key==='batch')return list=>{
    // Cloudflare D1 batch is one binding request containing multiple SQL
    // statements. Legacy admission counted every statement as a subrequest.
    // Count the request once and expose statement volume separately.
    if(classified){take('d1');extra.d1Statements+=Math.max(1,list.length);}
    else take('d1',Math.max(1,list.length));
    return v.call(target,list.map(s=>statements.get(s)||s));
   };
  if(['exec','dump'].includes(key))return (...args)=>{take('d1');return v.apply(target,args);};
  return v.bind(target);
 }});
 const wrapBinding=(binding,kind,methods)=>new Proxy(binding,{get(target,key){
  const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;
  return methods.includes(key)?(...args)=>{take(kind);return v.apply(target,args);}:v.bind(target);
 }});
 return {observe,take,remainingResearch,availableFor,canStart:()=>!denied&&remainingResearch()>0,canPublish:()=>!denied&&remainingResearch()>2,
  canPublishProgress,
  tryProgress(kind){if(!canPublishProgress(kind))return false;if(used>=soft-2)reservedWrites++;observe('progress');return true;},
  get denied(){return denied;},get used(){return used;},
  snapshot:()=>({used,soft,hard,counts:{...counts},denied,
   ...(classified?{mode:'classified',classes:{...groups},operations:{...extra},remaining_by_class:{network:availableFor('fetch'),database:availableFor('d1'),storage:availableFor('r2'),browser:availableFor('browser')}}:{}),
   ...(reserve?{progress_reserve:reserve,progress_remaining:remainingReserve(),research_used:researchUsed()}: {})}),
  fetch:fetcher=>(...args)=>{take('fetch');return fetcher(...args);},
  env:env=>{
   const scoped={...env};
   for(const k of ['HHBA_JOB_JD_DB','HHBA_METRICS_DB','HHBA_PNVS_AUTH_DB'])if(scoped[k])scoped[k]=wrapDb(scoped[k]);
   for(const k of ['HHBA_JOB_JD_R2','HHBA_PRIVATE_RESUMES'])if(scoped[k])scoped[k]=wrapBinding(scoped[k],'r2',['get','head','put','delete','list']);
   if(scoped.BROWSER)scoped.BROWSER=wrapBinding(scoped.BROWSER,'browser',['fetch','connect','launch']);
   return scoped;
  }
 };
}

// Limits apply to one Cloudflare invocation, not to AI search/verification
// rounds. On resource pressure use a smaller phase to guarantee checkpointing.
export function v4ManagedResourceBudget({background=false,recovering=false}={}){
 return phaseResourceBudget({
  mode:'classified',initial:recovering?12:8,soft:recovering?29:36,
  hard:recovering?38:44,progressReserve:background?4:0
 });
}

// Only replay exact, already completed calls from an interrupted invocation.
// Never store raw prompts, credentials or private reasoning. Within a live
// invocation an intentional repeated call still goes to the provider.
export function phaseModelReplay(entries=[]){
 const previous=new Map(Array.isArray(entries)?entries:[]),current=new Map(),used=new Set();
 return {
  take(key){
   if(used.has(key)||!previous.has(key))return null;
   used.add(key);const value=previous.get(key);current.set(key,value);return value;
  },
  remember(key,response){
   if(response?.status!=='completed'||!Array.isArray(response.output))return;
   current.set(key,{status:'completed',output:response.output.filter(item=>item?.type!=='reasoning')});
  },
  snapshot:()=>[...new Map([...previous,...current])]
 };
}

 // Per-invocation admission based on measured resource cost; not a task cap.
 export function managedWorkPlan(budget,history,pending,{maxLanes=4,maxWindow=8,reserve=0,initialCost=8}={}){
  if(pending<=0)return {width:0,window:0};
  const {used,soft}=budget.snapshot();
 const available=typeof budget.remainingResearch==='function'?budget.remainingResearch():Math.max(0,soft-used);
  const cost=Number.isFinite(history?.cost)&&history.cost>0?history.cost:initialCost;
  const capacity=Math.max(1,Math.floor(Math.max(0,available-reserve)/Math.max(2,cost)));
  const previous=Number.isSafeInteger(history?.width)&&history.width>0?history.width:2;
  const width=Math.min(pending,maxLanes,capacity,history?.pressure?1:previous+1);
  return {width:Math.max(1,width),window:Math.max(1,Math.min(pending,maxWindow,capacity,history?.pressure?1:width*2))};
 }
 export function managedWorkSample(previous,budget,start,completed,width,{pressure=false,initialCost=8}={}){
  const spent=Math.max(0,budget.used-start);
  const old=Number.isFinite(previous?.cost)&&previous.cost>0?previous.cost:initialCost;
  const observed=completed>0?Math.max(2,spent/completed):old;
  const cost=pressure?Math.max(old,observed,initialCost):Math.max(observed,old*0.5+observed*0.5);
  return {cost,width:pressure?1:Math.max(1,width),pressure:!!pressure};
 }
