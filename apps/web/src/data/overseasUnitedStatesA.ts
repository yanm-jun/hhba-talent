/* HHBA 美国发展方案 A：F/M/J学生与交流、CPT/OPT/STEM OPT、H-1B。资料基准2026-11-06。 */
import type {UsPathway} from './overseasUnitedStatesTypes';
export const usRoutesA:UsPathway[]=[
  {
    "id": "us-f1",
    "name": "学术留学签证（F-1）",
    "english": "F-1 Academic Student Visa",
    "category": "study",
    "summary": "获得美国SEVP认证学校的合格学术项目录取后，按I-20、SEVIS、DS-160和使领馆面谈程序申请；签证、在美F-1身份及后续就业授权是不同概念。",
    "audience": "计划在美国正规大学、社区学院、语言课程或其他合格学术学校进行全日制学习的申请人。",
    "requirements": [
      "第一步是核实校方SEVP认证状态与具体校区、专业、授予学位及开学日期；学校录取本身不保证签证。",
      "入学后由学校指定官员（DSO）签发Form I-20；申请人需证明足够支付学费和生活费、真实学习目的及符合适用的非移民签证条件。",
      "持中国护照可按当前国籍规则申请F-1，但仍会接受领事官对学习计划、学历与财务背景等的个别审查。",
      "校内、校外打工、实习和OPT有各自资格及授权规则；未获授权不得随意在校外就业。"
    ],
    "documents": [
      "SEVP认证学校录取信、正确校区和课程对应Form I-20、SEVIS号码",
      "有效护照、DS-160确认页及签证照片、约签记录",
      "学费/生活费资金证明、奖学金与担保文件及资金来源说明",
      "以前的学历成绩单、英语证明、学习计划与必要的家庭或工作联系材料"
    ],
    "steps": [
      "在EducationUSA和学校官网核对项目、学费、截止日期及是否可签发I-20。",
      "取得录取和I-20后核对SEVIS个人信息，支付需要的I-901 SEVIS费并保存收据。",
      "按官方要求填写DS-160、缴纳相应签证申请费，预约居住地适用的使领馆面谈。",
      "准备真实的学习计划、资金来源及材料；根据领馆通知完成面谈与可能的行政审查。",
      "获签后按规定不早于课程开学前30天入境，留意I-94和DSO报到、维持全日制与签证身份。"
    ],
    "fees": [
      "美国国务院当前列示F类一般签证申请费为185美元，但提交时需核对实时费率、可能的国籍对等费及特殊情形。",
      "I-901 SEVIS费用、学校学费、强制保险、住宿、机票与生活费需要分别核算；不是同一项签证收费。",
      "财务证明金额以I-20及学校估计的课程和生活成本为依据，不能简单套用全国统一最低存款。"
    ],
    "rights": [
      "获批且获准入境后，可在合法的F-1身份条件下就读核准的学校和课程。",
      "符合要求时可能获校内工作、CPT或OPT授权，但校外就业并非F-1自动权利。",
      "合格家属可按规定申请F-2，但F-2是否能就业和学习需分别核实。"
    ],
    "risks": [
      "旅游B-1/B-2签证原则上不能代替以学历学位为目标的F-1学习。",
      "切勿通过假I-20、虚构资产、虚假语言成绩申请，可能导致严重移民不良记录。",
      "F-1签证印在护照上的有效期不等于每次入境许可的身份停留期限，应按I-94、I-20与DSO要求维护状态。"
    ],
    "timing": [
      "学校申请、奖学金、I-20签发和签证面谈排期常有不确定性，宜倒排时间线。",
      "多数符合条件者在项目开始前最多30天以F-1身份入境，切勿仅凭签证提前数月入境。",
      "如因行政审查延误入学，应与DSO确认延迟入学与SEVIS记录调整。"
    ],
    "future": [
      "读书期间先评估是否需要CPT；毕业前与DSO核对OPT申请期限。",
      "完成课程后如符合资格，可研究与本专业相关的OPT，某些STEM专业进一步研究STEM OPT。",
      "未来是否转H-1B、O-1或移民类别须按新身份的独立条件办理，并无毕业自动留美政策。"
    ],
    "faq": [
      {
        "question": "F-1学生可以无限制兼职吗？",
        "answer": "不可以，校内和校外活动有不同授权和时长限制；没有校外就业授权不能随便打工。"
      },
      {
        "question": "拿到I-20就是拿到签证了吗？",
        "answer": "不是。I-20用于证明学校录取和SEVIS资格，领事签证及美国口岸入境是不同步骤。"
      },
      {
        "question": "只要学校便宜就一定适合毕业就业吗？",
        "answer": "不是。先核查SEVP身份、毕业学位和课程CIP、课程质量、奖学金、所在城市成本及毕业后工作机会。"
      }
    ],
    "highlights": [
      "SEVP与I-20",
      "DS-160/SEVIS",
      "在读不可随意校外就业"
    ],
    "officialUrl": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
    "sources": [
      {
        "label": "美国国务院学生签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "purpose": "F/M资格、I-20、SEVIS、面谈与入境"
      },
      {
        "label": "美国国务院签证收费表",
        "url": "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html",
        "purpose": "F类签证费随政策核实"
      }
    ]
  },
  {
    "id": "us-m1",
    "name": "职业教育学生签证（M-1）",
    "english": "M-1 Vocational Student Visa",
    "category": "study",
    "summary": "适用于合格美国非学术职业课程的学生，需由适用学校签发I-20；在读与完成课程后的就业权利不同于F-1，不能套用F-1的OPT流程。",
    "audience": "准备学习正规的非学术职业或技术培训课程，且课程与学校符合SEVP规定的人。",
    "requirements": [
      "课程应属于M-1适用的非学术职业领域，不能把大学学位项目或一般语言项目错误归类。",
      "需取得SEVP认证适用学校录取和Form I-20，证明能够负担学费与生活费并符合临时赴美学习条件。",
      "M-1的实际培训、状态延长和毕业后就业授权独立于F-1，通常不能在读期间自由就业。"
    ],
    "documents": [
      "职业学校真实录取及M-1专用Form I-20",
      "有效护照、DS-160、学校和SEVIS材料",
      "学费生活费支付能力证据与学习计划",
      "相关专业技能背景、归国发展安排和其他领馆要求材料"
    ],
    "steps": [
      "在学校官网核对是否属于M-1类别及课程具体执照、学费和就业认证。",
      "取得I-20并按官方规则完成SEVIS及DS-160程序。",
      "准备签证文件与资金来源参加面谈；按学校和移民部门规定入境。",
      "在读期间维持M-1身份；需要实际培训须向DSO及USCIS核对允许时点。"
    ],
    "fees": [
      "按国务院现行F/M类别一般签证申请收费核对，另计SEVIS与学校费用。",
      "职业培训材料费、保险、住宿和后续任何授权成本需分别计算。"
    ],
    "rights": [
      "可按批准的M-1课程学习。",
      "仅在满足独立规定并获得USCIS许可时，毕业后才可能参与与课程相关的实际培训。"
    ],
    "risks": [
      "不要误以为持M-1可以像F-1那样取得通常12个月的学术OPT。",
      "职业学校声称保送工作绿卡，需要独立核查雇主、实际工作签证及移民规则。"
    ],
    "timing": [
      "先确认课程时长和M-1身份允许的停留期，必要时及时申请延期。",
      "如需毕业后实训，提前与DSO核对Form I-765、延长身份及就业时限。"
    ],
    "future": [
      "学校毕业并不自动获发H-1B或永久居留。",
      "若未来找到雇主，须独立核对岗位是否合格及转换身份限制。"
    ],
    "faq": [
      {
        "question": "语言学校可随意申请M-1吗？",
        "answer": "通常语言培训属于学术F类，不应按M-1规划。"
      },
      {
        "question": "M-1能直接毕业后找工作一年吗？",
        "answer": "不能套用F-1 OPT；相关实际培训须按M-1独立规则及批准时限申请。"
      }
    ],
    "highlights": [
      "职业课程限定",
      "M-1≠F-1",
      "需独立实训授权"
    ],
    "officialUrl": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
    "sources": [
      {
        "label": "美国国务院F/M学生签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "purpose": "课程类型、I-20及适用签证"
      },
      {
        "label": "USCIS学生就业",
        "url": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        "purpose": "不同学生类别的就业授权说明"
      }
    ]
  },
  {
    "id": "us-j1-intern",
    "name": "J-1交流实习（Intern / Trainee）",
    "english": "J-1 Intern and Trainee Exchange Visitor",
    "category": "experience",
    "summary": "须通过美国国务院指定交流项目主办机构并取得DS-2019；Intern与Trainee分属不同资格，不是可购买任意岗位或自由在美国打工的签证。",
    "audience": "目前在美国境外高校就读、刚毕业或具备相应工作经验并符合交流实习项目条件的人。",
    "requirements": [
      "Intern通常要求目前在美国境外认可高等学校就读，或在交流项目开始前12个月内从美国境外相应院校毕业。",
      "Trainee通常要求持美国境外高校学位/职业证书及至少一年相关工作经历，或在相关领域拥有五年美国境外工作经验。",
      "必须通过指定项目Sponsor，提供符合真实学习/培训目的的DS-2019；Intern与Trainee通常还需要DS-7002培训计划。",
      "不能安排纯粹普通劳务、无技能工作或违反项目范围的工作；某些类别受212(e)回国居住要求约束。"
    ],
    "documents": [
      "指定交流主办方出具的DS-2019及J类SEVIS记录",
      "Intern/Trainee的DS-7002工作培训计划、接收单位与岗位信息",
      "境外在读或毕业日期证明、学历与工作经验材料",
      "护照、DS-160、所需资金或项目资助证明及保险安排"
    ],
    "steps": [
      "先按目前在读、毕业时间和工作经验区分Intern还是Trainee。",
      "通过美国国务院指定Sponsor核验真实项目、接收企业和费用构成，不通过不明中介买名额。",
      "Sponsor批准项目并签发DS-2019，按要求完成DS-7002与SEVIS手续。",
      "通过美国国务院J类签证流程申请，按安排入境参加核准项目。",
      "全过程按DS-2019与DS-7002履行培训内容，结束时核查212(e)义务。"
    ],
    "fees": [
      "J类通常按官方公布的申请费核对；部分政府资助项目存在费用豁免，应依项目身份确认。",
      "项目Sponsor、SEVIS、保险、住宿、交通及项目管理费用需逐项获取书面明细，不能把所谓岗位购买费当官方费。"
    ],
    "rights": [
      "可在获批准的Sponsor和项目内容范围内进行交流实习或培训。",
      "不得把J-1交流活动当作任意雇主的正式工作许可。"
    ],
    "risks": [
      "有些J-1可能触发INA 212(e)两年回国居住要求，依资金、医学培训、技能清单等实际情形判断。",
      "简历包装或虚构实习岗位可能造成签证拒签、撤销项目乃至长期入境问题。",
      "不能未经Sponsor同意擅自更换实习地点或岗位活动。"
    ],
    "timing": [
      "Intern的毕业12个月期限按交流项目开始日期判断，不能只看递交中介申请日期。",
      "Sponsor审核、DS-2019签发、使馆面谈和岗位开工需预留时间。"
    ],
    "future": [
      "项目结束不自动获得OPT、H-1B或绿卡。",
      "如适用212(e)条款，未来转换某些签证或移民程序前必须依法满足或获得豁免。"
    ],
    "faq": [
      {
        "question": "中国高校在读可以申请J-1 Intern吗？",
        "answer": "满足美国境外高等教育机构在读、Sponsor及培训岗位等资格时可能申请，并非任何实习都可做。"
      },
      {
        "question": "DS-2019等于工作合同吗？",
        "answer": "不是。它是J-1项目资格文件，具体允许活动受项目类别、DS-7002和Sponsor管理。"
      },
      {
        "question": "J-1回国两年是所有人必须的吗？",
        "answer": "不是，是否受212(e)约束依资金来源、专业清单、医学培训等独立判断。"
      }
    ],
    "highlights": [
      "指定Sponsor",
      "毕业12个月规则",
      "可能受212(e)"
    ],
    "officialUrl": "https://travel.state.gov/content/travel/en/us-visas/study/exchange.html",
    "sources": [
      {
        "label": "美国国务院J类签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/exchange.html",
        "purpose": "DS-2019、DS-7002、212(e)与签证"
      },
      {
        "label": "BridgeUSA Intern",
        "url": "https://j1visa.state.gov/programs/intern",
        "purpose": "实习资格和岗位限制"
      }
    ]
  },
  {
    "id": "us-j1-research",
    "name": "J-1访问学者与科研交流",
    "english": "J-1 Research Scholar / Professor",
    "category": "experience",
    "summary": "适合参加指定高校或研究机构组织的合格学术交流访问项目，须依Sponsor签发DS-2019；不是任意社会工作或单纯普通找工作的通行证。",
    "audience": "大学教师、研究人员和获得合格美国学术机构邀请的访问学者。",
    "requirements": [
      "需被美国国务院认可Sponsor接纳到真实的Research Scholar、Professor或其他合适J-1项目类别。",
      "项目活动应以研究、授课或学术合作为主；接收机构、研究计划与资金来源应当一致。",
      "要遵守适用的J类别停留上限、12/24个月再参加限制和可能的212(e)规定。"
    ],
    "documents": [
      "美国合格Sponsor签发的DS-2019及邀请信",
      "研究或教学计划、履历、学位和科研成果证明",
      "经费资助、工资或资金支持文件",
      "护照、DS-160、适用SEVIS记录与项目保险"
    ],
    "steps": [
      "联系合格高校研究院系，获得明确导师或机构接收和项目时间安排。",
      "由Sponsor确定是否符合J-1 Research Scholar或Professor类别并办理DS-2019。",
      "根据项目类别确认SEVIS、签证申请和资金材料。",
      "按项目约束在校活动，赴美后定期与Sponsor核对项目变化或延期。"
    ],
    "fees": [
      "使领馆J类签证费按官方当期标准；部分政府赞助项目可能适用费用豁免。",
      "主办方管理费、SEVIS、学校保险、住房和家属费用需逐项列预算。"
    ],
    "rights": [
      "在Sponsor批准的研究/教学项目范围内从事对应学术交流活动。",
      "可否进行项目外短期讲座、其他机构访问或领取报酬，须事先核实Sponsor授权。"
    ],
    "risks": [
      "J-1不等于无限制兼职或自动申请绿卡的合法基础。",
      "某些项目仍可能受212(e)义务及交流类别再参加限制。"
    ],
    "timing": [
      "和导师明确邀请期、签证面谈时间及研究课题开始日期。",
      "后续换项目、延期必须及时向Sponsor核验SEVIS记录和交流身份。"
    ],
    "future": [
      "研究经历可能为未来O-1、EB-1A或EB-2 NIW积累证据，但不自动达标。",
      "如换H-1B等身份，需核查项目结束和212(e)对转换的影响。"
    ],
    "faq": [
      {
        "question": "访问学者必须拥有博士吗？",
        "answer": "并非所有类别都统一强制博士，资格取决于Sponsor和岗位类别的具体要求。"
      },
      {
        "question": "可同时在别的公司兼职吗？",
        "answer": "不得擅自从事项目外就业；部分活动须Sponsor预先授权并符合J类别规定。"
      }
    ],
    "highlights": [
      "研究/教学交流",
      "Sponsor管理",
      "212(e)核验"
    ],
    "officialUrl": "https://travel.state.gov/content/travel/en/us-visas/study/exchange.html",
    "sources": [
      {
        "label": "美国国务院J类签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/exchange.html",
        "purpose": "项目类别及签证政策"
      },
      {
        "label": "BridgeUSA Research Scholar",
        "url": "https://j1visa.state.gov/programs/research-scholar",
        "purpose": "官方研究交流项目要求"
      }
    ]
  },
  {
    "id": "us-cpt",
    "name": "F-1课程实习授权（CPT）",
    "english": "Curricular Practical Training (CPT)",
    "category": "experience",
    "summary": "CPT是某些F-1学生课程组成部分的实习工作授权，不是新签证，也不属于每个学校或课程都能安排的自由兼职。",
    "audience": "已在美国以合法F-1身份学习、课程正式包括专业相关实习或工作训练的学生。",
    "requirements": [
      "训练须成为课程正式组成部分，直接关联主修专业，并由学校DSO依资格签发CPT授权。",
      "多数F-1学生通常需完成至少一学年全日制学习后才可能申请，部分要求立即实习的研究生项目例外。",
      "CPT可以为全职或兼职，但全职CPT累计12个月或以上通常影响同一学位等级后续OPT资格。"
    ],
    "documents": [
      "有效F-1身份与当前Form I-20",
      "课程教学大纲、学分实习要求或院系实习批准文件",
      "雇主的正式实习邀请、岗位职责、工作时间、地点与日期"
    ],
    "steps": [
      "从课程手册确认本课程是否真有学分或必修实习设计。",
      "向DSO提交真实实习offer及课程关联材料。",
      "等待DSO批准并签发注明雇主、地点和授权期限的CPT版I-20。",
      "严格在CPT批准日期和指定岗位内就业，记录全职/兼职时长。"
    ],
    "fees": [
      "CPT授权通常由学校按照校内程序办理，可能有学校实习学分收费；不应被包装成统一政府购买费。",
      "额外预算应结合学期学费、学分和实习期间实际居住成本。"
    ],
    "rights": [
      "仅允许在明确授权的CPT岗位、时间和地点从事课程相关实践。",
      "CPT不是毕业后自由就业的通行证，也不保证获得后续OPT。"
    ],
    "risks": [
      "所谓入学第一天立刻获得CPT（Day-1 CPT）必须核查学校课程真实性、资格例外及移民合规风险。",
      "无授权先入职、虚构校企合同或超出工作地点/日期可能破坏F-1身份。"
    ],
    "timing": [
      "至少在实习开工前完成DSO审核；不可追溯补发作为已发生工作的合法化。",
      "记录累计全职CPT时长，毕业前确认是否影响同一等级OPT。"
    ],
    "future": [
      "毕业时可按实际资格考虑OPT，但CPT工作经历本身不意味着有移民签证。",
      "如雇主愿意长期聘用，需独立评估H-1B等可用路径和时间节点。"
    ],
    "faq": [
      {
        "question": "CPT是签证吗？",
        "answer": "不是。它是F-1身份下、由DSO根据课程规定批准的实践培训授权。"
      },
      {
        "question": "学校卖Day-1 CPT保证合法可靠吗？",
        "answer": "不能这样认定。必须核查真实课程要求、学术进度、实习必要性以及主管机关现行政策。"
      }
    ],
    "highlights": [
      "课程组成部分",
      "DSO先批再工作",
      "全职12个月影响OPT"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
    "sources": [
      {
        "label": "USCIS学生及就业",
        "url": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        "purpose": "CPT与OPT及学校身份规则"
      },
      {
        "label": "美国国务院F-1签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "purpose": "F-1身份基础与学校要求"
      }
    ]
  },
  {
    "id": "us-opt",
    "name": "F-1毕业实习工作授权（OPT）",
    "english": "F-1 Optional Practical Training (OPT)",
    "category": "work",
    "summary": "OPT是符合资格F-1学生与主修专业直接相关的临时实践训练授权，并非独立美国签证；通常可在一个学位等级获得最多12个月相关OPT。",
    "audience": "完成或即将完成合格美国F-1学位课程、准备申请专业相关实践训练的留学生。",
    "requirements": [
      "须维持合规F-1身份、具备合格学习记录且工作与主修专业直接相关。",
      "学校DSO应先在SEVIS推荐OPT，随后申请人需在指定时限内递交I-765给USCIS。",
      "通常需收到EAD及到达获批起始日期才能开始授权工作；学生不得把学校推荐当作工作许可。",
      "毕业后OPT有申请时限、失业天数和地址/雇主报告要求；常见最多90天失业期须按现行规定核对。"
    ],
    "documents": [
      "DSO推荐OPT的新Form I-20、SEVIS记录",
      "USCIS Form I-765及申请费材料",
      "护照、I-94、F-1身份及既往授权情况",
      "毕业学位/专业资料与真实雇主、岗位关联证据"
    ],
    "steps": [
      "毕业前与DSO确认具体学位等级是否仍有OPT资格及已经使用的CPT/OPT时间。",
      "按DSO推荐后的I-765递交时限准备，核对毕业前后申请窗口与正确类别。",
      "USCIS批准并获得符合规定的EAD后，才按允许的日期开始工作。",
      "按规定上报雇主、住址、就业中断及专业相关性，并注意失业天数。"
    ],
    "fees": [
      "I-765申请费随提交时间与申请方式变化，应在USCIS官方表格收费页面核实。",
      "工资不一定由学校或政府提供，需准备求职过渡期资金与健康保险。"
    ],
    "rights": [
      "可在OPT授权的日期内从事与学习专业相关的合格实际培训。",
      "OPT是临时授权而不是长期雇主工作签证，也不是所有学生都能自动延期。"
    ],
    "risks": [
      "不得在EAD批准/生效前工作，或从事与专业无关的工作。",
      "超过允许失业天数、未更新雇主报告或使用虚构雇佣证明可能影响身份。"
    ],
    "timing": [
      "OPT须在官方时限内、与DSO推荐日期匹配时递交USCIS；错误时间可能遭拒。",
      "毕业后对雇主招聘、EAD卡寄送及签证状态衔接应保留缓冲。"
    ],
    "future": [
      "STEM学位符合CIP及雇主条件者可另查24个月STEM OPT。",
      "寻找愿意提供H-1B或其他合格身份的雇主时，需考虑H-1B注册季及OPT结束日期衔接。"
    ],
    "faq": [
      {
        "question": "OPT是不是可以毕业后无条件工作一年？",
        "answer": "不是，需DSO推荐、USCIS批准和EAD，并限于合格专业相关实践。"
      },
      {
        "question": "OPT结束还能自动留下吗？",
        "answer": "不能，须取得其他有效身份、依法延长或离境，具体宽限期与cap-gap等特殊规则由DSO核实。"
      }
    ],
    "highlights": [
      "通常最多12个月",
      "EAD批准后工作",
      "限专业相关"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
    "sources": [
      {
        "label": "USCIS学生就业",
        "url": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        "purpose": "OPT资格、I-765与授权限制"
      },
      {
        "label": "国务院学生签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "purpose": "明确OPT必须取得EAD"
      }
    ]
  },
  {
    "id": "us-stem-opt",
    "name": "STEM专业24个月OPT延期",
    "english": "24-Month STEM OPT Extension",
    "category": "work",
    "summary": "在符合资格的STEM学位、E-Verify雇主及I-983培训计划等条件下，部分F-1学生可申请在原OPT基础上增加最多24个月工作授权；这不是独立签证，也不是所有专业都符合。",
    "audience": "已处于符合规定的初始OPT、持有合格STEM学位且雇主能够提供合规培训的留学生。",
    "requirements": [
      "毕业学位对应CIP代码必须位于DHS当期STEM Designated Degree Program List；仅看中文专业是否理工不能判断。",
      "通常要求现有OPT在有效状态、雇主参加E-Verify并符合培训计划、监督和工资要求。",
      "学生与雇主需共同签署Form I-983，DSO签发相应推荐的I-20，再按规定时间提交I-765。",
      "申请、自动工作许可延续、失业天数和定期报告均有独立规定；不能默认无条件延长。"
    ],
    "documents": [
      "STEM学位证书、成绩单与官方CIP代码依据",
      "有效OPT EAD、USCIS I-765所需身份文件",
      "雇主E-Verify信息与签署的Form I-983",
      "DSO新的STEM OPT推荐I-20及更新报告材料"
    ],
    "steps": [
      "先在DHS当期STEM学位清单核对毕业专业的CIP编码。",
      "确认真实雇主参加E-Verify，能够提供有监督的培训和如实填写I-983。",
      "由DSO审核I-983并更新SEVIS，签发推荐I-20。",
      "在现有OPT到期前按照规定窗口递交I-765，保留收据和EAD相关通知。",
      "每次岗位/雇主或培训计划实质变化按规定通知DSO，并按时间提交评估和报告。"
    ],
    "fees": [
      "USCIS I-765申请费以当期官网为准，不应从网上旧截图抄固定金额。",
      "可能产生学校服务、搬迁和失业过渡成本；不存在缴费就能续签的保证。"
    ],
    "rights": [
      "满足条件可在允许期限内继续相关的培训工作，具体EAD和自动延期规则由USCIS规定。",
      "STEM OPT不是绿卡，也不保证H-1B中选。"
    ],
    "risks": [
      "非STEM课程、非E-Verify雇主或无法真实落实I-983培训均可能不符合资格。",
      "可疑挂靠公司、工资回流和空壳培训极易造成严重身份风险。"
    ],
    "timing": [
      "核对现有OPT结束日期，常见申请窗口为结束前90天内；DSO推荐及USCIS递交还有独立日数要求。",
      "定期六个月报告与12/24个月培训评估等由DSO核查，不可遗漏。"
    ],
    "future": [
      "利用合法授权期寻找符合长期工作签证要求的真实岗位。",
      "若拟参加H-1B注册，应同时关注工资等级加权筛选与其他现行规则。"
    ],
    "faq": [
      {
        "question": "学的是商科就一定不能STEM OPT吗？",
        "answer": "不一定，决定因素是美国学校授予学位的具体DHS认可CIP编码而非中文专业名。"
      },
      {
        "question": "找到愿意挂靠的公司就可以申请吗？",
        "answer": "不可以。要求真实培训、真实雇主监督及E-Verify等，挂靠可能构成严重欺诈。"
      }
    ],
    "highlights": [
      "CIP代码核验",
      "E-Verify及I-983",
      "延长24个月"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
    "sources": [
      {
        "label": "USCIS学生就业",
        "url": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        "purpose": "STEM OPT条件、培训计划及申请期限"
      },
      {
        "label": "USCIS学生就业官方指南",
        "url": "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        "purpose": "EAD、OPT报告要求"
      }
    ]
  },
  {
    "id": "us-h1b",
    "name": "专业岗位雇主工作签证（H-1B）",
    "english": "H-1B Specialty Occupations",
    "category": "work",
    "summary": "H-1B面向具备与专业职位直接相关资质的外国员工，通常由美国真实雇主先办理LCA、注册筛选及I-129；2027财年已实行薪资等级加权选择，政策费用仍可能受诉讼影响。",
    "audience": "具有合格专业学历或等同经验，获得美国真正专业岗位聘用及雇主支持的申请人。",
    "requirements": [
      "岗位通常须属于需要特定专业知识和相关学士或以上学历/等同资质的specialty occupation；岗位与学位对应关系须说明。",
      "多数受年度配额限制的雇主须在USCIS指定注册期完成候选人注册，合格中选后才可正式递交该年度受配额申请。",
      "FY2027注册规则实行基于职业及工作地区工资等级的加权选择，而不是旧版每个候选人完全相同概率随机抽签。",
      "雇主需要核对真实LCA、 prevailing wage、岗位地点和工作条件；2025/2026有关部分境外新申请的10万美元政策及法院判决存在实施争议，必须在正式递件时进行法律核验。"
    ],
    "documents": [
      "符合要求的美国雇主offer、岗位职责与职务薪酬",
      "毕业证、课程成绩单或专业等值资格资料",
      "雇主取得的LCA、公司资料及I-129申请所需支持文件",
      "若受年度名额约束，注册、选中和对应递交窗口证明"
    ],
    "steps": [
      "核实雇主企业主体与真正专业岗位，确定申请是否受年度cap约束或属于合格cap-exempt机构。",
      "按当年DOL职业地区标准测算工资等级，并让雇主核对LCA与实际工资条件。",
      "受cap约束时按USCIS现行年度注册规则操作；选中是递件资格，不是签证通过。",
      "由雇主/律师依据当期法规、总统公告及法院裁判确认费用与入境条件后递交I-129。",
      "获得必要批准及领馆签证（如需）后，在实际获准工作身份生效时开始对应雇佣。"
    ],
    "fees": [
      "2027财年USCIS已公告电子注册费每位215美元；这是注册费而不是所有费用总和。",
      "律师、I-129、反欺诈费、庇护计划费及加急处理等由真实申请情形确定；不能向求职者销售虚假抽签名额。",
      "2025/2026有关10万美元H-1B付款要求与诉讼判决存在争议，是否实际适用必须按递件时政府最新实施通知及法院状态确认，不在本站一概计入全部候选人的预算。"
    ],
    "rights": [
      "获批后通常只能在符合H-1B批准和LCA条件的专业岗位为相关雇主工作。",
      "失业、转换雇主、延长停留和家属就业有独立细则，不能认为工作签证永久有效。",
      "H-1B不是绿卡类别，但在符合条件时可以与独立的职业移民程序并行考虑。"
    ],
    "risks": [
      "抽中注册不等于H-1B获批，也不等于已获签或在美国合法工作的权限。",
      "工资等级和抽签权重对薪资较低的岗位影响较大，不能再承诺等概率或包中。",
      "10万美元收费的政策公告与法院执行状态并不完全一致，避免按单一旧新闻计算成本。"
    ],
    "timing": [
      "2027财年注册窗口为2026年3月4日至3月19日，已经结束；未来须核实USCIS正式发布的下一财年安排。",
      "I-129申请、生效日期及F-1 OPT衔接需由雇主和DSO提前协调。"
    ],
    "future": [
      "雇主可研究合格cap-exempt情形，但不可虚构学校关联关系规避配额。",
      "若职业经历与个人成果足够强，可以同时考察O-1或职业移民等独立通道。"
    ],
    "faq": [
      {
        "question": "2027财年还是完全随机抽签吗？",
        "answer": "不是，官方于2026年2月27日生效的加权规则适用于FY2027；应以USCIS现行制度判断。"
      },
      {
        "question": "注册中签是否能马上上班？",
        "answer": "不能。还需完成正式申请、批准和身份生效等条件。"
      },
      {
        "question": "是不是每个H-1B都必须支付10万美元？",
        "answer": "不能这样概括。公告、可能适用的境外申请条件和法院争议复杂，递件时必须核实官方实施指引和最新裁判。"
      }
    ],
    "highlights": [
      "2027财年加权筛选",
      "真实LCA与工资",
      "费用有法律争议"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations",
    "sources": [
      {
        "label": "USCIS H-1B官网",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations",
        "purpose": "专业岗位与雇主递件要求"
      },
      {
        "label": "USCIS FY2027注册公告",
        "url": "https://content.govdelivery.com/accounts/USDHSCIS/bulletins/406da02",
        "purpose": "加权选择、2026登记窗口和注册费"
      },
      {
        "label": "联邦公报加权选择规则",
        "url": "https://www.govinfo.gov/app/details/FR-2025-12-29/2025-23853",
        "purpose": "2026年生效法规"
      },
      {
        "label": "国务院H-1B限制说明",
        "url": "https://travel.state.gov/en/newsroom/visas/2025/restriction-on-entry-of-certain-nonimmigrant-workers.html",
        "purpose": "有关特别费用的公告原文"
      }
    ]
  }
];
