import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarHeart,
  CheckCircle2, ChevronDown, Clock3, Coins, GraduationCap, Handshake,
  HeartHandshake, Info, ShieldPlus, Sparkles, UsersRound, Wallet
} from 'lucide-react';
import { Shell } from '../components/Shell';
import { Link } from '../router';
import type { User } from '../services/api';

const values = [
  { icon: BriefcaseBusiness, title: '连接更广阔的机会', description: '让人才看到更丰富的职业机会，不让能力被信息差埋没。' },
  { icon: HeartHandshake, title: '认真对待劳动者', description: '关注企业实际表现与员工体验，而不是只展示漂亮的招聘广告。' },
  { icon: Sparkles, title: '让技术真正有用', description: '使用 AI 与产品设计，降低求职者和招聘方之间的沟通成本。' },
  { icon: Handshake, title: '与建设者分享成长', description: '努力让长期参与建设的人获得尊重、成长和合理回报。' },
];

const benefits = [
  { icon: Wallet, title: '有竞争力的薪资', description: '希望在资金与经营条件允许时，提供与岗位价值和实际贡献相匹配的正式薪酬。' },
  { icon: Coins, title: '长期股权激励', description: '探索早期成员的股权或期权激励方案，具体权益、比例与归属条件须依法另行书面约定。' },
  { icon: ShieldPlus, title: '六险二金的保障目标', description: '在法定社会保险和住房公积金基础上，研究补充医疗、企业年金等更全面的保障。' },
  { icon: Clock3, title: '弹性与远程协作', description: '尊重工作与生活的边界。根据岗位实际情况探索弹性时间、远程办公与结果导向的协作。' },
  { icon: CalendarHeart, title: '更充分的休息', description: '倡导不以无意义加班衡量贡献，未来争取更完善的带薪休假与健康关怀。' },
  { icon: GraduationCap, title: '学习与共同决策', description: '鼓励持续学习、跨职能实践和参与关键产品决策，为专业成长创造空间。' },
];

const roles = [
  {
    id:'tech-lead', team:'技术架构', priority:'P0 · 优先寻找', title:'技术负责人 / 全栈架构工程师',
    desc:'统筹从 GitHub 静态预览走向可安全运营的 HHBA 正式产品。',
    mission:'为网站、企业端、管理后台建立统一且可维护的生产技术架构，带领团队完成真正可用的产品闭环。',
    responsibilities:[
      '梳理现有 React 前端、Python / TypeScript 后端、Railway 服务与数据库，制定分阶段上线方案和技术规范。',
      '打通求职者及企业身份认证、角色权限、企业入驻、岗位管理和审核业务，不让静态演示冒充正式功能。',
      '负责技术方案评审、代码治理、自动化测试、部署回滚、生产故障响应和基础信息安全。',
      '评估 Railway 与国内云部署的实际成本、合规边界及运维可行性。'
    ],
    required:[
      '有独立交付并维护完整 Web 产品的实践经历；熟悉 React、TypeScript，以及 Node.js 或 Python 后端。',
      '掌握 PostgreSQL、REST API、鉴权与会话安全、日志监控、备份恢复和常见 Web 安全问题。',
      '能够拆解复杂业务、作出技术取舍，并用代码评审、测试与文档推动实际交付。',
      '不以学历或学校作为硬性门槛，能通过项目成果证明能力。'
    ],
    preferred:['有从 MVP 到正式上线的技术负责人经历。','了解低成本云架构、国内网站部署与个人信息保护要求。'],
    challenge:'请讲述一个由你主导上线的系统：如何设计权限与数据库、定位一次故障，以及出现问题后如何回滚。',
    cooperation:'早期核心合作方向；可远程沟通，具体每周投入和负责人职责由双方协商确定。',
    priorityNote:'首批重点接触；希望优先找到能把整个技术底盘负责起来的人。'
  },
  {
    id:'backend', team:'后端与数据库', priority:'P0 · 优先寻找', title:'后端与数据库工程师',
    desc:'让企业入驻、证据核验、审核、申诉与合作申请真正落库运行。',
    mission:'把已设计的业务规则实现为可审计、可授权、可恢复的后端服务，而不是只有页面和模拟数据。',
    responsibilities:[
      '设计企业、招聘经办人、候选人、岗位、申请、证据、申诉、评分和审批记录的数据结构与迁移。',
      '实现注册登录、权限隔离、审核队列、状态流转、文件上传与对象存储访问控制。',
      '接通统一管理后台的真实 API，保证重要操作有日志、幂等与权限校验。',
      '建立接口测试、数据备份和监控告警，避免生产数据丢失或越权访问。'
    ],
    required:[
      '掌握 Python（FastAPI 等）或 TypeScript（Node.js）至少一种后端技术栈。',
      '熟悉 PostgreSQL、SQL、事务、一致性、数据库迁移、索引和基础性能调优。',
      '理解身份验证、RBAC、敏感数据保护、输入验证及接口自动化测试。',
      '能够写出清楚的接口文档和异常处理逻辑。'
    ],
    preferred:['熟悉对象存储、验证码接入、异步任务或审计日志。','参与过招聘系统、SaaS 或多组织权限平台开发。'],
    challenge:'说明如何实现一条企业材料审核流程，既支持撤回和申诉，又不能让提交人审核自己的资料。',
    cooperation:'早期研发合作方向；支持远程协作，具体工时与任务范围需书面确认。',
    priorityNote:'与技术负责人协同，但可以由一位有能力的全栈工程师在早期兼任。'
  },
  {
    id:'ai-data', team:'招聘数据与 AI', priority:'P0 · 优先寻找', title:'招聘数据与 AI 搜索工程师',
    desc:'提升真实岗位的覆盖、去重、时效性、中英文检索与匹配质量。',
    mission:'让 HHBA 的招聘搜索建立在可靠的官方公开数据上，让用户能够快速找到真实且符合条件的岗位。',
    responsibilities:[
      '改进 Greenhouse、Lever、Ashby 等公开岗位源的数据接入、更新时间记录和异常追踪。',
      '完成岗位去重、过期下架、原链接核验、结构化字段提取、中英文规范化与数据质量检测。',
      '建设关键词检索、国家和城市筛选，以及后续语义召回、简历匹配的可解释结果。',
      '建立采集限速、来源权限和调用成本监控，避免抓取风险、虚假岗位与 AI 无依据生成。'
    ],
    required:[
      '熟悉 Python、SQL、数据清洗与批处理，能够处理多来源、不一致的结构化数据。',
      '了解搜索、全文索引、召回排序或向量检索的基本原理。',
      '熟悉 API 接入、重试、去重、监控及自动化质量检查。',
      '理解数据来源可追溯、个人信息最小化和 AI 结果可验证的重要性。'
    ],
    preferred:['接触过公开 ATS Job Board API 与招聘岗位数据。','有跨语言搜索、pgvector、Elasticsearch 或信息抽取项目经验。'],
    challenge:'设计一条官方岗位同步链：同岗位换 ID、岗位下线、JD 缺失和中文搜索时，如何避免展示错误结果。',
    cooperation:'早期技术合作方向；支持远程协作，可与后端共同约定数据质量目标。',
    priorityNote:'优先修复数据质量与搜索基础，再考虑复杂 AI 功能。'
  },
  {
    id:'governance', team:'企业治理与劳动权益', priority:'P1 · 核心机制', title:'企业治理与劳动权益研究伙伴',
    desc:'把员工反馈、证据核验、企业双评分与申诉处理做得可信、公平。',
    mission:'建立一套能保护劳动者、鼓励企业改进、同时避免无依据指控的企业责任评价规则。',
    responsibilities:[
      '参与设计员工匿名反馈、证据分级、利益冲突回避、企业申诉和公开展示的审核规范。',
      '协助制定企业劳动保障与员工善待评价指标，确保规则可解释、可申诉、可复核。',
      '梳理员工隐私保护、材料保存期限、信息披露和风险处置流程。',
      '建立企业真实改善记录的核验方法，防止“付费买高分”和商业合作干预独立评价。'
    ],
    required:[
      '具备劳动关系、法学、人力资源、合规、审计或平台治理相关知识与分析能力。',
      '能够独立梳理事实、识别证据缺口，并撰写明确且可操作的规则文档。',
      '具有保密意识、隐私保护意识和处理利益冲突的判断能力。',
      '认同基于事实的公正评价，而非简单站在任何一方。'
    ],
    preferred:['参与过劳动争议调解、人力资源合规、员工调查或平台申诉流程。','了解个人信息保护、网络招聘及数据治理的监管要求。'],
    challenge:'面对一份员工投诉和企业不同解释，你会如何补充证据、保护反馈者并给双方公平申诉机会？',
    cooperation:'早期研究与制度设计合作；独立审核权限须与企业销售职责分离，正式裁决机制另行建立。',
    priorityNote:'建议尽早加入制度设计；涉及正式法律意见的事项仍需由合格专业人士复核。'
  },
  {
    id:'business', team:'企业合作与商业发展', priority:'P1 · 业务增长', title:'企业合作与商业发展伙伴',
    desc:'连接优质企业、发展帮扶需求和可验证的商业合作机会。',
    mission:'帮助负责任、愿意持续改善的企业被更多人才和合作方看见，探索 HHBA 可持续的商业模式。',
    responsibilities:[
      '沟通企业需求，拓展企业入驻、合作伙伴与潜在客户资源。',
      '整理企业发展帮扶申请、客户授权、商机进展与订单证明，推动透明的业务跟进。',
      '基于真实产品能力制定合作方案、服务流程和收入验证方式。',
      '将企业反馈整理给产品团队，不以成交、付费或关系干预企业评分。'
    ],
    required:[
      '擅长 B2B 沟通、客户需求分析、合作谈判、项目推进及过程记录。',
      '能够自行开拓资源，清楚解释 HHBA 的价值与当前尚未上线的能力。',
      '坚持真实承诺与客户隐私保护，不虚构企业合作、融资或订单数据。',
      '具备分析合作效果、复盘商机失败原因的能力。'
    ],
    preferred:['有企业服务、招聘科技、SaaS、HR 服务或商业资源对接经验。','了解合同边界、客户授权与商机跟进管理。'],
    challenge:'如果一家企业希望付费获得更高的善待员工评分，你如何回应，并给出合规且有价值的合作方案？',
    cooperation:'早期商业探索合作；企业合作条件、费用和可能的绩效安排均需双方另行明确。',
    priorityNote:'平台真实能力和规则稳定后逐步拓展；不能向客户保证订单数量。'
  },
  {
    id:'product', team:'产品与用户体验', priority:'P1 · 用户体验', title:'产品设计 / 前端体验伙伴',
    desc:'把复杂的招聘、企业端、员工反馈和管理后台做得更清晰易用。',
    mission:'用优秀的产品设计让求职者、企业经办人、员工和审核人员都能顺畅完成各自任务。',
    responsibilities:[
      '梳理求职、企业入驻、岗位筛选、员工反馈、申诉和后台审核的完整用户流程。',
      '完善 Figma 设计规范、响应式布局、中文优先的信息呈现和可访问性。',
      '优化表单、状态提示、边界场景、错误说明及用户信任感。',
      '与工程师合作落地 React 界面，并通过真实用户反馈迭代。'
    ],
    required:[
      '能够独立完成信息架构、交互方案、原型设计和视觉规范。',
      '熟悉 Figma 或同类设计工具，理解移动端、响应式及无障碍设计。',
      '能把复杂规则解释成用户读得懂、操作得明白的页面。',
      '有可展示的产品案例、作品或前端实现经历。'
    ],
    preferred:['熟悉 React、TypeScript、CSS，能够与开发高效协同。','曾做过招聘、企业 SaaS、社区或后台产品体验优化。'],
    challenge:'展示一项你改进过的复杂业务流程：怎样降低填表成本，同时保证身份、隐私和流程告知清晰？',
    cooperation:'早期产品设计合作方向；可远程参加设计评审，交付与投入时间由双方协商。',
    priorityNote:'优先优化真实业务闭环，而不是只追求展示动效。'
  },
  {
    id:'other', team:'开放自荐', priority:'开放合作', title:'其他专业 / 自荐加入',
    desc:'不限于以上方向。如果你能解决 HHBA 的关键问题，欢迎告诉我们。',
    mission:'发现尚未被岗位清单覆盖的能力与长期合作可能。',
    responsibilities:['说明你看到的 HHBA 真实问题、改善思路以及能够承担的具体成果。','在初步沟通后再确定适合的专业方向和合作范围。'],
    required:['能够清楚介绍自己擅长什么、做过什么，以及希望解决的问题。','尊重事实、劳动者权益、信息安全和双方的时间。'],
    preferred:['能够提供作品、项目经验、研究案例或可验证的合作经历。'],
    challenge:'用一个真实项目或明确方案，解释你能帮助 HHBA 在未来三个月完成什么。',
    cooperation:'不预设职位、固定投入时间或待遇；具体合作以双方讨论及书面协议为准。',
    priorityNote:'开放接收早期专业交流和自荐意向。'
  }
] as const;

type Direction = typeof roles[number]['id'];
type FormData = {
  name: string; contactType: string; contact: string; direction: Direction | '';
  experience: string; portfolio: string; strength: string;
  weeklyTime: string; mode: string; note: string; acknowledged: boolean; privacyAgreed: boolean;
};
const blank: FormData = {
  name: '', contactType: '邮箱', contact: '', direction: '',
  experience: '', portfolio: '', strength: '',
  weeklyTime: '', mode: '', note: '', acknowledged: false, privacyAgreed: false,
};

function JumpButton({ onClick, secondary = false, children }: {
  onClick: () => void; secondary?: boolean; children: React.ReactNode
}) {
  return <button type="button" className={secondary ? 'join-btn join-btn-light' : 'join-btn join-btn-primary'} onClick={onClick}>
    {children}<ArrowUpRight size={16} aria-hidden="true" />
  </button>;
}


function BrandManifesto() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const elements = Array.from(section.querySelectorAll<HTMLElement>('[data-manifesto-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.06 });
    elements.forEach((element) => observer.observe(element));
    section.classList.add('join-manifesto-animate');
    return () => {
      observer.disconnect();
      section.classList.remove('join-manifesto-animate');
    };
  }, []);

  return <section ref={sectionRef} className="join-manifesto-section" id="join-manifesto" aria-labelledby="join-manifesto-title">
    <div className="join-manifesto-inner">
      <header className="join-manifesto-intro" data-manifesto-reveal>
        <p className="join-manifesto-eyebrow">A NOTE FROM HHBA'S FOUNDER</p>
        <h2 id="join-manifesto-title">让劳动更有尊严，让商业更有温度</h2>
      </header>
      <article className="join-manifesto-copy" aria-label="HHBA 品牌宣言全文">
        <p data-manifesto-reveal><strong>每一份简历背后，都是一个认真生活的人。</strong> 有人为了面试奔赴陌生的城市，有人一次次修改简历、等待回应，也有人只是希望通过自己的努力，换来一份稳定的收入和应有的尊重。</p>
        <p data-manifesto-reveal>但现实并不总是如此。虚假的招聘信息、不透明的薪酬待遇、迟迟没有回应的申请，让许多人的期待变成了失望。</p>
        <p data-manifesto-reveal>我们始终相信：<strong>求职者可以不被录用，但不应该被欺骗；员工可以承担责任，但不应该失去尊严；企业可以追求利润，但不应该忽视创造价值的人。</strong> 这正是我们创立 HHBA 的初心。</p>
        <p data-manifesto-reveal>我们不希望劳动者与企业彼此对立。我们相信，员工的幸福与企业的发展，从来不应该是一道单选题。我们希望通过技术与可信的信息，让招聘更加透明，让劳动者的声音被听见，让善待员工的企业获得更多认可，也让愿意改变的企业拥有改善的机会。</p>
        <p data-manifesto-reveal><strong>我们不只是希望发现问题，更希望推动问题得到解决。</strong> 我们也会从自己做起，将尊重、诚信与责任落实到每一次招聘、每一份协议和每一个决定中。</p>
        <p data-manifesto-reveal>我们知道，一个平台无法改变所有问题，但改变，总需要有人开始。<strong>愿每一份努力都被尊重，每一份善意都能得到回报。</strong></p>
        <p className="join-manifesto-closing" data-manifesto-reveal><strong>让劳动获得尊严，让招聘回归诚信。让善待劳动者，成为真正值得坚持的商业选择。</strong></p>
      </article>
      <footer className="join-manifesto-signoff" data-manifesto-reveal>
        <span className="join-manifesto-rule" aria-hidden="true" />
        <p className="join-manifesto-identity">HHBA — Human Capability Network</p>
        <p className="join-manifesto-tagline">让机会与人才，找到彼此。</p>
        <p className="join-manifesto-founder-label">创办者 · 闫明骏</p>
        <img className="join-manifesto-signature"
             src={import.meta.env.BASE_URL + 'images/hhba-founder-signature.webp'}
             alt="闫明骏的手写姓名签名" width={1185} height={503}
             decoding="async" loading="lazy" />
      </footer>
    </div>
  </section>;
}

export function JoinUsPage({ user }: { user: User | null }) {
  const rolesRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(blank);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [mailReady, setMailReady] = useState(false);
  const [mailChecking, setMailChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_HHBA_JOIN_API_ENABLED !== '1') {setMailChecking(false);return;}
    let alive = true;
    fetch('/api/v1/join/applications', {credentials:'same-origin'})
      .then(r=>r.ok?r.json():null)
      .then(r=>{if(alive)setMailReady(r?.ready===true)})
      .catch(()=>{if(alive)setMailReady(false)})
      .finally(()=>{if(alive)setMailChecking(false)});
    return ()=>{alive=false};
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(old => ({ ...old, [key]: value }));
    setError('');
    setPreview(false);
  };
  const jump = (ref: React.RefObject<HTMLElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const applyFor = (direction: Direction) => {
    update('direction', direction);
    setStep(0);
    jump(formRef);
  };
  const next = () => {
    if (step === 0) {
      if (!form.name.trim() || !form.contact.trim() || !form.direction) {
        setError('请先填写称呼、联系方式并选择合作方向。'); return;
      }
      if (form.name.trim().length > 80 || form.contact.trim().length > 180) {
        setError('请检查输入长度：称呼最多 80 字，联系方式最多 180 字。'); return;
      }
    }
    if (step === 1 && form.experience.trim().length < 10) {
      setError('请简单介绍相关能力或经历（至少 10 个字）。'); return;
    }
    setError('');
    setStep(s => Math.min(2, s + 1));
    jump(formRef);
  };
  const showPreview = () => {
    if (!form.weeklyTime || !form.mode || !form.acknowledged || !form.privacyAgreed) {
      setError('请填写合作安排，并确认已阅读创业阶段说明和个人信息处理说明。'); return;
    }
    setError('');
    setPreview(true);
    jump(formRef);
  };
  async function submitApplication() {
    setError('');
    if(!mailReady) { setError('申请邮件发送服务尚未配置完成，当前表单不会收集或保存真实申请。'); return; }
    if(!form.acknowledged || !form.privacyAgreed) {setError('请确认资料处理说明。');return;}
    setSending(true);
    try {
      const res = await fetch('/api/v1/join/applications', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,website:''})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.detail||'提交失败，请稍后再试。');
      if(data.ok!==true || data.mail_status!=='accepted')throw new Error('邮件尚未获发送服务接受，未确认投递。');
      setSubmittedId(data.application_id);
      setForm(blank);
      setPreview(false);
    }catch(e) {setError(e instanceof Error?e.message:'提交失败。');}
    finally {setSending(false);}
  }
  const selectedRole = roles.find(role => role.id === form.direction);
  return <Shell user={user}>
    <div className="join-page">
      <section className="join-hero" aria-labelledby="join-title">
        <div className="join-hero-main">
          <p className="join-kicker"><span className="join-kicker-dot" aria-hidden="true"/> HHBA · 早期核心团队招募</p>
          <h1 id="join-title">我们不只想帮人找到好工作。<br /><span>我们还想创造一家值得工作的公司。</span></h1>
          <p className="join-hero-desc">从尊重劳动者开始，从认真建设产品开始。我们正在寻找相信长期价值、愿意共同创造、也希望分享成果的同行者。</p>
          <div className="join-hero-actions">
            <JumpButton onClick={() => jump(rolesRef)}>了解合作机会</JumpButton>
            <Link className="join-btn join-btn-light" to="/vision">了解我们的理念 <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="join-stage-banner"><Info size={16} aria-hidden="true" /><span><strong>真实进展：</strong>HHBA 仍在公司筹备与融资前阶段，目前招募早期合作伙伴，尚未提供已落实的正式薪酬和股权方案。</span></div>
        </div>
        <figure className="join-hero-photo">
          <img src={import.meta.env.BASE_URL + 'images/hhba-join-team.webp'}
            alt="四位同事围绕笔记本电脑讨论项目的真实摄影照片"
            width={900} height={600} loading="eager" decoding="async" />
        </figure>
      </section>

      <section className="join-section" id="join-values" aria-labelledby="join-values-title">
        <div className="join-section-head">
          <p className="join-kicker">OUR MISSION</p>
          <h2 id="join-values-title">为什么是 HHBA？</h2>
          <p>人才不应该只是简历上的几行文字，企业也不应该只靠招聘广告证明自己。我们希望重新建立机会、人才与信任之间的连接。</p>
        </div>
        <div className="join-values-grid">
          {values.map(v => <article key={v.title} className="join-value-card">
            <span className="join-icon"><v.icon size={21} aria-hidden="true" /></span><h3>{v.title}</h3><p>{v.description}</p>
          </article>)}
        </div>
      </section>

      <section className="join-section join-benefits-section" aria-labelledby="join-benefits-title">
        <div className="join-section-head">
          <p className="join-kicker">PEOPLE FIRST</p>
          <h2 id="join-benefits-title">好的工作，不应该只属于别人。</h2>
          <p>如果 HHBA 要为劳动者创造价值，就应该先认真对待自己的团队。以下是我们未来努力建设的制度方向。</p>
        </div>
        <div className="join-benefits-grid">
          {benefits.map(b => <article key={b.title} className="join-benefit-card">
            <span className="join-icon join-benefit-icon"><b.icon size={21} aria-hidden="true" /></span>
            <h3>{b.title}</h3><p>{b.description}</p>
          </article>)}
        </div>
        <aside className="join-disclosure" aria-labelledby="join-disclosure-title">
          <ShieldPlus size={21} aria-hidden="true" />
          <div><h3 id="join-disclosure-title">关于当前阶段与待遇的说明</h3>
            <p>HHBA 尚未完成公司设立和融资。上述福利均属于<strong>未来制度建设目标，并非已经实施的待遇或确定的录用承诺</strong>。现阶段合作应先协商工作范围、投入时间、报酬和权利义务，并以适当的书面协议确定；正式薪酬、六险二金和股权激励需在具备法律及资金条件后依法安排，不能保证首笔融资必然发生或自动兑现。</p>
          </div>
        </aside>
      </section>

      <section className="join-section" ref={rolesRef} id="join-opportunities" aria-labelledby="join-roles-title">
        <div className="join-section-head">
          <p className="join-kicker">WORK WITH US</p>
          <h2 id="join-roles-title">寻找能够一起把事情做成的人。</h2>
          <p>根据 HHBA 目前在技术架构、后端数据、真实岗位搜索、企业治理和商业合作等方面的实际缺口制定招募方向。展开岗位可查看具体职责、专业要求、能力验证及当前合作条件。这些是早期合作意向，不是已确定薪资的正式招聘职位。</p>
        </div>
        <div className="join-role-priority-intro" role="note">
          <div><strong>当前最需要：技术负责人、后端数据库、招聘数据与搜索</strong><p>初期优先寻找 2–3 位能够承担关键交付的核心建设者，部分方向可以由同一位具备能力的人兼任。其他方向也欢迎提前交流。</p></div>
          <span>分阶段合作 · 能力与作品优先</span>
        </div>
        <div className="join-role-list">
          {roles.map(r => <details className="join-role" key={r.id}>
            <summary>
              <span className="join-role-identity">
                <span className="join-role-tags"><small>{r.team} · 早期合作方向</small><small className={r.priority.startsWith('P0') ? 'join-role-tag-priority' : 'join-role-tag-neutral'}>{r.priority}</small></span>
                <strong>{r.title}</strong><span>{r.desc}</span>
              </span>
              <ChevronDown className="join-role-chevron" size={21} aria-hidden="true"/>
            </summary>
            <div className="join-role-detail">
              <div className="join-role-mission"><span>岗位使命</span><p>{r.mission}</p></div>
              <div className="join-role-detail-grid">
                <section className="join-role-detail-block"><h4>你将负责什么</h4><ul>{r.responsibilities.map(item => <li key={item}>{item}</li>)}</ul></section>
                <section className="join-role-detail-block"><h4>我们希望你具备</h4><ul>{r.required.map(item => <li key={item}>{item}</li>)}</ul></section>
                <section className="join-role-detail-block"><h4>具备这些会更好</h4><ul>{r.preferred.map(item => <li key={item}>{item}</li>)}</ul></section>
                <section className="join-role-detail-block"><h4>合作方式与当前阶段</h4><p>{r.cooperation}</p><p>{r.priorityNote}</p></section>
              </div>
              <div className="join-role-sample"><strong>我们会如何了解你的能力</strong><p>{r.challenge}</p><span>以交流、已有项目和作品为主，不要求无偿完成可直接投入生产的试用项目。</span></div>
              <div className="join-role-compensation">
                <strong>薪酬与权益现状</strong>
                <p>目前尚未完成公司设立与融资，暂不提供已确定的工资数字、六险二金或股权比例。是否存在当前阶段报酬、具体金额、工作时间、交付与知识产权归属，必须在合作开始前协商并书面确认；未来制度目标不构成自动兑现承诺。</p>
              </div>
              <button type="button" onClick={() => applyFor(r.id)}>填写该方向合作意向 <ArrowRight size={16} aria-hidden="true"/></button>
            </div>
          </details>)}
        </div>
        <aside className="join-role-advisor-note" aria-label="外部专业顾问招募说明">
          <strong>此外，我们也需要外部专业顾问</strong>
          <p>劳动关系与股权激励法律顾问、个人信息与网络安全顾问，将以专项咨询或阶段性合作方式寻找，并非当前承诺的全职职位。法律意见与安全审查应由具备相应专业能力的人员独立完成。</p>
        </aside>
      </section>

      <section className="join-section join-progress-section" aria-labelledby="join-progress-title">
        <div className="join-section-head">
          <p className="join-kicker">WHERE WE ARE</p>
          <h2 id="join-progress-title">坦诚告诉你，我们走到了哪里。</h2>
          <p>我们不把尚未发生的事包装成已经取得的成绩。每一步成长，都希望与你共同见证。</p>
        </div>
        <ol className="join-timeline">
          <li><span className="join-step-dot join-step-current"><CheckCircle2 size={17}/></span><div><small>正在推进</small><h3>产品建设与系统研发</h3><p>HHBA 招聘市场、企业业务与管理系统正在持续开发和验证。</p></div></li>
          <li><span className="join-step-dot join-step-current"><UsersRound size={17}/></span><div><small>当前招募</small><h3>寻找早期合作伙伴</h3><p>邀请能独立负责关键方向的建设者，先把合作方式和真实条件说清楚。</p></div></li>
          <li><span className="join-step-dot"><BriefcaseBusiness size={17}/></span><div><small>未来目标</small><h3>公司设立与融资</h3><p>公司筹备和融资尚未完成。进度将以实际情况为准，不做确定性承诺。</p></div></li>
          <li><span className="join-step-dot"><BadgeCheck size={17}/></span><div><small>长期目标</small><h3>完善正式团队与福利制度</h3><p>在合法合规、资金允许的条件下，逐步落实薪酬保障与长期激励。</p></div></li>
        </ol>
      </section>

      <BrandManifesto />

      <section className="join-section join-apply-section" id="join-apply" ref={formRef} aria-labelledby="join-apply-title">
        <div className="join-section-head">
          <p className="join-kicker">SAY HELLO</p>
          <h2 id="join-apply-title">告诉我们，你想一起做什么。</h2>
          <p>三步填写加入或合作意向；邮件服务接通后，申请将安全存入 HHBA 数据库，并向负责人指定邮箱发送申请通知。</p>
        </div>
        <div className="join-form-shell">
          <div className="join-form-progress" aria-label="合作意向步骤">
            {['基本信息','专业能力','合作意向'].map((label,i) => <span className={i===step ? 'is-current' : i<step ? 'is-complete' : ''} key={label}><b>{i<step ? '✓' : String(i+1).padStart(2,'0')}</b>{label}</span>)}
          </div>
          {submittedId ? <div className="join-form-body join-form-preview" role="status">
            <span className="join-icon"><CheckCircle2 size={23}/></span><h3>申请已提交</h3>
            <p>申请记录已保存，通知邮件已被发送服务接受。最终邮件送达仍取决于收件服务。</p>
            <p>申请编号：<strong>{submittedId}</strong>，建议保存编号便于后续查询。</p>
            <button type="button" className="join-btn join-btn-light" onClick={()=>{setSubmittedId(null);setStep(0);setForm(blank)}}>返回申请表 <ArrowLeft size={16}/></button>
          </div> : preview ? <div className="join-form-body join-form-preview">
            <span className="join-icon"><CheckCircle2 size={23}/></span>
            <h3>合作意向预览</h3>
            <p className="join-preview-warning">{mailReady ? '请核对申请信息。点击“确认并提交”后才会保存资料并发出负责人邮件通知。' : '邮件接收通道尚未连接，当前只是浏览器内的填写摘要，未发送、未存入数据库。'}</p>
            <dl>
              <div><dt>称呼</dt><dd>{form.name.trim()}</dd></div>
              <div><dt>合作方向</dt><dd>{selectedRole?.title || '—'}</dd></div>
              <div><dt>每周投入</dt><dd>{form.weeklyTime}</dd></div>
              <div><dt>合作偏好</dt><dd>{form.mode}</dd></div>
            </dl>
            <div className="join-form-actions"><button type="button" className="join-btn join-btn-light" onClick={() => {setPreview(false);setStep(0)}}>返回修改 <ArrowLeft size={16}/></button>
              <button className="join-btn join-btn-primary" type="button" disabled={!mailReady || sending} onClick={submitApplication}>{sending?'正在安全提交…':'确认并提交'} <ArrowRight size={16}/></button>
            </div>
            {error && <p className="join-form-error" role="alert">{error}</p>}
            {!mailReady && <p className="join-form-security">{mailChecking?'正在确认投递服务状态…':'邮件投递服务尚未配置，暂不能接收真实申请。'}</p>}
          </div> : <form className="join-form-body" onSubmit={e => {e.preventDefault(); if(step<2)next();else showPreview()}} noValidate>
            {step === 0 && <>
              <h3>先认识一下你</h3><p className="join-form-description">建议填写可供联系的称呼；只有投递服务开放后才可正式提交。</p>
              <label htmlFor="join-name">怎么称呼你？ <em>*</em></label>
              <input id="join-name" value={form.name} maxLength={80} autoComplete="off" onChange={e=>update('name',e.target.value)} placeholder="姓名或常用称呼" />
              <div className="join-field-row">
                <div><label htmlFor="join-contact-type">联系方式类别 <em>*</em></label><select id="join-contact-type" value={form.contactType} onChange={e=>update('contactType',e.target.value)}><option>邮箱</option><option>微信</option><option>手机号</option><option>其他</option></select></div>
                <div><label htmlFor="join-contact">联系方式 <em>*</em></label><input id="join-contact" autoComplete="off" maxLength={180} value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="用于回复申请，不对外公开" /></div>
              </div>
              <label htmlFor="join-direction">你希望参与哪个方向？ <em>*</em></label>
              <select id="join-direction" value={form.direction} onChange={e=>update('direction',e.target.value as Direction | '')}>
                <option value="">请选择合作方向</option>{roles.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </>}
            {step === 1 && <>
              <h3>你最擅长解决什么问题？</h3><p className="join-form-description">不看头衔堆砌，更想了解你做过什么、擅长什么。</p>
              <label htmlFor="join-experience">相关技能和项目经历 <em>*</em></label>
              <textarea id="join-experience" value={form.experience} onChange={e=>update('experience',e.target.value)} maxLength={1200} rows={5} placeholder="分享一个你真正推动过的项目，至少 10 字" />
              <label htmlFor="join-strength">你希望在 HHBA 解决的问题</label>
              <textarea id="join-strength" value={form.strength} onChange={e=>update('strength',e.target.value)} maxLength={600} rows={3} placeholder="比如：让企业入驻流程更简单，或让岗位搜索更准确" />
              <label htmlFor="join-portfolio">作品 / GitHub / 作品集链接（选填）</label>
              <input id="join-portfolio" type="url" value={form.portfolio} onChange={e=>update('portfolio',e.target.value)} maxLength={400} placeholder="https://（不要填写私人文档的访问密钥）" />
            </>}
            {step === 2 && <>
              <h3>聊聊你想如何一起参与</h3><p className="join-form-description">合作方式及实际权益必须在正式沟通时另行确认。</p>
              <div className="join-field-row">
                <div><label htmlFor="join-time">每周预计可以投入多久？ <em>*</em></label><select id="join-time" value={form.weeklyTime} onChange={e=>update('weeklyTime',e.target.value)}><option value="">请选择</option><option>每周 1–5 小时</option><option>每周 6–15 小时</option><option>每周 16–30 小时</option><option>每周 30 小时以上</option><option>待进一步沟通</option></select></div>
                <div><label htmlFor="join-mode">理想合作方式 <em>*</em></label><select id="join-mode" value={form.mode} onChange={e=>update('mode',e.target.value)}><option value="">请选择</option><option>远程协作</option><option>线上线下结合</option><option>未来正式岗位</option><option>灵活协商</option></select></div>
              </div>
              <label htmlFor="join-note">还想告诉我们什么？</label>
              <textarea id="join-note" value={form.note} onChange={e=>update('note',e.target.value)} maxLength={600} rows={3} placeholder="例如协作时间、对项目的想法或想先交流的问题" />
              <label className="join-agreement"><input type="checkbox" checked={form.acknowledged} onChange={e=>update('acknowledged',e.target.checked)}/><span>我已阅读并理解：HHBA 仍处于公司筹备及融资前阶段；福利与股权仅为未来目标，具体合作报酬及权益需另行书面约定。<em> *</em></span></label>
              <label className="join-agreement"><input type="checkbox" checked={form.privacyAgreed} onChange={e=>update('privacyAgreed',e.target.checked)}/><span>我同意 HHBA 为联系和评估此次申请，将我主动填写的称呼、联系方式、经历及合作意向保存在受控数据库，并通过邮件通知负责人。可通过官方联系渠道提出删除请求。<em> *</em></span></label>
            </>}
            {error && <p className="join-form-error" role="alert">{error}</p>}
            <div className="join-form-actions">
              {step > 0 && <button type="button" className="join-btn join-btn-light" onClick={() => {setStep(s=>s-1);setError('')}}><ArrowLeft size={16} /> 上一步</button>}
              <button type="submit" className="join-btn join-btn-primary">{step === 2 ? '查看填写摘要' : '下一步'} <ArrowRight size={16}/></button>
            </div>
            <p className="join-form-security"><Info size={14}/> 申请数据仅在你核对摘要并确认提交后发送；邮件服务未接通时无法正式提交。</p>
          </form>}
        </div>
      </section>
      <footer className="join-footer"><strong>HHBA.</strong><span>让机会与人才，找到彼此。也让真正的建设者，共同分享未来。</span></footer>
    </div>
  </Shell>;
}
