import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    strictPort: false // Allow fallback to next available port
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['essentia.js']
    }
  },
  optimizeDeps: {
    exclude: ['essentia.js']
  }
});
