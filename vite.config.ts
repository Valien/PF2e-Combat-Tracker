import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/Initiative-Tracker/',
  build: {
    cssMinify: 'esbuild', // Use esbuild instead of lightningcss to avoid @property warnings
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split the monster data JSONs into a dedicated chunk so the main
          // bundle stays small. Without this, all 95 pathfinder source JSONs
          // (~1.5 MB) get inlined into the main entry chunk.
          if (id.includes('src/data/pathfinder/')) {
            return 'monster-data'
          }
          // Firebase is heavy and only loaded when online mode is used. Split
          // it into its own chunk so it can lazy-load on demand.
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase'
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'vmThreads',
  },
})
