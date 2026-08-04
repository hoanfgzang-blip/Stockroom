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
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['phamduy.taila34f60.ts.net', 'wms.ice-tcv.id.vn', '100.125.44.63'],
    proxy: {
      '/api': {
        target: 'http://localhost:5295',
        changeOrigin: true,
      },
    },
  },
})
