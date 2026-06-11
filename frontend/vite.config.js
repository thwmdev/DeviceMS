import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'



export default defineConfig({
  plugins: [react()],
  build: {

    outDir: 'dist',


    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    // Đảm bảo vite có thể lắng nghe từ mọi nơi trong Docker
    host: '0.0.0.0',
    port: 5173,
  }
})