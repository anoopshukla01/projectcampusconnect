import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expand the project root to the parent so files in placementDashboard/ are
  // treated as part of the same workspace (resolves react, react-router-dom, etc.)
  root: path.resolve(__dirname),
  server: {
    historyApiFallback: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: ['..'], // serve files from parent directory
    },
  },
  resolve: {
    // Ensure only one copy of React & react-router-dom is used even when
    // importing from outside the src/ tree
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@placement': path.resolve(__dirname, '../placementDashboard'),
      '@ctx': path.resolve(__dirname, 'src/context'),
      '@admin': path.resolve(__dirname, '../adminDashboard'),
      '@professor': path.resolve(__dirname, '../professorDashboard'),
    },
  },
  optimizeDeps: {
    // Pre-bundle these so Rollup can find them from outside the src/ root
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
