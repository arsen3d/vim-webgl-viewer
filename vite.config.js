import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      formats: ['iife', 'es'],
      entry: './src/vim.ts',
      name: 'VIM'
    },
    // Minify set to true will break the IIFE output
    minify: false,
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  }
})
