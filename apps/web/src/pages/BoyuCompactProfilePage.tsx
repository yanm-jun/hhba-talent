import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
const images=import.meta.env.BASE_URL+'images/boyu-user/';
const business=[
 ['集中式长租公寓运营','为城市青年和新市民提供长租公寓及门店经营管理。','招租服务、租务经营、客户体验'],
 ['青年社区与社群服务','运营兼具社交、学习及生活体验的居住社区。','社区活动、公共空间、客户服务'],
 ['租赁住宅产品设计','提供青年公寓、多人宿舍和中高端服务式公寓产品。','空间设计、居住产品、更新改造'],
 ['保障性租赁住房','与城市政府、机构合作提供保障性租赁住房运营服务。','保障性租赁住房、人才安居、公共合作'],
 ['数字化租住服务','数字化看房、签约、房态管理及维修服务。','数字签约、租赁平台、设施运维'],
 ['企业宿舍与资产运营','满足企业住宿需求并协助相关租赁物业运营。','企业住宿、资产管理、运营协同']
];
export function BoyuCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();const [expanded,setExpanded]=useState(false);
 return <Shell user={user}><article className="company-profile hhba-kpmg-compact hhba-boyu-compact" data-company-template="openai" data-domestic-rebuild="v2" data-employer-id="cn-autumn-011">
 <nav className="company-profile-top" aria-label="企业详情导航"><Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link><Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link></nav>
 <section className="hhba-kpmg-hero">
 <header className="hhba-kpmg-identity">
 <div className="hhba-kpmg-logo"><img src={images+'boyu-logo.webp'} alt="用户提供的橙色万科泊寓 PORT APARTMENT 品牌标识" loading="eager"/></div>
 <div className="hhba-kpmg-identity-copy"><span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span><h1>万科泊寓 <span>PORT APARTMENT</span></h1><p>万科集团长租公寓品牌 · 青年租住 · 公寓运营 · 保障性租赁住房</p></div>
 <a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true" href="https://career.tjcu.edu.cn/company/index/id/5132.html" rel="noopener noreferrer" target="_blank">核实的招聘来源 <ExternalLink size={14}/></a>
 </header>
 <div className="hhba-kpmg-photo-grid">
 <figure><img src={images+'boyu-exterior.webp'} alt="用户上传的泊寓门店外立面与休憩区" loading="eager"/><figcaption><span>泊寓公寓门店</span><small>用户上传照片 · 具体门店位置未核验</small></figcaption></figure>
 <figure><img src={images+'boyu-lobby.webp'} alt="用户上传的泊寓前台和公共空间" loading="eager"/><figcaption><span>公寓前台及公共空间</span><small>用户上传照片 · 拍摄时间未核验</small></figcaption></figure></div>
 <p className="hhba-hypergryph-photo-note">照片均为用户提供的独立图片，点击照片不跳转第三方网站。2027届全国万寓生校园招聘为独立项目，不与天津两条具体岗位混同。</p>
 </section>
 <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-011" majorIntro="已收录天津市万泊商业运营管理有限公司于2026年9月11日公开的2条具体岗位，其中“万寓生”明确专业不限，“泊寓运营官”有部分优先专业。尚未核验实时可投递状态；岗位归属天津招聘主体，不代表万科集团其他业务。" quickMajorNames={['酒店管理','市场营销','工商管理','物业管理','工程管理','计算机科学与技术','财务管理','环境设计']}/>
 <section className="hhba-kpmg-section" aria-labelledby="boyu-business-title"><div className="hhba-kpmg-section-heading"><div><h2 id="boyu-business-title">主要业务与专业服务</h2><p>参考泊寓官网与万科集团的租赁住宅资料编辑，业务方向不等于具体招聘岗位。</p></div></div>
 <div className="hhba-kpmg-service-grid">{business.slice(0,expanded?6:4).map((b,i)=><article className="hhba-kpmg-service" key={b[0]}><span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span><h3>{b[0]}</h3><p>{b[1]}</p><span className="hhba-kpmg-service-tags">{b[2]}</span><details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail">{b[1]}</div></details></article>)}</div>
 <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(v=>!v)}>{expanded?'收起其他业务':'查看更多业务（共 6 项）'} <ChevronDown size={15}/></button></section>
 </article></Shell>;
}