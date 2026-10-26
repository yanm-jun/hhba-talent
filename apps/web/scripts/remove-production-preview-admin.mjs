import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve(process.cwd(), 'dist', 'preview-admin');
await rm(out, { recursive: true, force: true });
console.log(`Removed non-production static admin preview: ${out}`);
