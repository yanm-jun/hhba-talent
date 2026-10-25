import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Building2, Globe2, HeartHandshake, Sunrise } from 'lucide-react';
import { Link } from '../router';
import { Shell } from '../components/Shell';
import type { User } from '../services/api';

/**
 * Dedicated HHBA vision page, distinct from the handwritten founder letter.
 * The four aspirations intentionally describe a hoped-for future, not product
 * claims or a live business performance statement.
 */
const futureVisions = [
  {
    number: '01', category: 'FOR EVERY PERSON', icon: Sunrise,
    title: '让每一个认真生活的人，都有机会走向更好的生活。',
    description: '我们期待一个更加开放、公平的就业环境。无论一个人来自哪里、拥有怎样的背景，都能凭借自己的能力、努力与创造获得成长的机会。',
    conviction: '让机会更加公平，让个人的发展拥有更多可能。'
  },
  {
    number: '02', category: 'FOR EVERY ORGANIZATION', icon: Building2,
    title: '让企业的繁荣与员工的成长，成为彼此成就的力量。',
    description: '我们期待企业取得的成功，不只体现在规模扩大和经营增长，也体现在团队的成长、员工生活的改善，以及更多人能够分享发展的成果。',
    conviction: '一家企业真正长久的力量，来自它与员工共同创造的未来。'
  },
  {
    number: '03', category: 'FOR A BETTER MARKET', icon: HeartHandshake,
    title: '让真正关心员工的企业，拥有被世界认可的机会。',
    description: '我们期待未来的市场，不仅关注企业创造了多少利润、生产了多少产品，也能够看见它对人的投入、对团队的培养，以及它长期承担的责任。',
    conviction: '当更多人愿意选择负责任的企业，良好的经营行为就有机会成为持续发展的力量。'
  },
  {
    number: '04', category: 'FOR THE FUTURE OF SOCIETY', icon: Globe2,
    title: '让经济的发展，最终转化为更多人的幸福。',
    description: '我们希望，技术的进步能够创造更多选择，商业的发展能够带来更好的生活，而社会的繁荣不只体现在增长的数字中，也体现在普通人真实而具体的获得感里。',
    conviction: '衡量进步的方式，应该包括人们是否因此生活得更好。'
  }
] as const;

export function VisionPage({ user }: { user: User | null }) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const root = sectionRef.current;
    if (!root || typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-vision-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });

    items.forEach(item => observer.observe(item));
    root.classList.add('join-vision-animate');
    return () => { observer.disconnect(); root.classList.remove('join-vision-animate'); };
  }, [sectionRef]);

  return <Shell user={user}><div className="join-page hhba-vision-page">
    <nav className="join-vision-navigation" aria-label="品牌理念页面导航">
      <Link to="/join" className="join-vision-back"><ArrowLeft size={16} aria-hidden="true"/> 返回加入我们</Link>
      <span>HHBA · 我们的愿景</span>
    </nav>
    <section className="join-vision" id="vision" ref={sectionRef} aria-labelledby="join-values-title">
    <header className="join-vision-opening" data-vision-reveal>
      <p className="join-vision-eyebrow">OUR VISION · HHBA</p>
      <h2 id="join-values-title">
        <span>我们相信，</span>
        <span>一个更好的商业社会，</span>
        <span className="join-vision-emphasis">应该让每一个参与创造价值的人，</span>
        <span className="join-vision-emphasis">都拥有更好的未来。</span>
      </h2>
      <span className="join-vision-rule" aria-hidden="true" />
      <div className="join-vision-opening-copy">
        <p>我们所向往的，不只是一个拥有更多工作机会的世界。</p>
        <p>更是一个让人的价值被认真对待，让企业的成就惠及更多参与者，让进步真正改善生活的世界。</p>
      </div>
      <div className="join-vision-scroll-hint" aria-hidden="true">
        <span>继续向下，了解我们向往的未来</span><ArrowDown size={17} />
      </div>
    </header>

    <div className="join-vision-chapters" aria-label="HHBA 四大未来愿景">
      {futureVisions.map((vision) => <article className="join-vision-chapter" key={vision.number} data-vision-reveal>
        <div className="join-vision-chapter-meta">
          <span>{vision.number} / {vision.category}</span>
          <span className="join-vision-chapter-symbol"><vision.icon size={24} strokeWidth={1.5} aria-hidden="true" /></span>
        </div>
        <div className="join-vision-chapter-content">
          <h3>{vision.title}</h3>
          <div><p>{vision.description}</p><p className="join-vision-conviction">{vision.conviction}</p></div>
        </div>
      </article>)}
    </div>

    <div className="join-vision-climax" data-vision-reveal>
      <p className="join-vision-climax-eyebrow">THE WORLD WE ENVISION</p>
      <h3>让人的成长，<br />成为企业发展的力量。<br /><span>让企业的发展，<br />成为社会进步的力量。</span></h3>
      <span className="join-vision-climax-rule" aria-hidden="true" />
      <p>我们相信，真正值得向往的繁荣，是每一个参与其中的人，都有机会从发展中受益。</p>
    </div>

    <div className="join-vision-promise" data-vision-reveal>
      <p className="join-vision-promise-eyebrow">FROM BELIEF TO PRACTICE</p>
      <h3>我们所向往的未来，<br />也应该从 HHBA 自己开始。</h3>
      <p>我们仍处在创业早期，还有许多目标尚未实现。但我们愿意将这些信念作为未来建立团队、制定制度和作出经营决定的方向。</p>
      <div className="join-vision-next" aria-hidden="true"><span>接下来，了解我们希望建立怎样的团队</span><ArrowDown size={16}/></div>
    </div>
  </section>
    <footer className="join-vision-page-footer"><span>HHBA — Human Capability Network</span><Link to="/join">了解加入我们的机会 <ArrowRight size={16} aria-hidden="true" /></Link></footer>
  </div></Shell>;
}

