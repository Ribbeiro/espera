import { defineConfig } from 'vite';

export default defineConfig({
  base: '/espera/',
  build: { assetsInlineLimit: 0, sourcemap: false },
  server: { host: true },
});
