// Vitest global setup — set required environment variables before any module loads.
// This runs before all test files, ensuring getConfig() doesn't fail at module load time.
// Uses || to preserve values already set by individual test files or shell environment.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-characters'
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'testpassword123'
process.env.PROJECT_ROOT = process.env.PROJECT_ROOT || '/tmp'
process.env.NODE_ENV = 'test'
