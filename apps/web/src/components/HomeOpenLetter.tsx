import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Copy, MailOpen, Share2, X } from 'lucide-react';
import { HHBA_PUBLIC_LETTER } from '../data/publicLetter';
import '../styles/home-open-letter.css';

type Stage = 'envelope' | 'letter' | null;
const SESSION_KEY = 'hhba:public-letter:seen:v1';
const OPEN_EVENT = 'hhba:open-letter';

function firstStage(): Stage {
  // Links shared publicly must open the letter even after earlier visits.
  if (new URLSearchParams(window.location.search).get('letter') === '1') return 'envelope';
  try { return window.sessionStorage.getItem(SESSION_KEY) === '1' ? null : 'envelope'; }
  catch { return 'envelope'; }
}
function shareUrl() {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL('letter/', base).toString();
}
function removeExplicitFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('letter') !== '1') return;
  url.searchParams.delete('letter');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

export function HomeOpenLetter() {
  const [stage, setStage] = useState<Stage>(firstStage);
  const [feedback, setFeedback] = useState('');
  const layer = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* storage may be disabled */ }
    removeExplicitFlag();
    setStage(null);
    setFeedback('');
  }, []);
  useEffect(() => {
    const reopen = () => { setFeedback(''); setStage('envelope'); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);
  useEffect(() => {
    if (!stage) return;
    const activeBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    layer.current?.querySelector<HTMLElement>(stage === 'envelope' ? '[data-letter-open]' : '[data-letter-close]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(layer.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]') || [])];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      activeBefore?.focus();
    };
  }, [stage, dismiss]);

  const copyLink = async () => {
    const link = shareUrl();
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('公开信链接已复制，可以发送给朋友。');
    } catch {
      window.prompt('请复制这封信的链接：', link);
      setFeedback('你可以将这封信的链接分享给朋友。');
    }
  };
  const share = async () => {
    const link = shareUrl();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: '致每一个认真生活的人｜HHBA',
          text: '让劳动更有尊严，让商业更有温度。我们想认真地和你谈谈，为什么创立 HHBA。',
          url: link,
        });
        setFeedback('感谢你把这封信分享出去。');
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  };
  const reopen = () => { setFeedback(''); setStage('envelope'); };
  const fontUrl = `${import.meta.env.BASE_URL}fonts/hhba-people-xingshu.woff2`;
  const popup = stage && createPortal(
    <div className="hhba-letter-overlay" ref={layer} data-stage={stage}>
      <style>{`@font-face{font-family:"HHBA People Xingshu";src:url("${fontUrl}") format("woff2");font-style:normal;font-weight:400;font-display:swap}`}</style>
      <div className="hhba-letter-panel" role="dialog" aria-modal="true" aria-labelledby="hhba-letter-title">
        {stage === 'envelope' ? (
          <section className="hhba-letter-intro" aria-label="来自 HHBA 的一封信">
            <button className="hhba-letter-close" onClick={dismiss} type="button" aria-label="关闭公开信，进入首页" data-letter-close><X size={20}/></button>
            <p className="hhba-letter-kicker">HHBA · A LETTER TO EVERYONE</p>
            <p className="hhba-letter-eyebrow">你收到一封信</p>
            <button type="button" className="hhba-letter-envelope" onClick={()=>setStage('letter')} data-letter-open aria-label="拆开这封信">
              <span className="hhba-letter-envelope-paper" aria-hidden="true"/>
              <span className="hhba-letter-envelope-back" aria-hidden="true"/>
              <span className="hhba-letter-envelope-flap" aria-hidden="true"/>
              <span className="hhba-letter-envelope-front" aria-hidden="true"/>
              <span className="hhba-letter-envelope-seal" aria-hidden="true">HHBA</span>
            </button>
            <h2 id="hhba-letter-title">致每一个认真生活的人</h2>
            <p className="hhba-letter-teaser">无论你是谁，都想认真地和你说几句话。</p>
            <button type="button" className="hhba-letter-primary" onClick={()=>setStage('letter')}><MailOpen size={17}/> 拆开这封信</button>
            <div className="hhba-letter-intro-actions">
              <button type="button" onClick={share}><Share2 size={16}/> 分享给朋友</button>
              <button type="button" onClick={dismiss}>暂不阅读，进入首页</button>
            </div>
            <p className="hhba-letter-feedback" role="status" aria-live="polite">{feedback}</p>
          </section>
        ) : (
          <section className="hhba-letter-paper" aria-label="HHBA 完整公开信">
            <header className="hhba-letter-paper-head">
              <span>HHBA · A LETTER TO EVERYONE</span>
              <button type="button" data-letter-close onClick={dismiss} className="hhba-letter-close" aria-label="关闭公开信，进入首页"><X size={20}/></button>
            </header>
            <div className="hhba-letter-paper-title">
              <p>一封写给每一个普通人的信</p>
              <h2 id="hhba-letter-title">致每一个认真生活的人</h2>
              <span className="hhba-letter-red-rule" aria-hidden="true"/>
            </div>
            <article className="hhba-letter-paper-scroll" tabIndex={0} aria-label="公开信全文，可向下滚动阅读">
              {HHBA_PUBLIC_LETTER.map((part,index)=><p key={index} className={part.kind ? `hhba-letter-line hhba-letter-${part.kind}` : 'hhba-letter-line'}>{part.text}</p>)}
            </article>
            <footer className="hhba-letter-paper-footer">
              <button type="button" className="hhba-letter-outline" onClick={share}><Share2 size={16}/> 分享这封信</button>
              <button type="button" className="hhba-letter-copy" onClick={copyLink}><Copy size={15}/> 复制链接</button>
              <button type="button" className="hhba-letter-primary" onClick={dismiss}>读完了，进入 HHBA <ArrowRight size={17}/></button>
            </footer>
            <p className="hhba-letter-paper-status" role="status" aria-live="polite">{feedback}</p>
          </section>
        )}
      </div>
    </div>, document.body
  );
  return <>
    <button type="button" className="hhba-letter-hidden-reopen" onClick={reopen} aria-hidden="true" tabIndex={-1}>重读这封信</button>
    {popup}
  </>;
}
