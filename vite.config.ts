import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to avoid CORS issues in development
      '/api': {
        target: 'http://localhost:8765',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Proxy auth routes so cookies are set on the same origin
      '/auth': {
        target: 'http://localhost:8765',
        changeOrigin: true,
      },
    },
  },
});
