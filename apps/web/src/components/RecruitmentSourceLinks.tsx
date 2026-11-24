import {ArrowUpRight,Globe} from 'lucide-react';
import {collectRecruitmentSources,recruitmentText} from '../services/recruitmentSourcePresentation';
import '../styles/recruitment-source-links.css';
export {recruitmentText};
export function RecruitmentSourceLinks({job,includePrimary=true}:{job:Parameters<typeof collectRecruitmentSources>[0];includePrimary?:boolean}){
 const sources=collectRecruitmentSources(job,includePrimary);
 if(!sources.length)return null;
 return <section className="hhba-recruitment-sources" aria-label="招聘信息来源">
  <h4>招聘信息来源</h4>
  <div className="hhba-recruitment-source-list">{sources.map((source,i)=>
   <a key={source.url} className="hhba-recruitment-source-card" href={source.url} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true" aria-label={(source.verified?'前往官网':'查看招聘来源')+' · '+source.host+' · '+(i+1)+'（新窗口）'}>
    <span className="hhba-recruitment-source-icon"><Globe size={19} aria-hidden="true"/></span>
    <span className="hhba-recruitment-source-copy"><strong>{source.label||'公开招聘资料 '+String(i+1).padStart(2,'0')}</strong><small>{source.host}</small><small className={source.verified?'hhba-recruitment-source-verified':''}>{source.verified?'官方来源已核验':'来源待进一步核验'}</small></span>
    <span className="hhba-recruitment-source-action">{source.verified?'前往官网':'查看来源'}<ArrowUpRight size={15} aria-hidden="true"/></span>
   </a>)}</div>
 </section>;
}
