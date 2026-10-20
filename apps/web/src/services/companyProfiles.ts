import { verifiedBrandKey } from '../components/EmployerBrandLogo';
import type { LiveJob } from './liveRecruitment';

export type CompanySlug='openai'|'anthropic'|'spacex';
export type Localized={zh:string;en:string};
export type CompanyProfile={
 slug:CompanySlug;name:string;logoAlt:Localized;industry:Localized;founded:string;
 country:Localized;website:string;careers:string;lastReviewed:string;
 tagline:Localized;overview:Localized[];focus:{name:Localized;description:Localized}[];
 milestones:{date:string;description:Localized}[];sources:{label:Localized;url:string}[];
};

export const companyProfiles:Record<CompanySlug,CompanyProfile>={
 openai:{
  slug:'openai',name:'OpenAI',
  logoAlt:{zh:'OpenAI 官方 Blossom 品牌标志',en:'OpenAI Blossom brand mark'},
  industry:{zh:'人工智能研究与产品',en:'AI research and products'},
  founded:'2015',country:{zh:'美国',en:'United States'},
  website:'https://openai.com/',careers:'https://openai.com/careers/',lastReviewed:'2026-10-20',
  tagline:{zh:'研究、构建并部署可被更多人使用的人工智能。',en:'Researching, building and deploying artificial intelligence.'},
  overview:[
   {zh:'OpenAI 是一家人工智能研究与部署公司。其公开使命是推动通用人工智能的发展，并努力确保这项技术能够造福全人类。公司既从事基础模型、推理、多模态和安全研究，也将研究成果转化为面向个人、团队和开发者的产品与服务。',
    en:'OpenAI is an AI research and deployment company. It pursues the development of artificial general intelligence and aims to ensure it benefits humanity. Its work spans frontier models, reasoning, multimodal AI and safety, together with products for individuals, teams and developers.'},
   {zh:'对于求职者而言，OpenAI 的业务并不局限于模型训练。其公开产品与研究活动还涉及应用研发、产品设计、基础设施、安全、运营，以及帮助企业采用人工智能的商业团队。具体职位职责和资格以该岗位官方招聘说明为准。',
    en:'OpenAI’s work extends beyond training models to product engineering, design, infrastructure, safety, operations and business adoption. The employer’s original posting remains the authority on the requirements of any specific role.'}
  ],
  focus:[
   {name:{zh:'ChatGPT',en:'ChatGPT'},description:{zh:'面向日常学习、写作、分析和工作的对话式人工智能产品。',en:'Conversational AI for learning, writing, analysis and work.'}},
   {name:{zh:'OpenAI API',en:'OpenAI API'},description:{zh:'向开发者提供模型能力，支持将 AI 集成到自己的产品与业务流程中。',en:'Model APIs that developers can integrate into products and workflows.'}},
   {name:{zh:'模型研究与安全',en:'Model research and safety'},description:{zh:'围绕推理、多模态模型及安全部署持续开展研究。',en:'Research on reasoning, multimodal models and safer deployment.'}}
  ],
  milestones:[
   {date:'2015',description:{zh:'OpenAI 作为非营利组织成立。',en:'OpenAI was founded as a nonprofit.'}},
   {date:'2019',description:{zh:'建立营利性子公司，以支持研究与产品部署的规模化。',en:'A for-profit subsidiary was created to scale research and deployment.'}},
   {date:'2025',description:{zh:'OpenAI 公布更新后的组织架构，包括 OpenAI Foundation 和 OpenAI Group PBC。',en:'OpenAI announced its updated Foundation and public-benefit-corporation structure.'}}
  ],
  sources:[
   {label:{zh:'OpenAI · 企业简介',en:'OpenAI · About'},url:'https://openai.com/about/'},
   {label:{zh:'OpenAI · 组织架构',en:'OpenAI · Our structure'},url:'https://openai.com/our-structure/'},
   {label:{zh:'OpenAI · 产品与 API 应用',en:'OpenAI · Applications and APIs'},url:'https://openai.com/academy/applications-of-ai/'}
  ]
 },
 anthropic:{
  slug:'anthropic',name:'Anthropic',
  logoAlt:{zh:'Claude 品牌标志（Anthropic 产品）',en:'Claude product mark (Anthropic)'},
  industry:{zh:'人工智能安全研究与产品',en:'AI safety research and products'},
  founded:'2021',country:{zh:'美国',en:'United States'},
  website:'https://www.anthropic.com/',careers:'https://www.anthropic.com/careers',lastReviewed:'2026-10-20',
  tagline:{zh:'以可靠、可解释、可控制的人工智能为研究重点。',en:'Building AI systems that are reliable, interpretable and steerable.'},
  overview:[
   {zh:'Anthropic 是一家专注于人工智能安全和前沿研究的企业。它研究如何提升大规模人工智能系统的可靠性、可解释性和可控性，并将相关研究应用于实际产品。公司强调把模型的能力发展与安全研究一起推进。',
    en:'Anthropic is an AI safety and frontier research company. It studies how to make increasingly capable AI systems more reliable, interpretable and steerable, and applies this work to deployed products.'},
   {zh:'Claude 是 Anthropic 推出的人工智能产品和模型系列。HHBA 的职位卡片使用真实的 Claude 橙色品牌标识帮助用户辨认，但招聘主体仍然是 Anthropic，并不意味着 HHBA 获得了企业招聘授权。',
    en:'Claude is Anthropic’s AI model and product family. HHBA uses the authentic Claude mark for visual recognition, while the recruiting employer remains Anthropic. This does not imply an authorized recruiting relationship.'}
  ],
  focus:[
   {name:{zh:'Claude',en:'Claude'},description:{zh:'供个人、团队和组织使用的 AI 助手及模型产品。',en:'AI assistant and model products for individuals, teams and organizations.'}},
   {name:{zh:'可解释性研究',en:'Interpretability research'},description:{zh:'研究模型内部行为及其产生输出的机制。',en:'Research into understanding model behavior and internal mechanisms.'}},
   {name:{zh:'AI 安全与治理',en:'AI safety and governance'},description:{zh:'研究、测试并讨论先进 AI 的安全、风险与社会影响。',en:'Research, testing and policy work on the safety and impact of advanced AI.'}}
  ],
  milestones:[
   {date:'2021',description:{zh:'Anthropic 于 2021 年初成立，致力于更可靠的 AI 系统研究。',en:'Anthropic was founded in early 2021 to research more reliable AI systems.'}},
   {date:'2022',description:{zh:'公开介绍可控性、鲁棒性和可解释性等核心研究方向。',en:'Outlined research in steerability, robustness and interpretability.'}}
  ],
  sources:[
   {label:{zh:'Anthropic · 公司介绍',en:'Anthropic · Company'},url:'https://www.anthropic.com/company'},
   {label:{zh:'Anthropic · 创立与研究',en:'Anthropic · Founding and research'},url:'https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems'},
   {label:{zh:'Anthropic · 研究方向',en:'Anthropic · Research directions'},url:'https://www.anthropic.com/news/anthropic-raises-series-b-to-build-safe-reliable-ai'}
  ]
 },
 spacex:{
  slug:'spacex',name:'SpaceX',
  logoAlt:{zh:'SpaceX 原始品牌字标',en:'Original SpaceX wordmark'},
  industry:{zh:'航空航天、发射服务与卫星互联网',en:'Aerospace, launch services and satellite internet'},
  founded:'2002',country:{zh:'美国',en:'United States'},
  website:'https://www.spacex.com/',careers:'https://www.spacex.com/careers/',lastReviewed:'2026-10-20',
  tagline:{zh:'通过可复用航天技术降低进入太空的门槛。',en:'Expanding access to space through reusable technologies.'},
  overview:[
   {zh:'SpaceX 是一家美国航空航天企业，业务涵盖火箭发射、航天器、载人航天和卫星互联网。公司长期探索可重复使用的运载火箭与航天运输系统，以扩大人类进入太空的能力。',
    en:'SpaceX is a US aerospace company working on launch vehicles, spacecraft, human spaceflight and satellite internet. Reusable rocket and transportation systems are central to its approach to expanding access to space.'},
   {zh:'它的产品与项目包括 Falcon 系列运载火箭、Dragon 航天器、Starship 运输系统，以及 Starlink 卫星宽带网络。这些业务分别涉及机械、电气、软件、制造、测试、发射运营及商业服务等多种专业岗位。',
    en:'Its publicly described programs include Falcon launch vehicles, Dragon spacecraft, the Starship transportation system and Starlink broadband. These activities involve engineering, software, manufacturing, testing, launch operations and commercial functions.'}
  ],
  focus:[
   {name:{zh:'Falcon 与 Dragon',en:'Falcon and Dragon'},description:{zh:'卫星发射、货物运输和载人航天相关系统。',en:'Launch systems and spacecraft for satellites, cargo and crew.'}},
   {name:{zh:'Starship',en:'Starship'},description:{zh:'面向地球轨道、月球及更远目的地的可复用航天运输系统。',en:'A reusable transportation system designed for orbit, the Moon and beyond.'}},
   {name:{zh:'Starlink',en:'Starlink'},description:{zh:'利用低地球轨道卫星提供宽带互联网服务。',en:'Broadband connectivity delivered using low-Earth-orbit satellites.'}}
  ],
  milestones:[
   {date:'2002',description:{zh:'SpaceX 成立，以拓展人类进入太空的能力为目标。',en:'SpaceX was founded to expand access to space.'}},
   {date:'2012',description:{zh:'Dragon 成为首个向国际空间站往返运送货物的商业航天器。',en:'Dragon became the first commercial spacecraft to transport cargo to and from the ISS.'}},
   {date:'2020',description:{zh:'公司恢复了从美国本土执行载人航天发射的能力。',en:'SpaceX contributed to the return of human spaceflight launches from the United States.'}}
  ],
  sources:[
   {label:{zh:'SpaceX · 公司业务',en:'SpaceX · Company overview'},url:'https://www.spacex.com/company/overview'},
   {label:{zh:'SpaceX · 使命与历程',en:'SpaceX · Mission and milestones'},url:'https://www.spacex.com/mission/'},
   {label:{zh:'SpaceX · 可复用航天',en:'SpaceX · Reusability'},url:'https://www.spacex.com/updates/reusability'}
  ]
 }
};
export function profileFromSlug(slug:string):CompanyProfile|null{
 return Object.prototype.hasOwnProperty.call(companyProfiles,slug)
  ?companyProfiles[slug as CompanySlug]:null;
}
export function companyProfileForJob(job:Pick<LiveJob,'company'|'source'|'platform'>):CompanyProfile|null{
 const brand=verifiedBrandKey(job);
 return brand?companyProfiles[brand]:null;
}
