// Navigation only. Never claim an AI-discovered URL has a verified employer
// identity or a confirmed vacancy merely because a user can open it.
// JD verification, evidence scoring and selection remain separate processes.
import {isCommercialRecruitmentBoard,recruitmentSourceKind} from '../../functions/_lib/match-employer-source.js';

export function discoveryApplyDestination(job){
 if(!job||job.excluded_board||job.excluded_closed||
    job.recruitment_source_kind==='THIRD_PARTY_BOARD'||
    ['CLOSED_LISTED','POSSIBLY_CLOSED'].includes(job.availability_status))return null;
 try{
  const u=new URL(job.official_url);
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||
     !host.includes('.')||/^(?:localhost|.*\.(?:local|internal|test|invalid|example|onion))$/i.test(host)||
     /^\d+\.\d+\.\d+\.\d+$/.test(host)||
     isCommercialRecruitmentBoard(u.href)||
     recruitmentSourceKind(u.href)==='THIRD_PARTY_BOARD')return null;
  return u.href;
 }catch{return null;}
}
