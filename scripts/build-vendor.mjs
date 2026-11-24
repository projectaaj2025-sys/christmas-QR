// Rebuilds vendor/encoders.js (gifenc + mp4-muxer as one browser bundle).
// Only needed after bumping those dependencies.
import { build } from 'esbuild';

await build({
  stdin: {
    contents: [
      "import { GIFEncoder, quantize, applyPalette } from 'gifenc';",
      "import { Muxer, ArrayBufferTarget } from 'mp4-muxer';",
      "window.GIFEncoder = GIFEncoder; window.quantize = quantize; window.applyPalette = applyPalette;",
      "window.Mp4Muxer = Muxer; window.Mp4Target = ArrayBufferTarget;",
    ].join('\n'),
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  mainFields: ['browser', 'module', 'main'],
  outfile: 'vendor/encoders.js',
  minify: true,
  legalComments: 'inline',
});
console.log('vendor/encoders.js rebuilt');
