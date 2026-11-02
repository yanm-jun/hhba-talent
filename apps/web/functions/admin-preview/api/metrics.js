// Keep protected metrics beneath the *original* HHBA admin-preview path.
// Cloudflare Access covers hhba-talent.pages.dev/admin-preview and all subpaths.
// The implementation still verifies the Access JWT signature, audience and admin allowlist.
export {onRequestGet} from '../../api/admin/metrics.js';
