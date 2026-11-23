// Copy the static site into dist/ and bundle the optional drop-in widget.
// Keep build-embed.mjs (React variant) out of this pipeline.
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('dist/ built from public/');
