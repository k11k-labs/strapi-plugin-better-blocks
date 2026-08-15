import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.STRAPI_URL || 'http://localhost:1337',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.STRAPI_URL || 'http://localhost:1337',
        changeOrigin: true,
      },
    },
  },
});
