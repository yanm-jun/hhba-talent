import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OriginalWordViewer,type WordVisualSuggestion} from '../src/components/OriginalWordViewer';
import type {PrivateResume} from '../src/services/privateResumes';

const resume:PrivateResume={
 id:'11111111-2222-4333-8444-555555555555',
 name:'HHBA-SYNTHETIC-QA.docx',
 type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 size:1,createdAt:'2026-11-21T00:00:00.000Z'
};
const OLD='负责门店运营及日常数据整理工作';
const NEW='负责门店运营及业务数据整理';
function Demo(){
 const [job,setJob]=useState('role-A');
 const [accepted,setAccepted]=useState<Record<string,boolean>>({});
 const [events,setEvents]=useState<string[]>([]);
 const suggestion:WordVisualSuggestion={id:'visual-'+job,original:OLD,proposed:NEW,
  state:accepted[job]?'accepted':'pending'};
 function record(action:string){setEvents(value=>[...value,job+':'+action]);}
 return <main style={{maxWidth:1150,margin:'auto',padding:16}}>
  <header><strong>HHBA / 合成 Word 交互自动验收</strong></header>
  <nav aria-label="合成岗位切换">
   <button type="button" onClick={()=>setJob('role-A')}>切换岗位甲</button>
   <button type="button" onClick={()=>setJob('role-B')}>切换岗位乙</button>
  </nav>
  <p data-testid="active-job">{job}</p>
  <p data-testid="saved-events">{events.join(',')}</p>
  <OriginalWordViewer
   key={job} resume={resume} jobId={job} jobTitle={job}
   visualSuggestions={[suggestion]}
   glowActive={true}
   onVisualSuggestionAction={(id,action)=>{record(action);if(action==='accepted')setAccepted(v=>({...v,[job]:true}));}}
   onVerifiedSave={()=>record('word-saved')}
   onVersionMoved={()=>record('version-moved')}
  />
 </main>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);
