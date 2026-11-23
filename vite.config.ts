import { defineConfig } from 'vite';

// Plain static site at the repository root, no framework and no bundler step.
// GitHub Pages serves this folder as-is; Vite only mirrors it for local dev.
export default defineConfig({
  root: '.',
  publicDir: false,
  appType: 'mpa',
  server: { host: '0.0.0.0', allowedHosts: true, cors: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: 'index.html', embed: 'embed.html' } } },
});
