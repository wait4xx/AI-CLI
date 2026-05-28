/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AI-CLI-Mobile',
        short_name: 'AI-CLI',
        description: 'Mobile AI Programming CLI Gateway',
        theme_color: '#1a1a2e',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl', '@xterm/addon-canvas', '@xterm/addon-web-links'],
          'codemirror': ['@uiw/react-codemirror', '@codemirror/lang-javascript', '@codemirror/lang-python', '@codemirror/lang-json', '@codemirror/lang-markdown', '@codemirror/lang-css', '@codemirror/lang-html'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    // 安全修复[C8]: 添加 CSP 安全响应头
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // Tailwind CSS 需要 unsafe-inline
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "font-src 'self' data:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
})
