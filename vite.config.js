import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v1: resolve(__dirname, 'v1/index.html'),
        v2: resolve(__dirname, 'v2/index.html'),
      },
    },
  },
});
