import { useEffect, useState } from 'react';
export function navigate(to: string) { history.pushState({}, '', to); dispatchEvent(new PopStateEvent('popstate')); }
export function useRoute() { const [route, setRoute] = useState(location.pathname); useEffect(() => { const listener = () => setRoute(location.pathname); addEventListener('popstate', listener); return () => removeEventListener('popstate', listener); }, []); return route; }
export function useNavigate() { return navigate; }
export function Link({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) { return <a href={to} onClick={(event) => { event.preventDefault(); navigate(to); }} {...props}>{children}</a>; }
