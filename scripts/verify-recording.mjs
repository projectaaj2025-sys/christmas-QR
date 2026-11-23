// The downloaded animation must do what it promises: start on the tree, tilt
// down, and end on a QR frame that actually decodes — then ease back so the
// clip loops.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import jsQRmod from 'jsqr';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const jsQR = jsQRmod.default ?? jsQRmod;
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync('js/tree-engine.js', 'utf8'), sandbox);
const engine = sandbox.window.QRTree;
try { GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVuSansMono'); } catch { /* default font is fine */ }

let fail = 0;
const check = (ok, label, extra = '') => { if (!ok) fail += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };

// kept in sync with REC in js/app.js
const source = readFileSync('js/app.js', 'utf8');
const rec = /var REC = \{[^}]*hold: ([\d.]+), tilt: ([\d.]+), tail: ([\d.]+)/.exec(source);
check(!!rec, 'REC timings found in app.js');
const hold = Number(rec[1]), tilt = Number(rec[2]), tail = Number(rec[3]);
const total = hold + tilt + tail;
const tailBack = 0.9;

// the same camera curve as drawRecording()
function camAt(t) {
  const ease = engine.ease;
  if (t < hold) return 1;
  if (t < hold + tilt) return 1 - ease((t - hold) / tilt);
  if (t < total - tailBack) return 0;
  return ease((t - (total - tailBack)) / tailBack);
}

check(camAt(0) === 1, 'кадр 0 — стоящая ёлка', String(camAt(0)));
check(camAt(hold / 2) === 1, 'держится на ёлке');
check(camAt(hold + tilt / 2) > 0.1 && camAt(hold + tilt / 2) < 0.9, 'идёт наклон', camAt(hold + tilt / 2).toFixed(2));
check(camAt(hold + tilt + 0.1) === 0, 'приходит к QR-коду');
check(camAt(total - 0.01) > 0.9, 'в конце возвращается к ёлке для склейки', camAt(total - 0.01).toFixed(2));

// how long the code is held still, and does it decode at that size
const codeHold = tail - tailBack;
check(codeHold >= 1.5, 'код держится на экране достаточно долго', codeHold + ' c');

const side = 960;
for (const [key, text] of [['classic', 'https://hh.kz/vacancy/12345678'], ['neon', 'https://xmasqr.vercel.app/?tree=neon'], ['plain', 'С Новым годом! 🎄']]) {
  const canvas = createCanvas(side, side);
  const ctx = canvas.getContext('2d');
  engine.draw(ctx, side, side, text, key, {
    cam: 0, grow: 1, drop: 1, time: hold + tilt + 1, dpr: 1, fs: 8, fill: 0.88,
    fall: true, baubles: true, plate: 'none', clean: true,
  });
  const img = ctx.getImageData(0, 0, side, side);
  const found = jsQR(img.data, side, side, { inversionAttempts: 'attemptBoth' });
  check(found?.data === text, `кадр кода из клипа декодируется (${key})`);
}

console.log(fail ? `\n${fail} check(s) failed` : '\nзапись анимации OK');
process.exit(fail ? 1 : 0);
