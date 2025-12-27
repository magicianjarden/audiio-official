import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5180,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
