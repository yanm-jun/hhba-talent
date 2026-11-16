import homepagePublicConfig from '../../../src/data/homepagePublicConfig.json';
import {json} from '../../_lib/metric-utils.js';

// Public, read-only homepage configuration. It contains no member, payment or case data.
// Keep the JSON import attribute-free: Cloudflare Pages Functions bundles JSON imports directly.
// Purchase and case intake stay disabled until their dedicated backend workflows are implemented.
export async function onRequestGet(){
 return json(homepagePublicConfig);
}
