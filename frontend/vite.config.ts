import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import v8 from 'node:v8';

console.log('⚠️  V8内存限制:', (v8.getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(2), 'MB');

// if in ESM context
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.svg"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@clientSDK":  path.resolve(__dirname, "./wailsjs/go/main"),
    }
  },
  server: {
    // host: '0.0.0.0', // 监听所有 IPv4 地址
    host: true, // 也可以使用这个简写方式
    port: 5173, // 指定端口（可选）
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: true,
      },
    },
  }
})
