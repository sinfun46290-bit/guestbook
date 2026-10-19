import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any subpath (GitHub Pages, IPFS, etc.)
  base: './',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
