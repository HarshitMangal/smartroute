import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — React plugin aur proxy setup
// Proxy: /api calls backend port 5000 pe forward karta hai
// Isse frontend mein 'http://localhost:5000' likhne ki zarurat nahi padti

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
