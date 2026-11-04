// Legacy filename kept for predictable module imports; this component is now noninteractive.
// No consent prompt or account-tracking listener is mounted anywhere in the app.
import {useEffect} from 'react';
import {useRoute} from '../router';
import {trackEvent} from '../services/engagement';
export function AnonymousTrafficTracker(){
 const route=useRoute();
 useEffect(()=>{
  if(import.meta.env.BASE_URL==='/hhba-talent/')return;
  // Private, auth and form routes never produce page-view counts.
  if(/^\/(?:candidate\/(?:account(?:\/|$)|saved(?:\/|$)|login|register|email-login|email-register|resume(?:\/|$)|match(?:\/|$)|profile|review|my-applications)|recruiter(?:\/|$)|auth(?:\/|$)|employee(?:\/|$)|admin(?:\/|$)|join(?:\/|$)|public(?:\/|$))/.test(route))return;
  trackEvent('page_view');
  if(/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/.test(route))trackEvent('job_view');
 },[route]);
 return null;
}
