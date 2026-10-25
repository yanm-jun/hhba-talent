import { useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarHeart,
  CheckCircle2, ChevronDown, Clock3, Coins, GraduationCap, Handshake,
  HeartHandshake, Info, Layers3, ShieldPlus, Sparkles, UsersRound, Wallet
} from 'lucide-react';
import { Shell } from '../components/Shell';
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
  { id: 'engineering', team: '技术研发', title: '全栈 / 后端研发伙伴', desc: '建设用户系统、招聘业务 API、数据库和稳定的生产服务。', details: '熟悉 Web 应用开发、接口设计与数据安全；能够独立处理复杂问题，并重视测试、文档和代码质量。' },
  { id: 'ai-data', team: 'AI 与数据', title: 'AI 与数据工程伙伴', desc: '打造可靠的岗位数据处理、搜索匹配与 AI 功能。', details: '了解 Python、数据处理、搜索技术或大模型应用；重视数据来源、隐私保护、成本控制和结果可验证性。' },
  { id: 'product', team: '产品设计', title: '产品设计 / UI·UX 伙伴', desc: '让复杂的招聘、企业与审核流程真正简单好用。', details: '能够做产品研究、信息架构、交互设计和前端视觉协作；愿意用真实用户反馈打磨产品。' },
  { id: 'business', team: '运营与商业', title: '运营与商业合作伙伴', desc: '探索企业合作、社区增长、市场推广与商业资源连接。', details: '有主动沟通、项目执行与商业分析能力；认可守信合作与对求职者友好的长期理念。' },
  { id: 'other', team: '开放申请', title: '其他专业 / 自荐加入', desc: '如果你的能力不属于上述方向，也欢迎介绍你能解决的问题。', details: '请在申请意向中说明你擅长的方向、相关项目，以及你希望与 HHBA 共同完成的事情。' },
] as const;

type Direction = typeof roles[number]['id'];
type FormData = {
  name: string; contactType: string; contact: string; direction: Direction | '';
  experience: string; portfolio: string; strength: string;
  weeklyTime: string; mode: string; note: string; acknowledged: boolean;
};
const blank: FormData = {
  name: '', contactType: '邮箱', contact: '', direction: '',
  experience: '', portfolio: '', strength: '',
  weeklyTime: '', mode: '', note: '', acknowledged: false,
};

function JumpButton({ onClick, secondary = false, children }: {
  onClick: () => void; secondary?: boolean; children: React.ReactNode
}) {
  return <button type="button" className={secondary ? 'join-btn join-btn-light' : 'join-btn join-btn-primary'} onClick={onClick}>
    {children}<ArrowUpRight size={16} aria-hidden="true" />
  </button>;
}

export function JoinUsPage({ user }: { user: User | null }) {
  const rolesRef = useRef<HTMLElement | null>(null);
  const valuesRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(blank);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
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
    if (!form.weeklyTime || !form.mode || !form.acknowledged) {
      setError('请填写合作安排，并确认已知悉当前创业阶段说明。'); return;
    }
    setError('');
    setPreview(true);
    jump(formRef);
  };
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
            <JumpButton secondary onClick={() => jump(valuesRef)}>了解我们的理念</JumpButton>
          </div>
          <div className="join-stage-banner"><Info size={16} aria-hidden="true" /><span><strong>真实进展：</strong>HHBA 仍在公司筹备与融资前阶段，目前招募早期合作伙伴，尚未提供已落实的正式薪酬和股权方案。</span></div>
        </div>
        <div className="join-hero-art" aria-hidden="true">
          <div className="join-art-orbit join-orbit-one" />
          <div className="join-art-orbit join-orbit-two" />
          <div className="join-art-node join-node-one"><UsersRound size={24}/></div>
          <div className="join-art-node join-node-two"><Layers3 size={24}/></div>
          <div className="join-art-node join-node-three"><Handshake size={24}/></div>
          <div className="join-art-core"><span>HHBA</span><small>BUILD TOGETHER</small></div>
          <p className="join-art-caption">让每一位建设者，都被看见。</p>
        </div>
      </section>

      <section className="join-section" id="join-values" ref={valuesRef} aria-labelledby="join-values-title">
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
          <p>当前以早期合作方向为主，不是已经提供固定薪资的正式招聘职位。我们更看重解决问题的能力、专业投入与价值观。</p>
        </div>
        <div className="join-role-list">
          {roles.map(r => <details className="join-role" key={r.id}>
            <summary><span className="join-role-identity"><small>{r.team} · 早期合作方向</small><strong>{r.title}</strong><span>{r.desc}</span></span><ChevronDown className="join-role-chevron" size={21} aria-hidden="true"/></summary>
            <div className="join-role-detail"><p>{r.details}</p><p>具体参与范围、时间安排及当前报酬条件在双方沟通时确认，未确定前不作正式雇佣或股权承诺。</p>
              <button type="button" onClick={() => applyFor(r.id)}>填写该方向合作意向 <ArrowRight size={16} aria-hidden="true"/></button>
            </div>
          </details>)}
        </div>
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

      <section className="join-section join-apply-section" id="join-apply" ref={formRef} aria-labelledby="join-apply-title">
        <div className="join-section-head">
          <p className="join-kicker">SAY HELLO</p>
          <h2 id="join-apply-title">告诉我们，你想一起做什么。</h2>
          <p>先体验这套三步合作意向流程。当前是 GitHub Pages 静态预览，尚无安全申请接收接口，因此不会发送或保存你填写的任何资料。</p>
        </div>
        <div className="join-form-shell">
          <div className="join-form-progress" aria-label="合作意向步骤">
            {['基本信息','专业能力','合作意向'].map((label,i) => <span className={i===step ? 'is-current' : i<step ? 'is-complete' : ''} key={label}><b>{i<step ? '✓' : String(i+1).padStart(2,'0')}</b>{label}</span>)}
          </div>
          {preview ? <div className="join-form-body join-form-preview">
            <span className="join-icon"><CheckCircle2 size={23}/></span>
            <h3>合作意向预览</h3>
            <p className="join-preview-warning">这是你在浏览器内填写的摘要，<strong>未提交、未发送、未存入 HHBA 数据库</strong>。正式申请通道尚待接入。</p>
            <dl>
              <div><dt>称呼</dt><dd>{form.name.trim()}</dd></div>
              <div><dt>合作方向</dt><dd>{selectedRole?.title || '—'}</dd></div>
              <div><dt>每周投入</dt><dd>{form.weeklyTime}</dd></div>
              <div><dt>合作偏好</dt><dd>{form.mode}</dd></div>
            </dl>
            <div className="join-form-actions"><button type="button" className="join-btn join-btn-light" onClick={() => {setPreview(false);setStep(0)}}>返回修改 <ArrowLeft size={16}/></button><span className="join-preview-disabled">正式在线申请：尚未开放</span></div>
          </div> : <form className="join-form-body" onSubmit={e => {e.preventDefault(); if(step<2)next();else showPreview()}} noValidate>
            {step === 0 && <>
              <h3>先认识一下你</h3><p className="join-form-description">你可以先使用常用称呼，不必在静态预览中填写真实隐私信息。</p>
              <label htmlFor="join-name">怎么称呼你？ <em>*</em></label>
              <input id="join-name" value={form.name} maxLength={80} autoComplete="off" onChange={e=>update('name',e.target.value)} placeholder="姓名或常用称呼" />
              <div className="join-field-row">
                <div><label htmlFor="join-contact-type">联系方式类别 <em>*</em></label><select id="join-contact-type" value={form.contactType} onChange={e=>update('contactType',e.target.value)}><option>邮箱</option><option>微信</option><option>手机号</option><option>其他</option></select></div>
                <div><label htmlFor="join-contact">联系方式 <em>*</em></label><input id="join-contact" autoComplete="off" maxLength={180} value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="仅用于体验，不会发送" /></div>
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
            </>}
            {error && <p className="join-form-error" role="alert">{error}</p>}
            <div className="join-form-actions">
              {step > 0 && <button type="button" className="join-btn join-btn-light" onClick={() => {setStep(s=>s-1);setError('')}}><ArrowLeft size={16} /> 上一步</button>}
              <button type="submit" className="join-btn join-btn-primary">{step === 2 ? '查看填写摘要' : '下一步'} <ArrowRight size={16}/></button>
            </div>
            <p className="join-form-security"><Info size={14}/> 静态体验版本：不发送网络请求、不保存申请资料、不会产生已提交记录。</p>
          </form>}
        </div>
      </section>
      <footer className="join-footer"><strong>HHBA.</strong><span>让机会与人才，找到彼此。也让真正的建设者，共同分享未来。</span></footer>
    </div>
  </Shell>;
}
