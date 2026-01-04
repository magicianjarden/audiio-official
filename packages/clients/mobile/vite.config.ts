import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './src/web',
  // Use relative paths for GitHub Pages (works with any repo name), / for local
  base: process.env.GITHUB_PAGES === 'true' ? './' : '/',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/web'),
      '@shared': path.resolve(__dirname, './src/shared')
    }
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8484',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8484',
        ws: true
      }
    }
  }
});
