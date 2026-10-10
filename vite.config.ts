import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const src = (dir: string) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

export default defineConfig({
  // Relative base so the build can be served from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@domain': src('domain'),
      '@application': src('application'),
      '@infrastructure': src('infrastructure'),
      '@presentation': src('presentation'),
      '@config': src('config'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three') || id.includes('postprocessing')) return 'r3f';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
