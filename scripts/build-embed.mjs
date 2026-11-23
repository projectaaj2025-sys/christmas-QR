// The drop-in widget must be one self-contained file: hosts paste a single
// <script src="…/embed.js"> and nothing else may be fetched.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const result = await build({
  entryPoints: ['src/embed.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: 'dist/embed.js',
  legalComments: 'none',
  logLevel: 'info',
});
if (result.errors.length) process.exit(1);
