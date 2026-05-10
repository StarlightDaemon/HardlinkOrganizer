import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
    alias: {
      '@fujin': resolve(__dirname, './src/fujin'),
      '@tokens': resolve(__dirname, './src/tokens.json'),
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
