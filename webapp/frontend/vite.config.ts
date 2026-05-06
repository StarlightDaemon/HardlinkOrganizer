import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fujin': resolve(__dirname, '../../Fujin/components'),
      '@tokens': resolve(__dirname, '../../Fujin/tokens.json'),
    },
  },
  server: {
    proxy: {
      '/api':    'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  build: {
    outDir:      '../static/dist',
    emptyOutDir: true,
  },
});
