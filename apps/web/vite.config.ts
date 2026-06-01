/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read .env from monorepo root (bypasses shell env vars)
const rootEnvPath = resolve(__dirname, '../../.env')
const rootEnv = Object.fromEntries(
  readFileSync(rootEnvPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

export default defineConfig({
  envDir: '../../',
  define: {
    'import.meta.env.VITE_WS_URL': JSON.stringify(rootEnv.VITE_WS_URL || ''),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AI-CLI',
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
          xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          codemirror: [
            '@uiw/react-codemirror',
            '@codemirror/lang-javascript',
            '@codemirror/lang-python',
            '@codemirror/lang-json',
            '@codemirror/lang-markdown',
            '@codemirror/lang-css',
            '@codemirror/lang-html',
          ],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': `http://localhost:${rootEnv.PORT || 18333}`,
      '/ws': {
        target: `ws://localhost:${rootEnv.PORT || 18333}`,
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
