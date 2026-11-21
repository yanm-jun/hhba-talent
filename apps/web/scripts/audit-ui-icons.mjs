#!/usr/bin/env node
/**
 * HHBA frontend icon inventory.
 *
 * Run from any directory:
 *   node apps/web/scripts/audit-ui-icons.mjs
 *   node apps/web/scripts/audit-ui-icons.mjs --json
 *   node apps/web/scripts/audit-ui-icons.mjs --markdown
 *
 * This intentionally reports candidate locations, not a false guarantee that
 * every pictograph is an icon. Review emoji in UI context before replacing it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const roots = [
  'apps/web/src',
  'apps/web/public/preview-admin',
  'apps/admin-preview',
  'apps/browser-extension',
];
const allowed = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.html', '.css']);
const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'data', 'assets', 'tests', 'vendor']);
const checks = [
  ['lucideImport', /from\s*['"]lucide-react['"]/g],
  ['inlineSvg', /<svg\b/gi],
  ['svgFile', /\.(?:svg)(?=['"?#)\s])/gi],
  ['emojiCandidate', /\p{Extended_Pictographic}/gu],
  ['symbolCandidate', /[⌄⌕▦→←↗↘×✓✕✦＋－]/g],
  ['iconFont', /\b(?:iconfont|material-icons|fa-[a-z0-9-]+)\b/gi],
  ['cssSvg', /data:image\/svg\+xml/gi],
];
const files = [];
function walk(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const full = join(folder, item.name);
    if (item.isDirectory()) {
      if (!ignored.has(item.name)) walk(full);
    } else if (item.isFile() && allowed.has(extname(item.name)) && statSync(full).size < 2_000_000) {
      const source = readFileSync(full, 'utf8');
      const counts = Object.fromEntries(checks.map(([key, re]) => [key, [...source.matchAll(re)].length]));
      if (Object.values(counts).some(Boolean)) files.push({ path: relative(repo, full).replaceAll('\\', '/'), ...counts });
    }
  }
}
for (const root of roots) walk(resolve(repo, root));
files.sort((a, b) => a.path.localeCompare(b.path));
const totals = Object.fromEntries(checks.map(([key]) => [key, files.reduce((n, f) => n + f[key], 0)]));
const summary = { scannedRoots: roots, filesWithIconEvidence: files.length, totals, files };
const format = process.argv.includes('--json') ? 'json' : process.argv.includes('--markdown') ? 'markdown' : 'text';
if (format === 'json') {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else if (format === 'markdown') {
  process.stdout.write('## HHBA icon inventory (static source scan)\n\n');
  process.stdout.write('These are source occurrences, not unique icons or visual acceptance results.\n\n');
  process.stdout.write('| Source kind | Occurrences |\n|---|---:|\n');
  for (const [key, value] of Object.entries(totals)) process.stdout.write(`| ${key} | ${value} |\n`);
  process.stdout.write(`\nFiles with matches: ${files.length}. Emoji candidates require manual review.\n`);
} else {
  process.stdout.write('HHBA frontend icon source inventory\n');
  process.stdout.write(JSON.stringify(totals, null, 2) + '\n');
  process.stdout.write(`Files with matches: ${files.length}\n`);
  for (const f of files.filter(f => f.emojiCandidate > 0)) process.stdout.write(`Review pictographs: ${f.path} (${f.emojiCandidate})\n`);
}
