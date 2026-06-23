import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    // Pre-bundle at server start. Without listing hash-wasm (imported by the MD5
    // hash web worker), Vite only discovers + optimizes it the first time an
    // upload runs, which forces a full-page reload mid-hash.
    include: ['date-fns', 'hash-wasm']
  }
})
