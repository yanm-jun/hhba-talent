// Fail-closed Cloudflare Pages auth API. No employer verification endpoints are enabled.
import {route} from '../../_lib/auth.js';
export const onRequest = route;
