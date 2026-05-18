import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  clearScreen: false,
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('@element-plus/icons-vue')) {
            return 'ui-icons'
          }

          if (id.includes('element-plus')) {
            const componentMatch = id.match(/element-plus\/(?:es|lib)\/components\/([^/]+)/)
            if (componentMatch?.[1]) {
              return `ui-${componentMatch[1]}`
            }
            return 'ui-core'
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri-vendor'
          }

          if (id.includes('pinia') || id.includes('/vue/')) {
            return 'framework'
          }

          if (id.includes('brotli-dec-wasm')) {
            return 'wasm-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 1420,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
})
