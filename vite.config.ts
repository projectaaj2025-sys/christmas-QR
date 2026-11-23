import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // the sandbox preview arrives through a proxy host, so accept any Host header
    allowedHosts: true,
    cors: true,
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
});
