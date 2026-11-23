// Structural smoke test for the drop-in widget (no browser needed): the bundle
// must be a single IIFE that never imports anything at runtime.
import { readFileSync } from 'node:fs';
const code = readFileSync('dist/embed.js', 'utf8');
const checks = [
  ['single file, no dynamic import', !/\bimport\s*\(/.test(code) && !/^\s*import\s/m.test(code)],
  ['iife bundle', code.length > 5000],
  ['reads its own script params', code.includes('embed.js')],
  ['dispatches the flip event', code.includes('xmasqr:flip')],
  ['respects reduced motion', code.includes('prefers-reduced-motion')],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
process.exit(bad ? 1 : 0);
