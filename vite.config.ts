/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3002,
    open: false,
    host: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'happy-dom',
    globals: true
  }
});
