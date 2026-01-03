import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['essentia.js', '@audiio/ml-core']
    },
    commonjsOptions: {
      exclude: ['@audiio/ml-core']
    }
  },
  optimizeDeps: {
    exclude: ['essentia.js', '@audiio/ml-core']
  }
});
