import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1' },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
