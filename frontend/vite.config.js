import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:5000', ws: true },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          charts:   ['recharts'],
          ui:       ['lucide-react'],
          state:    ['zustand', 'axios'],
        },
      },
    },
    // Warn on large chunks
    chunkSizeWarningLimit: 600,
  },

  // Environment variable prefix exposed to frontend
  envPrefix: 'VITE_',
}));
