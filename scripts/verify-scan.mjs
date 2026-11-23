// Renders the flat frame exactly as the page does and decodes it with jsQR —
// once at the browser's own pixels and once downscaled to what a camera captures.
//   node scripts/verify-scan.mjs
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import jsQRmod from 'jsqr';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const jsQR = jsQRmod.default ?? jsQRmod;
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync('public/js/tree-engine.js', 'utf8'), sandbox);
const engine = sandbox.window.QRTree;
if (!engine) throw new Error('engine did not load');
try { GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVuSansMono'); } catch { /* default font is fine */ }

const KEYS = ['plain', ...engine.KEYS, ...engine.EXTRA_KEYS];
const PAYLOADS = [
  'https://xmasqr.vercel.app/?tree=classic',
  'https://hh.kz/vacancy/12345678',
  'С Новым годом! 🎄 Спасибо, что были рядом весь год.',
  'https://example.com/?q=' + 'x'.repeat(160),
];
const VIEWS = [
  ['desktop', 1000, 700, 8, 0.86],
  ['phone', 390, 600, 6, 0.94],
];

function decodeAt(canvas, target) {
  const k = Math.min(1, target / Math.max(canvas.width, canvas.height));
  const small = createCanvas(Math.round(canvas.width * k), Math.round(canvas.height * k));
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const img = sctx.getImageData(0, 0, small.width, small.height);
  return jsQR(img.data, small.width, small.height, { inversionAttempts: 'attemptBoth' })?.data;
}

let fail = 0;
for (const [name, w, h, fs, fill] of VIEWS) {
  let ok = 0, total = 0;
  for (const text of PAYLOADS) for (const key of KEYS) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    engine.draw(ctx, w, h, text, key, {
      cam: 0, grow: key === 'plain' ? 0.001 : 1, drop: 1, time: 0, dpr: 1, fs, fill,
      fall: false, baubles: true, plate: 'none', clean: true,
    });
    total += 1;
    const native = decodeAt(canvas, Math.min(w, h)) === text;
    const capture = decodeAt(canvas, 640) === text;
    if (native && capture) ok += 1;
    else { fail += 1; console.log(`FAIL ${name} ${key} len=${text.length} native=${native} capture=${capture}`); }
  }
  console.log(`${ok === total ? 'PASS' : 'FAIL'} ${name.padEnd(8)} ${ok}/${total} frames decode`);
}
console.log(fail ? `\n${fail} frame(s) failed` : '\nall frames decode');
process.exit(fail ? 1 : 0);
