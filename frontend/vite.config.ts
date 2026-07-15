import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    assetsDir: 'Assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5295',
        changeOrigin: true,
      },
    },
  },
})
