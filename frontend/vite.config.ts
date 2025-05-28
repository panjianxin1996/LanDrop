import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// if in ESM context
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@clientSDK":  path.resolve(__dirname, "./wailsjs/go/main"),
    }
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: true,
      },
    },
  }
})
