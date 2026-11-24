// The GIF path end to end, minus the browser: encode a clip with the same
// gifenc calls app.js makes, check the bytes are a real GIF89a, and check the
// final (code) frame still decodes after palette quantisation.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import gifenc from 'gifenc';
import jsQR from 'jsqr';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync('js/tree-engine.js', 'utf8'), sandbox);
const engine = sandbox.window.QRTree;
try { GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVuSansMono'); } catch { /* default font is fine */ }

let fail = 0;
const check = (ok, label, extra = '') => { if (!ok) fail += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };

const source = readFileSync('js/app.js', 'utf8');
const gifCfg = /var side = (\d+), fps = (\d+), total = recDuration\(\)/.exec(source);
check(!!gifCfg, 'параметры GIF найдены в app.js', gifCfg ? `${gifCfg[1]}px, ${gifCfg[2]} fps` : '');
const side = Number(gifCfg?.[1] || 480), fps = Number(gifCfg?.[2] || 10);

// the same palette settings the page uses
const paletteSize = Number((/quant\(data, (\d+),/.exec(source) || [])[1] || 96);
check(paletteSize >= 64 && paletteSize <= 256, 'палитра GIF разумного размера', `${paletteSize} цветов`);

// three frames is enough to prove the pipeline: tree, mid-tilt, code
const text = 'https://hh.kz/vacancy/12345678';
const canvas = createCanvas(side, side);
const ctx = canvas.getContext('2d');
const gif = GIFEncoder();
let lastPixels = null;
for (const [i, cam] of [1, 0.5, 0].entries()) {
  engine.draw(ctx, side, side, text, 'classic', {
    cam, grow: 1, drop: 1, time: 3.2 + i, dpr: 1, fs: 7, fill: 0.88,
    fall: true, baubles: true, plate: 'none', clean: true,
  });
  const rgba = ctx.getImageData(0, 0, side, side).data;
  const palette = quantize(rgba, paletteSize, { format: 'rgb565' });
  const indexed = applyPalette(rgba, palette, 'rgb565');
  gif.writeFrame(indexed, side, side, { palette, delay: Math.round(1000 / fps), repeat: 0 });
  const rebuilt = new Uint8ClampedArray(side * side * 4);
  for (let p = 0; p < indexed.length; p++) {
    const c = palette[indexed[p]];
    rebuilt[p * 4] = c[0]; rebuilt[p * 4 + 1] = c[1]; rebuilt[p * 4 + 2] = c[2]; rebuilt[p * 4 + 3] = 255;
  }
  lastPixels = rebuilt;
}
gif.finish();
const bytes = gif.bytes();

check(Buffer.from(bytes.slice(0, 6)).toString('latin1') === 'GIF89a', 'файл — настоящий GIF89a');
check(bytes.length > 5000, 'в файле есть данные', `${(bytes.length / 1024).toFixed(0)} КБ на 3 кадра`);
const frames = Buffer.from(bytes).toString('latin1').split('\x00\x2c').length - 1;
check(frames >= 3, 'в файле несколько кадров', String(frames));
check(Buffer.from(bytes.slice(-1)).toString('latin1') === ';', 'файл корректно закрыт');

const found = jsQR(lastPixels, side, side, { inversionAttempts: 'attemptBoth' });
check(found?.data === text, 'код с последнего кадра GIF читается', found ? JSON.stringify(found.data).slice(0, 40) : 'нет');

// и полный прогон по ёлкам: кадр кода после квантования должен читаться всегда
let ok = 0, total = 0;
for (const key of ['classic', 'neon', 'snow', 'lace', 'plain']) {
  const c = createCanvas(side, side), x = c.getContext('2d');
  engine.draw(x, side, side, text, key, { cam: 0, grow: 1, drop: 1, time: 5, dpr: 1, fs: 7, fill: 0.88, fall: true, baubles: true, plate: 'none', clean: true });
  const rgba = x.getImageData(0, 0, side, side).data;
  const palette = quantize(rgba, paletteSize, { format: 'rgb565' });
  const idx = applyPalette(rgba, palette, 'rgb565');
  const out = new Uint8ClampedArray(side * side * 4);
  for (let p = 0; p < idx.length; p++) { const col = palette[idx[p]]; out[p * 4] = col[0]; out[p * 4 + 1] = col[1]; out[p * 4 + 2] = col[2]; out[p * 4 + 3] = 255; }
  total += 1;
  if (jsQR(out, side, side, { inversionAttempts: 'attemptBoth' })?.data === text) ok += 1;
}
check(ok === total, 'квантование не ломает код ни в одной ёлке', `${ok}/${total}`);

console.log(fail ? `\n${fail} check(s) failed` : '\nGIF OK');
process.exit(fail ? 1 : 0);
