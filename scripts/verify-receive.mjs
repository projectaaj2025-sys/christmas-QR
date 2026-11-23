// End-to-end check of "receive a tree": render a tree, "screenshot" it, read the
// code back with the same code path the dialog uses, and confirm the app state
// round-trips (payload, greeting, style, sender).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bundle = async (entry) => {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'browser',
    mainFields: ['module', 'main'],
  });
  const code = out.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
};

// jsdom-free stand-ins for the two browser globals scanQr.ts touches
globalThis.ImageData = class {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

const scene = await bundle('src/lib/scene.ts');
const { KINDS } = await bundle('src/lib/looks.ts');
const { scanImageData } = await bundle('src/lib/scanQr.ts');
const { buildLink, readState } = await bundle('src/lib/urlState.ts');

const cases = [
  { kind: 'classic', payload: 'https://hh.kz/vacancy/12345678', from: 'Айгуль', message: 'С Новым годом!' },
  { kind: 'fairy', payload: 'WIFI:T:WPA;S:Home_5G;P:merry-christmas;;', from: '', message: '' },
  { kind: 'glitch', payload: 'С Новым годом! 🎄', from: 'santa', message: '🎁' },
];

const dir = mkdtempSync(join(tmpdir(), 'xmas-receive-'));
let failures = 0;

for (const [i, c] of cases.entries()) {
  const link = buildLink(
    { kind: c.kind, payload: c.payload, message: c.message, from: c.from },
    'https://xmasqr.example/',
  );
  const canvas = createCanvas(1400, 1050);
  scene.drawScene(canvas.getContext('2d'), 1400, 1050, {
    text: link,
    look: KINDS[c.kind],
    morph: 1,
    time: 3,
    snowfall: 0,
    baubles: false,
  });
  // a screenshot is smaller than the stage: this is what a friend would paste
  const shot = createCanvas(900, 675);
  shot.getContext('2d').drawImage(canvas, 0, 0, 900, 675);
  const img = shot.getContext('2d').getImageData(0, 0, 900, 675);
  const found = scanImageData({
    data: img.data,
    width: img.width,
    height: img.height,
  });
  const state = found ? readState(new URL(found).search) : null;
  const ok =
    state &&
    state.url === c.payload &&
    state.message === c.message &&
    state.kind === c.kind &&
    (c.from ? state.from === c.from : !state.from);
  if (!ok) {
    failures += 1;
    writeFileSync(join(dir, `fail-${i}.png`), shot.toBuffer('image/png'));
  }
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${c.kind.padEnd(8)} ${found ? '' : 'no code found'} ` +
      `${found && !ok ? JSON.stringify(state) : ''}`,
  );
}

console.log(failures === 0 ? '\nreceive flow round-trips' : `\n${failures} case(s) failed, see ${dir}`);
process.exit(failures ? 1 : 0);
