import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'katex': fileURLToPath(new URL('./node_modules/katex', import.meta.url)),
      'markdown-it': fileURLToPath(new URL('./node_modules/markdown-it', import.meta.url)),
      'markdown-it-katex': fileURLToPath(new URL('./node_modules/markdown-it-katex', import.meta.url)),
      '@iconify/vue': fileURLToPath(new URL('./node_modules/@iconify/vue', import.meta.url)),
      '@vueuse/core': fileURLToPath(new URL('./node_modules/@vueuse/core', import.meta.url)),
      'vue': fileURLToPath(new URL('./node_modules/vue', import.meta.url)),
      'xlsx': fileURLToPath(new URL('./node_modules/xlsx', import.meta.url)),
      'marked': fileURLToPath(new URL('./node_modules/marked', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      // Allow importing micro-app source code from the monorepo root (e.g. ../../apps/*)
      allow: [fileURLToPath(new URL('..', import.meta.url))]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8150',
        changeOrigin: true
      }
    }
  }
})
