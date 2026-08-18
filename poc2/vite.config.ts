import { defineConfig } from 'vite'

// base: './' keeps every asset path relative — required by RUL-08 (Itch.io packaging).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})
