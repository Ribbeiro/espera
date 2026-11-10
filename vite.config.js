import { defineConfig } from 'vite';

export default defineConfig({
  base: '/leandroemariana/',
  build: { assetsInlineLimit: 0, sourcemap: false },
  server: { host: true },
});
