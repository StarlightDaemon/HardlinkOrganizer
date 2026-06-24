import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Plugins and resolve.alias mirror vite.config.ts so tests share the same
// transform pipeline as the production build. Do not add aliases that the
// app build does not already declare.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
    alias: {
      '@fujin': resolve(__dirname, './src/fujin'),
      '@tokens': resolve(__dirname, './src/tokens.json'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**'],
    },
  },
});
