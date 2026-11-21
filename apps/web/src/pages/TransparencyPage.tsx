import {useEffect,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,ShieldCheck,X} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import {commitmentGallery,type CommitmentPhoto} from '../data/commitmentGallery';
import '../styles/commitment-wall.css';

/** Editorial brand page: no funding, case success or partner endorsement claims. */
const principles=[
 {number:'01',eyebrow:'INFORMATION',title:'让信息，更清楚。',detail:'帮助求职者理解岗位要求、工作内容与招聘渠道；鼓励以企业官方信息核验关键细节。',href:'/candidate/jobs',action:'探索职业机会'},
 {number:'02',eyebrow:'CHOICE',title:'让选择，更有依据。',detail:'通过简历理解、岗位适配和针对性优化建议，让求职者看见自己的能力，也保留最终选择权。',href:'/candidate/match',action:'了解智能匹配'},
 {number:'03',eyebrow:'RIGHTS',title:'让权益，被认真对待。',detail:'免费提供劳动合同、工资、社保与争议处理等一般知识；有具体法律问题时，以官方渠道或专业人士意见为准。',href:'/rights/knowledge',action:'阅读劳动权益知识'}
] as const;

export function TransparencyPage({user}:{user:User|null}){
 const [activePhoto,setActivePhoto]=useState<CommitmentPhoto|null>(null);
 useEffect(()=>{
  // All links to retired public finance pages lead to the canonical brand wall.
  if(window.location.pathname.startsWith('/transparency'))navigate('/commitment');
 },[]);
 useEffect(()=>{
  if(!activePhoto)return;
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setActivePhoto(null);};
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[activePhoto]);

 return <Shell user={user}>
  <main className="hhba-commitment-wall" id="main-content">
   <nav className="hhba-commitment-crumb" aria-label="当前位置"><Link to="/">HHBA 首页</Link><span>/</span><span>我们的坚持</span></nav>
   <header className="hhba-commitment-hero" aria-labelledby="hhba-commitment-heading">
    <div className="hhba-commitment-hero-copy">
     <p className="hhba-commitment-eyebrow">HHBA / OUR COMMITMENT</p>
     <h1 id="hhba-commitment-heading">每一份职业选择，<br/><em>都值得被认真守护。</em></h1>
     <p className="hhba-commitment-lead">从寻找机会，到走进职场。我们希望让信息更加清晰、选择更加自主，让每一位认真生活的人，都能获得应有的尊重。</p>
     <a href="#hhba-commitment-belief" className="hhba-commitment-scroll">阅读我们的主张 <ArrowDown size={17} aria-hidden="true"/></a>
    </div>
    <div className="hhba-commitment-hero-art" aria-hidden="true">
     <div className="hhba-commitment-orbit hhba-commitment-orbit-outer"/>
     <div className="hhba-commitment-orbit hhba-commitment-orbit-middle"/>
     <div className="hhba-commitment-orbit hhba-commitment-orbit-inner"/>
     <span className="hhba-commitment-orbit-mark">H.</span>
     <span className="hhba-commitment-art-caption">BEYOND THE NEXT OPPORTUNITY / 2026</span>
    </div>
    <div className="hhba-commitment-hero-bottom"><span>HHBA · HUMAN CAPABILITY NETWORK</span><span>让机会与人才，找到彼此。</span></div>
   </header>

   <section id="hhba-commitment-belief" className="hhba-commitment-belief hhba-commitment-section" aria-labelledby="hhba-commitment-belief-title">
    <div className="hhba-commitment-section-label"><span>01 / WHY WE CARE</span><i aria-hidden="true"/></div>
    <div className="hhba-commitment-belief-grid">
     <h2 id="hhba-commitment-belief-title">找工作，<br/>不应该是一场<br/><em>信息不对等的冒险。</em></h2>
     <div><p>一个人的职业生活，往往从一次搜索、一份简历、一次投递开始。重要的并不只是找到某个岗位，更是了解它、判断它，并自主作出选择。</p><p>HHBA 希望用技术和可靠的公开信息，帮助求职者减少不必要的迷茫；在职业旅程向前延伸时，继续关注劳动者的正当权益。</p><blockquote>“每一次认真选择，都值得被认真对待。”</blockquote></div>
    </div>
   </section>

   <section className="hhba-commitment-work hhba-commitment-section" aria-labelledby="hhba-commitment-work-title">
    <div className="hhba-commitment-section-label"><span>02 / WHAT WE DO</span><i aria-hidden="true"/></div>
    <div className="hhba-commitment-work-head">
     <h2 id="hhba-commitment-work-title">把重视，放进实际的服务里。</h2>
     <p>不以空泛的承诺代替产品。已经开放的功能可以体验，仍在规划中的服务会明确说明状态。</p>
    </div>
    <div className="hhba-commitment-principles">
     {principles.map(item=><article className="hhba-commitment-principle" key={item.number}>
      <div className="hhba-commitment-principle-top"><span>{item.number}</span><small>{item.eyebrow}</small></div>
      <h3>{item.title}</h3><p>{item.detail}</p>
      <Link to={item.href}>{item.action}<ArrowUpRight size={17} aria-hidden="true"/></Link>
     </article>)}
    </div>
    <p className="hhba-commitment-status"><ShieldCheck size={16} aria-hidden="true"/> 职业与劳动法律支持会员、个案受理及律所委托尚未开放。本站免费知识不代替具体法律咨询，也不承诺招聘录用或维权结果。</p>
   </section>

   <section id="hhba-commitment-gallery" className="hhba-commitment-gallery hhba-commitment-section" aria-labelledby="hhba-commitment-gallery-title">
    <div className="hhba-commitment-section-label"><span>03 / EDITORIAL WALL</span><i aria-hidden="true"/></div>
    <div className="hhba-commitment-gallery-head"><div><p className="hhba-commitment-gallery-overline">HHBA / VISUAL STORIES</p><h2 id="hhba-commitment-gallery-title">让真实的影像，<br/><em>记录每一段职业旅程。</em></h2></div><p>这是一面持续完善的品牌影像墙。未来只展示经授权使用的真实照片和明确标注的品牌创作，不把视觉表达冒充服务成果。</p></div>
    <div className="hhba-commitment-photo-grid">
     {commitmentGallery.map(photo=><figure className={'hhba-commitment-photo hhba-commitment-photo--'+photo.id} key={photo.id}>
      {photo.src?<button type="button" className="hhba-commitment-photo-open" onClick={()=>setActivePhoto(photo)} aria-label={'放大查看：'+photo.title}>
       <img src={photo.src} alt={photo.alt||photo.title} loading="lazy"/>
       <span className="hhba-commitment-photo-zoom">查看影像 <ArrowUpRight size={16} aria-hidden="true"/></span>
      </button>:<div className="hhba-commitment-photo-art" aria-label="品牌影像位置，照片尚待上传">
       <span className="hhba-commitment-photo-art-index">{photo.id} / HHBA</span>
       <span className="hhba-commitment-photo-art-line" aria-hidden="true"/>
       <span className="hhba-commitment-photo-art-note">IMAGE STORY<br/>COMING SOON</span>
      </div>}
      <figcaption><span>{photo.eyebrow}</span><strong>{photo.title}</strong><small>{photo.caption}</small></figcaption>
     </figure>)}
    </div>
    <p className="hhba-commitment-photo-note">影像展位 · 待上传真实照片。当前为品牌视觉占位，不代表真实活动或案例。</p>
   </section>

   <section className="hhba-commitment-ending" aria-label="HHBA 品牌寄语">
    <p>OUR BELIEF / HHBA</p>
    <h2>世界很大，<br/>你的下一步，值得认真选择。</h2>
    <div><span>让机会与人才，找到彼此。</span><Link to="/candidate/jobs">去寻找新的机会 <ArrowRight size={19} aria-hidden="true"/></Link></div>
   </section>
  </main>
  {activePhoto&&<div className="hhba-commitment-lightbox" onClick={()=>setActivePhoto(null)}>
   <div className="hhba-commitment-lightbox-dialog" role="dialog" aria-modal="true" aria-label={activePhoto.title} onClick={event=>event.stopPropagation()}>
    <button type="button" className="hhba-commitment-lightbox-close" onClick={()=>setActivePhoto(null)} aria-label="关闭照片预览"><X size={23} aria-hidden="true"/></button>
    <img src={activePhoto.src} alt={activePhoto.alt||activePhoto.title}/>
    <p>{activePhoto.title}</p>
   </div>
  </div>}
 </Shell>;
}
