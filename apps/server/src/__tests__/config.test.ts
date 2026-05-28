/**
 * [M9补充] config 模块单元测试
 * 覆盖：正常校验、缺失必需变量、变量格式校验、默认值
 */
import { describe, it, expect } from 'vitest'
import { validateConfig } from '../lib/config.js'

describe('Config Validation (M14)', () => {
  const baseEnv = {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
  }

  it('should pass with valid required vars', () => {
    const config = validateConfig(baseEnv)
    expect(config.JWT_SECRET).toBe(baseEnv.JWT_SECRET)
    expect(config.JWT_REFRESH_SECRET).toBe(baseEnv.JWT_REFRESH_SECRET)
  })

  it('should fail when JWT_SECRET is missing', () => {
    expect(() =>
      validateConfig({ JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32' }),
    ).toThrow('Environment variable validation failed')
  })

  it('should fail when JWT_SECRET is too short', () => {
    expect(() =>
      validateConfig({ JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long' }),
    ).toThrow('at least 32')
  })

  it('should fail when JWT_REFRESH_SECRET is missing', () => {
    expect(() =>
      validateConfig({ JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long' }),
    ).toThrow('Environment variable validation failed')
  })

  it('should use default values for optional vars', () => {
    const config = validateConfig(baseEnv)
    expect(config.NODE_ENV).toBe('development')
    expect(config.PORT).toBe(3000)
    expect(config.PROJECT_ROOT).toBe('/workspace')
    expect(config.ADMIN_USERNAME).toBe('admin')
    expect(config.LOG_LEVEL).toBe('info')
    expect(config.SHELL_CMD).toBe('bash')
  })

  it('should parse PORT as number', () => {
    const config = validateConfig({ ...baseEnv, PORT: '8080' })
    expect(config.PORT).toBe(8080)
    expect(typeof config.PORT).toBe('number')
  })

  it('should reject PORT out of range', () => {
    expect(() =>
      validateConfig({ ...baseEnv, PORT: '99999' }),
    ).toThrow()
  })

  it('should reject invalid NODE_ENV', () => {
    expect(() =>
      validateConfig({ ...baseEnv, NODE_ENV: 'staging' }),
    ).toThrow()
  })

  it('should accept valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test'] as const) {
      const config = validateConfig({ ...baseEnv, NODE_ENV: env })
      expect(config.NODE_ENV).toBe(env)
    }
  })

  it('should accept valid LOG_LEVEL values', () => {
    for (const level of ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const) {
      const config = validateConfig({ ...baseEnv, LOG_LEVEL: level })
      expect(config.LOG_LEVEL).toBe(level)
    }
  })

  it('should accept optional CORS_ORIGINS', () => {
    const config = validateConfig({ ...baseEnv, CORS_ORIGINS: 'http://a.com,http://b.com' })
    expect(config.CORS_ORIGINS).toBe('http://a.com,http://b.com')
  })
})
