import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * 自动启动后端服务，测试完整 WebSocket 交互流程
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // 串行执行，避免端口冲突
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 自动启动后端服务（用于 API 和 WebSocket 测试）
  webServer: {
    command: 'cd apps/server && node dist/index.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      JWT_SECRET: 'test-jwt-secret-for-e2e-testing-32ch',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-e2e-testing-32',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin123456',
      PROJECT_ROOT: '/tmp/e2e-project-root',
    },
  },
})
