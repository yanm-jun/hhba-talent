import homepagePublicConfig from '../../../src/data/homepagePublicConfig.json' with { type: 'json' };
import {json} from '../../_lib/metric-utils.js';

// Public, read-only homepage configuration. It contains no member, payment or case data.
// Purchase and case intake stay disabled until their dedicated backend workflows are implemented.
export async function onRequestGet(){
 return json(homepagePublicConfig);
}
