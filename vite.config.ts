import { defineConfig } from 'vite';

// The site is plain ES5 + a canvas engine, exactly like the original build:
// no framework, no bundler step. Vite only serves and previews ./public.
export default defineConfig({
  root: 'public',
  publicDir: false,
  server: { host: '0.0.0.0', allowedHosts: true, cors: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { outDir: '../dist', emptyOutDir: true },
});
