import { useState } from 'react';
import { Building2, ImageOff, UserRound } from 'lucide-react';
import type { EmployerIdentity } from '../services/companyDirectory';
import {
 commonsCredit, commonsImage, visualProfileFor,
 type CommonsPhoto, type VisualLanguage
} from '../services/companyVisualProfiles';
import '../styles/company-visual-story.css';

function CreditedPhoto({photo,lang,portrait=false}:{
 photo:CommonsPhoto;lang:VisualLanguage;portrait?:boolean
}){
 const [broken,setBroken]=useState(false);
 const src=commonsImage(photo,portrait?420:780);
 const page=commonsCredit(photo);
 return <div className={'company-visual-photo'+(portrait?' is-portrait':'')}>
  {!broken&&src?<img src={src} alt={photo.caption[lang]}
    loading="lazy" decoding="async" referrerPolicy="no-referrer"
    width={portrait?360:780} height={portrait?420:480} onError={()=>setBroken(true)}/>:
   <div className="company-visual-media-unavailable" role="status">
    <ImageOff size={24} aria-hidden="true"/>
    {lang==='zh'?'图片暂时无法加载':'Image temporarily unavailable'}
   </div>}
  <div className="company-visual-credit">
    {page?<span title={lang==='zh'?'图片作者及授权信息':'Image author and license'}>
      {photo.author} · {photo.license}
    </span>:<span>{lang==='zh'?'图片来源未核实':'Image source unverified'}</span>}
  </div>
 </div>;
}
export function CompanyVisualStory({identity,lang}:{
 identity:EmployerIdentity;lang:VisualLanguage
}){
 const profile=visualProfileFor(identity);
 if(!profile)return null;
 return <>
  <section className="company-profile-section company-visual-section" data-visual-people>
   <div className="company-visual-heading">
    <div><h2>{lang==='zh'?'创始人与核心创办团队':'Founders and founding team'}</h2>
     <p>{lang==='zh'
       ?'人物身份根据企业公开资料整理；照片仅来自已标注作者和开放许可证的历史影像。'
       :'Founder identities are sourced from public company materials; portraits have attributed open licenses.'}</p></div>
   </div>
   {profile.relationship&&<p className="company-visual-affiliation">{profile.relationship[lang]}</p>}
   {profile.people.length? <div className="company-visual-people-grid">
    {profile.people.map(person=><article key={person.name} className="company-visual-person">
     {person.photo?<CreditedPhoto photo={person.photo} portrait lang={lang}/>:
      <div className="company-visual-unavailable-portrait">
       <UserRound size={28} aria-hidden="true"/>
       <span>{lang==='zh'?'肖像待核实':'Portrait not yet reviewed'}</span>
      </div>}
     <div className="company-visual-person-details">
      <strong>{person.name}</strong><span>{person.role[lang]}</span>
      <span className="company-visual-identity-credit">
       {lang==='zh'?'人物身份来源已核对':'Founder identity source reviewed'}
      </span>
     </div>
    </article>)}
   </div>:<div className="company-visual-unknown">
    <UserRound size={20} aria-hidden="true"/>
    <span>{lang==='zh'
      ?'该招聘来源的创办团队尚未通过独立资料核实，暂不填写人物或照片。'
      :'Founding-team information for this recruiting source has not passed review.'}</span>
   </div>}
  </section>
  <section className="company-profile-section company-visual-section" data-visual-workplace>
   <div className="company-visual-heading">
    <div><h2>{lang==='zh'?'公司办公环境与建筑':'Workplaces and buildings'}</h2>
     <p>{lang==='zh'
       ?'真实照片会注明拍摄年份和地点；历史办公楼不代表企业现在仍在此办公。'
       :'Real photos show when and where they were taken; historical offices are not represented as current headquarters.'}</p></div>
   </div>
   {profile.workplaces.length?<div className="company-visual-workplace-grid">
    {profile.workplaces.map(photo=><figure key={photo.file} className="company-visual-workplace">
      <CreditedPhoto photo={photo} lang={lang}/>
      <figcaption><strong>{photo.caption[lang]}</strong>
       <span><Building2 size={13} aria-hidden="true"/>{photo.location[lang]} · {photo.takenAt?.slice(0,7)}</span>
      </figcaption>
     </figure>)}
   </div>:<div className="company-visual-unknown">
    <Building2 size={20} aria-hidden="true"/>
    <span>{lang==='zh'
      ?'暂未找到可以核实地点、时间和使用许可的真实办公照片，不使用图库照片替代。'
      :'No workplace photograph with verified place, date and reuse license is available yet.'}</span>
   </div>}
  </section>
 </>;
}
