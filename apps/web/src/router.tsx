import { useEffect, useState } from 'react';

// Project Pages uses /hhba-talent/, while Railway keeps routes at /.
const prefix = import.meta.env.BASE_URL === '/hhba-talent/' ? '/hhba-talent' : '';
const href = (to: string) => prefix + (to.startsWith('/') ? to : '/'+to);
function currentRoute() {
  const path = location.pathname;
  return prefix && path.startsWith(prefix + '/') ? path.slice(prefix.length) : (path === prefix ? '/' : path);
}
export function navigate(to: string) {
  history.pushState({}, '', href(to));
  dispatchEvent(new PopStateEvent('popstate'));
}
export function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const listener = () => setRoute(currentRoute());
    addEventListener('popstate', listener);
    return () => removeEventListener('popstate', listener);
  }, []);
  return route;
}
export function useNavigate() { return navigate; }
export function Link({ to, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href={href(to)} {...props} onClick={event => {
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault();
    navigate(to);
    onClick?.(event);
  }}>{children}</a>;
}
