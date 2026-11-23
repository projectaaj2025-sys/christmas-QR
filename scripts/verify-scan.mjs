// Renders the scene headlessly and decodes the flat-code frame with jsQR.
//   node scripts/verify-scan.mjs [payload...]
import { createCanvas } from '@napi-rs/canvas';
import jsQR from 'jsqr';
import { build } from 'esbuild';

const payloads = process.argv.slice(2);
const cases =
  payloads.length > 0
    ? payloads
    : [
        'https://xmasqr.vercel.app/?tree=classic',
        'https://example.com/gift/2026?from=santa&note=с-наступающим-новым-годом',
        'С Новым годом! 🎄 Спасибо, что были рядом весь год.',
        'a'.repeat(180),
      ];

const bundle = await build({
  entryPoints: ['src/lib/scene.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'browser',
  mainFields: ['module', 'main'],
});
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);

let failures = 0;
for (const text of cases) {
  for (const look of ['classic', 'aurora', 'candy', 'gold']) {
    const { KINDS } = await import('../src/lib/looks.ts').catch(() => ({ KINDS: null }));
    const palettes = KINDS ?? (await import('../src/lib/looks.ts')).KINDS;
    const canvas = createCanvas(1200, 900);
    const ctx = canvas.getContext('2d');
    mod.drawScene(ctx, 1200, 900, {
      text,
      look: palettes[look],
      morph: 1,
      time: 4,
      snowfall: 1,
    });
    const img = ctx.getImageData(0, 0, 1200, 900);
    const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    const ok = found?.data === text;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${look.padEnd(8)} len=${String(text.length).padStart(3)} ` +
        `${ok ? '' : `decoded=${JSON.stringify(found?.data ?? null)}`}`,
    );
  }
}
console.log(failures === 0 ? '\nall frames decode' : `\n${failures} frame(s) failed`);
process.exit(failures === 0 ? 0 : 1);
