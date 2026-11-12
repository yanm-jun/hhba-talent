import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  CheckCircle2, ChevronDown, Clock3, Coins, Handshake,
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
  { icon: Wallet, title: '零现金现状公开', description: '目前没有稳定工资预算，不以未来融资或盈利为由承诺固定收入。请先确认自己是否适合这一阶段。' },
  { icon: Coins, title: '核心伙伴未来股权探讨', description: '对于长期承担核心责任的伙伴，可讨论未来实际股权或期权；公司设立、比例和归属条件均未确定，不代表已获股份。' },
  { icon: Handshake, title: '专项成果与收益分享探讨', description: '针对算法、插件、数据与渠道等专项合作，可讨论约定条件下的未来收益分配，但不承诺一定会盈利或分红。' },
  { icon: Clock3, title: '兼职与远程协作优先', description: '尊重已有工作和学业安排，以协商后的投入时间、目标与交付边界为前提。' },
  { icon: UsersRound, title: '参与建设和产品讨论', description: '核心参与者有机会讨论路线图、技术取舍和业务方向；参与讨论不等于已拥有公司治理或投票权。' },
  { icon: ShieldPlus, title: '先约定规则再合作', description: '涉及实际交付时，先明确合作性质、报酬或收益条件、知识产权、保密与退出规则，不拿口头股份当合同。' },
];

const roles = [
  {
    id:'tech-lead', team:'技术架构', priority:'P0 · 核心共建', title:'技术负责人 / 全栈架构工程师',
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
    id:'backend', team:'后端与数据库', priority:'P1 · 专项共建', title:'后端与数据库工程师',
    desc:'先把账号、D1/R2、简历与后台的真实数据链路维护稳定。',
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
    id:'ai-data', team:'招聘数据与 AI', priority:'P1 · 专项共建', title:'官方招聘数据与检索工程师',
    desc:'维护企业招聘官网入口分类、岗位真实性、时效与去重。',
    mission:'维护按行业分类的企业招聘入口，让 DeepSeek 优先从可信官网检索，并能在不足时补充搜索。',
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
    priorityNote:'负责企业入口及岗位数据，不要求同时承担简历匹配算法。'
  },
  {
    id:'ai-match', team:'AI 匹配与推荐', priority:'P0 · 核心共建', title:'AI 匹配与推荐算法工程师',
    desc:'专攻 DeepSeek 简历解析、岗位推荐质量和适配理由。',
    mission:'提升中国大陆真实岗位的有效推荐质量，降低误匹配、幻觉和调用成本。',
    responsibilities:['优化简历结构化、学历/经验/城市条件识别和候选岗位召回。','改进岗位匹配度、投递竞争力双指标和可解释推荐。','设计 Top10 推荐评估、用户反馈闭环和成本监控。'],
    required:['有 LLM 应用、推荐排序或检索算法的可演示项目。','熟悉 Python 或 TypeScript，能够进行离线评估和问题定位。','重视简历隐私、模型成本和岗位真实性。'],
    preferred:['实践过 DeepSeek、RAG、招聘推荐或排序评估。'],
    challenge:'说明如何用脱敏简历评价 Top10 推荐质量并降低不相关岗位比例。',
    cooperation:'核心技术共建意向；可讨论未来股权，但任何权益需具备条件后另行书面约定。',
    priorityNote:'与招聘数据工程师分工：这个方向负责算法质量，不负责逐家归档官网。'
  },
  {
    id:'edge-apply', team:'网申自动化', priority:'P1 · 专项共建', title:'Edge 网申插件工程师',
    desc:'实现官方招聘网站简历自动填写、用户确认和投递进度记录。',
    mission:'构建安全、可审核、适用于 Windows/macOS Edge 的网申辅助扩展。',
    responsibilities:['实现简历字段映射、表单识别和缺失信息补充。','保证提交前由用户确认，记录真实投递结果。','完成扩展权限、安全保护、异常处理与 Edge 商店适配。'],
    required:['有浏览器扩展或自动化工具开发经历。','熟悉 JavaScript/TypeScript、DOM、扩展权限与隐私保护。'],
    preferred:['有 Playwright、网申表单或 Edge 插件上架经验。'],
    challenge:'说明复杂动态表单如何做到可控自动填写而不擅自替用户提交。',
    cooperation:'按成果里程碑讨论专项共建和未来有条件的收益分配，不承诺固定薪资。',
    priorityNote:'先做好 Edge 闭环，不要求一次兼容 Safari 和 Chrome。'
  },
  {
    id:'governance', team:'企业治理与劳动权益', priority:'P2 · 顾问储备', title:'企业治理与劳动权益研究伙伴',
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
    id:'content-growth', team:'品牌传播与增长', priority:'P0 · 核心共建', title:'新媒体内容与用户增长伙伴',
    desc:'从零建立公众号、抖音、小红书等真实内容与用户反馈渠道。',
    mission:'用可信内容和低成本实验让用户认识 HHBA，并带动有效注册与复访。',
    responsibilities:['建立内容选题和发布节奏，从一个平台逐步扩展。','制作真实企业招聘官网、岗位匹配和求职信息内容。','跟踪有效注册、复访及用户反馈，拒绝虚假流量。'],
    required:['可独立完成文案、剪辑或账号运营之一，并展示真实作品。','理解内容版权、真实数据与平台规则。'],
    preferred:['熟悉求职内容、校园社群、抖音、小红书或公众号。'],
    challenge:'提出不购买广告的四周内容计划与有效增长指标。',
    cooperation:'可兼职远程，从可执行的内容计划开始；未来收益分成必须有明确书面条件。',
    priorityNote:'优先找到能持续运营一个账号的人，不要求所有平台同时日更。'
  },
  {
    id:'business', team:'企业合作与商业发展', priority:'P1 · 增长合作', title:'企业合作与商业发展伙伴',
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
    id:'product', team:'产品与用户体验', priority:'P2 · 按需协作', title:'产品设计 / 前端体验伙伴',
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

const roleGroups = [
  { id: 'core', title: '第一组 · 核心共建', description: '先接触 2–3 位能够持续负责关键成果的伙伴，不等于每个方向都招一名全职员工。', ids: ['tech-lead', 'ai-match', 'content-growth'] },
  { id: 'specialist', title: '第二组 · 专项与增长合作', description: '按阶段目标合作，部分方向可兼任，实际交付之前先谈清楚边界与权益。', ids: ['backend', 'ai-data', 'edge-apply', 'business'] },
  { id: 'flex', title: '第三组 · 顾问与开放合作', description: '非首批刚需，欢迎提供作品、建议或未来合作意向。', ids: ['product', 'governance', 'other'] },
] as const;

type Direction = typeof roles[number]['id'];
type FormData = {
  name: string; contact: string; direction: Direction | '';
  experience: string; portfolio: string; strength: string;
  weeklyTime: string; mode: string; note: string; acknowledged: boolean;
};
const blank: FormData = {
  name: '', contact: '', direction: '',
  experience: '', portfolio: '', strength: '',
  weeklyTime: '', mode: '', note: '', acknowledged: false,
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const RESUME_EXTS = ['pdf', 'doc', 'docx'];
function resumeExt(name: string) {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

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
        <p className="join-manifesto-eyebrow">汇方职场 · A NOTE FROM HHBA'S FOUNDER</p>
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
        <p className="join-manifesto-identity">汇方职场 · HHBA — Human Capability Network</p>
        <p className="join-manifesto-tagline">让机会与人才，找到彼此。</p>
        <p className="join-manifesto-founder-label">创办者 · 闫明骏</p>
        <img className="join-manifesto-signature"
             src={import.meta.env.BASE_URL + 'images/hhba-founder-signature-2026.svg'}
             alt="创办者闫明骏的真实手写签名" width={1301} height={691}
             decoding="async" loading="lazy" />
      </footer>
    </div>
  </section>;
}

export function JoinUsPage({ user }: { user: User | null }) {
  const rolesRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(blank);
  const [resume, setResume] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(old => ({ ...old, [key]: value }));
    submissionIdRef.current = null;
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
        setError('请先填写称呼、邮箱并选择合作方向。'); return;
      }
      if (!EMAIL_RE.test(form.contact.trim())) {
        setError('请填写正确的邮箱地址。'); return;
      }
      if (form.name.trim().length > 80 || form.contact.trim().length > 180) {
        setError('请检查输入长度：称呼最多 80 字，邮箱最多 180 字。'); return;
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
    if (!form.weeklyTime || !form.mode || !form.acknowledged) {
      setError('请填写合作安排，并确认已知悉当前创业阶段说明。'); return;
    }
    setError('');
    setPreview(true);
    jump(formRef);
  };
  const submitApplication = async () => {
    setError('');
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('name', form.name.trim());
      body.append('email', form.contact.trim());
      body.append('direction', form.direction);
      body.append('experience', form.experience.trim());
      body.append('strength', form.strength.trim());
      body.append('portfolio', form.portfolio.trim());
      body.append('weeklyTime', form.weeklyTime);
      body.append('mode', form.mode);
      body.append('note', form.note.trim());
      body.append('acknowledged', form.acknowledged ? 'true' : 'false');
      if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
      body.append('submissionId', submissionIdRef.current);
      if (resume) body.append('resume', resume);
      const res = await fetch('/api/join-apply', { method: 'POST', body });
      const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        const code = data?.error || '';
        const messages: Record<string, string> = {
          INVALID_EMAIL: '请填写正确的邮箱地址。',
          INVALID_INPUT: '请检查填写内容，必填项不能为空或超出长度。',
          INVALID_DIRECTION: '请选择正确的合作方向。',
          INVALID_RESUME: '简历仅支持 PDF 或 Word（.doc/.docx），且不超过 10MB。',
          RATE_LIMITED: '操作太频繁，请稍后再试。',
          EMAIL_NOT_CONFIGURED: '申请通道尚未完成邮箱配置，请稍后再试。',
          EMAIL_SEND_FAILED: '申请已保存，但邮件发送失败，请稍后再试或换个时间提交。',
          EMAIL_DELIVERY_FAILED_UNSAVED: '申请尚未发送成功，请稍后重试，填写内容已保留。',
          STORAGE_UNAVAILABLE: '申请保存服务暂时不可用，请稍后再试，填写内容已保留。',
        };
        setError(messages[code] || '提交失败，请稍后再试。');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('提交失败，请检查网络后重试。');
    } finally {
      setSubmitting(false);
    }
  };
  const selectedRole = roles.find(role => role.id === form.direction);
  return <Shell user={user}>
    <div className="join-page">
      <section className="join-hero" aria-labelledby="join-title">
        <div className="join-hero-main">
          <p className="join-kicker"><span className="join-kicker-dot" aria-hidden="true"/> 汇方职场 · HHBA · 零现金创业伙伴招募</p>
          <h1 id="join-title">我们不只想帮人找到好工作。<br /><span>我们还想创造一家值得工作的公司。</span></h1>
          <p className="join-hero-desc">从尊重劳动者开始，从认真建设产品开始。我们希望找到愿意了解项目真实情况、先从具体成果谈起的共建伙伴。</p>
          <div className="join-hero-actions">
            <JumpButton onClick={() => jump(rolesRef)}>了解合作机会</JumpButton>
            <Link className="join-btn join-btn-light" to="/vision">了解我们的理念 <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="join-stage-banner"><Info size={16} aria-hidden="true" /><span><strong>真实进展：</strong>HHBA 尚在筹备阶段，目前没有稳定工资和福利预算。我们只开放创业共建意向沟通；未来股权、拟议分红和收益分配均须具备条件并书面约定，不承诺现成股份或收入。</span></div>
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
          <h2 id="join-benefits-title">没有现成福利，先把合作条件说清楚。</h2>
          <p>我们不包装高薪、六险二金和带薪休假。当前能公开的，是资金现状、可探讨的合作权益与保护双方的基本原则。</p>
        </div>
        <div className="join-benefits-grid">
          {benefits.map(b => <article key={b.title} className="join-benefit-card">
            <span className="join-icon join-benefit-icon"><b.icon size={21} aria-hidden="true" /></span>
            <h3>{b.title}</h3><p>{b.description}</p>
          </article>)}
        </div>
        <aside className="join-disclosure" aria-labelledby="join-disclosure-title">
          <ShieldPlus size={21} aria-hidden="true" />
          <div><h3 id="join-disclosure-title">关于零现金阶段与法律边界</h3>
            <p>HHBA 尚未完成公司设立和融资，目前没有稳定工资预算。<strong>这里是创业伙伴意向征集，并非已提供有薪职位或已授予股份。</strong>所谓“干股”不一定是真实持股，未来分红或股权都需要明确条件并书面约定。若实际建立劳动关系，必须依法支付工资并履行法定保障，不能用股权或分红代替。</p>
          </div>
        </aside>
      </section>

      <section className="join-section" ref={rolesRef} id="join-opportunities" aria-labelledby="join-roles-title">
        <div className="join-section-head">
          <p className="join-kicker">WORK WITH US</p>
          <h2 id="join-roles-title">先找到能把关键事情做成的伙伴。</h2>
          <p>围绕技术底座、DeepSeek 匹配、Edge 自动网申、官方企业招聘入口与新媒体增长重新排序。以下为合作方向而非已批准的全职编制；欢迎兼任或阶段性共建。</p>
        </div>
        <div className="join-role-priority-intro" role="note">
          <div><strong>首批重点：技术负责人、AI 匹配算法、新媒体增长</strong><p>初期先接触 2–3 位核心建设者。插件、岗位数据和后端可按实际里程碑合作，无须每个方向都设全职岗位。</p></div>
          <span>零现金阶段 · 先谈清楚条件</span>
        </div>
        {roleGroups.map(group => <div className="join-role-group" key={group.id}>
          <div className="join-role-group-heading"><h3>{group.title}</h3><p>{group.description}</p></div>
          <div className="join-role-list">
          {roles.filter(r => (group.ids as readonly string[]).includes(r.id)).map(r => <details className="join-role" key={r.id}>
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
                <p>目前无稳定工资预算，也无已授予股份或保底分红。核心共建可讨论未来实际股权；专项与增长可讨论有条件的收益分配。任何实际交付之前须书面明确合作性质、报酬或收益条件、知识产权与退出规则；如形成劳动关系，应依法支付工资并履行法定保障。</p>
              </div>
              <button type="button" onClick={() => applyFor(r.id)}>填写该方向合作意向 <ArrowRight size={16} aria-hidden="true"/></button>
            </div>
          </details>)}
          </div>
        </div>)}
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
          <li><span className="join-step-dot"><BadgeCheck size={17}/></span><div><small>长期目标</small><h3>逐步明确正式合作与权益</h3><p>有真实经营条件后，再依法确定工资福利、股权或收益方案，不以融资必然成功作为承诺。</p></div></li>
        </ol>
      </section>

      <BrandManifesto />

      <section className="join-section join-apply-section" id="join-apply" ref={formRef} aria-labelledby="join-apply-title">
        <div className="join-section-head">
          <p className="join-kicker">SAY HELLO</p>
          <h2 id="join-apply-title">告诉我们，你想一起做什么。</h2>
          <p>填写并提交后，申请会发送到 HHBA 邮箱，我们会通过你填写的邮箱与你联系。</p>
        </div>
        <div className="join-form-shell">
          <div className="join-form-progress" aria-label="合作意向步骤">
            {['基本信息','专业能力','合作意向'].map((label,i) => <span className={i===step ? 'is-current' : i<step ? 'is-complete' : ''} key={label}><b>{i<step ? '✓' : String(i+1).padStart(2,'0')}</b>{label}</span>)}
          </div>
          {submitted ? <div className="join-form-body join-form-preview">
            <span className="join-icon"><CheckCircle2 size={23}/></span>
            <h3>已收到你的合作意向</h3>
            <p className="join-preview-warning">申请已发送到 HHBA 邮箱，我们会通过你填写的邮箱与你联系，请留意收件箱。</p>
            <div className="join-form-actions"><button type="button" className="join-btn join-btn-light" onClick={() => {setSubmitted(false);setPreview(false);setStep(0);setForm(blank);setResume(null);submissionIdRef.current=null}}>再填一份 <ArrowLeft size={16}/></button></div>
          </div> : preview ? <div className="join-form-body join-form-preview">
            <span className="join-icon"><CheckCircle2 size={23}/></span>
            <h3>合作意向预览</h3>
            <p className="join-preview-warning">请核对以下信息，确认无误后点提交，申请会发送到 HHBA 邮箱。</p>
            <dl>
              <div><dt>称呼</dt><dd>{form.name.trim()}</dd></div>
              <div><dt>邮箱</dt><dd>{form.contact.trim()}</dd></div>
              <div><dt>合作方向</dt><dd>{selectedRole?.title || '—'}</dd></div>
              <div><dt>每周投入</dt><dd>{form.weeklyTime}</dd></div>
              <div><dt>合作偏好</dt><dd>{form.mode}</dd></div>
              {resume && <div><dt>简历</dt><dd>{resume.name}</dd></div>}
            </dl>
            {error && <p className="join-form-error" role="alert">{error}</p>}
            <div className="join-form-actions"><button type="button" className="join-btn join-btn-light" onClick={() => {setPreview(false);setStep(0)}}>返回修改 <ArrowLeft size={16}/></button><button type="button" className="join-btn join-btn-primary" disabled={submitting} onClick={() => void submitApplication()}>{submitting ? '提交中…' : '提交合作意向'} <ArrowRight size={16}/></button></div>
          </div> : <form className="join-form-body" onSubmit={e => {e.preventDefault(); if(step<2)next();else showPreview()}} noValidate>
            {step === 0 && <>
              <h3>先认识一下你</h3><p className="join-form-description">请填写真实联系邮箱，提交后我们会通过该邮箱与你联系。</p>
              <label htmlFor="join-name">怎么称呼你？ <em>*</em></label>
              <input id="join-name" value={form.name} maxLength={80} autoComplete="off" onChange={e=>update('name',e.target.value)} placeholder="姓名或常用称呼" />
              <label htmlFor="join-contact">邮箱 <em>*</em></label><input id="join-contact" type="email" autoComplete="email" maxLength={180} value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="你的邮箱地址，例如 name@example.com" />
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
              <label htmlFor="join-resume">简历（选填，PDF 或 Word，不超过 10MB）</label>
              <input id="join-resume" type="file" accept=".pdf,.doc,.docx" onChange={e=>{const f=e.target.files?.[0]||null; if(!f){setResume(null);return;} if(!RESUME_EXTS.includes(resumeExt(f.name))){setError('简历仅支持 PDF 或 Word（.doc/.docx）。');setResume(null);return;} if(f.size>RESUME_MAX_BYTES){setError('简历不超过 10MB。');setResume(null);return;} setError('');setResume(f);}} />
              {resume && <p className="join-form-description">已选择：{resume.name}（{Math.ceil(resume.size/1024)} KB）</p>}
            </>}
            {step === 2 && <>
              <h3>聊聊你想如何一起参与</h3><p className="join-form-description">合作方式及实际权益必须在正式沟通时另行确认。</p>
              <div className="join-field-row">
                <div><label htmlFor="join-time">每周预计可以投入多久？ <em>*</em></label><select id="join-time" value={form.weeklyTime} onChange={e=>update('weeklyTime',e.target.value)}><option value="">请选择</option><option>每周 1–5 小时</option><option>每周 6–15 小时</option><option>每周 16–30 小时</option><option>每周 30 小时以上</option><option>待进一步沟通</option></select></div>
                <div><label htmlFor="join-mode">理想合作方式 <em>*</em></label><select id="join-mode" value={form.mode} onChange={e=>update('mode',e.target.value)}><option value="">请选择</option><option>远程协作</option><option>线上线下结合</option><option>未来正式岗位</option><option>灵活协商</option></select></div>
              </div>
              <label htmlFor="join-note">还想告诉我们什么？</label>
              <textarea id="join-note" value={form.note} onChange={e=>update('note',e.target.value)} maxLength={600} rows={3} placeholder="例如协作时间、对项目的想法或想先交流的问题" />
              <label className="join-agreement"><input type="checkbox" checked={form.acknowledged} onChange={e=>update('acknowledged',e.target.checked)}/><span>我已了解：HHBA 当前无稳定薪资预算、现成股份或保底分红。本次仅提交合作意向；实际合作、分红和股权条件须另行依法协商并书面明确。<em> *</em></span></label>
            </>}
            {error && <p className="join-form-error" role="alert">{error}</p>}
            <div className="join-form-actions">
              {step > 0 && <button type="button" className="join-btn join-btn-light" onClick={() => {setStep(s=>s-1);setError('')}}><ArrowLeft size={16} /> 上一步</button>}
              <button type="submit" className="join-btn join-btn-primary">{step === 2 ? '查看填写摘要' : '下一步'} <ArrowRight size={16}/></button>
            </div>
            <p className="join-form-security"><Info size={14}/> 提交后，申请资料会发送到 HHBA 邮箱并保存为申请记录，仅用于合作沟通。</p>
          </form>}
        </div>
      </section>
      <footer className="join-footer"><strong>HHBA. · 汇方职场</strong><span>让机会与人才，找到彼此。也让真正的建设者，共同分享未来。</span></footer>
    </div>
  </Shell>;
}
