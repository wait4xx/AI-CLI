import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config before importing ShellAdapter
// Use a mutable variable so tests can change the shell command
const mockConfig = {
  SHELL_CMD: 'bash',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
  PROJECT_ROOT: '/tmp',
  PORT: 3000,
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  LOG_LEVEL: 'info',
}

vi.mock('../lib/config.js', () => ({
  getConfig: () => mockConfig,
}))

// Mock logger before importing ShellAdapter
vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}))

import { ShellAdapter } from '../adapters/shell.js'

describe('ShellAdapter', () => {
  beforeEach(() => {
    mockConfig.SHELL_CMD = 'bash'
  })

  it('should accept bash', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('bash')
  })

  it('should accept sh', () => {
    mockConfig.SHELL_CMD = 'sh'
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('sh')
  })

  it('should accept zsh', () => {
    mockConfig.SHELL_CMD = 'zsh'
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('zsh')
  })

  it('should accept fish', () => {
    mockConfig.SHELL_CMD = 'fish'
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('fish')
  })

  it('should reject disallowed shells', () => {
    mockConfig.SHELL_CMD = 'powershell'
    expect(() => new ShellAdapter()).toThrow('Shell not allowed')
  })

  it('should handle path traversal in shell name by extracting basename', () => {
    mockConfig.SHELL_CMD = '/usr/bin/../../../bin/bash'
    // basename of resolved path is 'bash', which is allowed
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('/usr/bin/../../../bin/bash')
  })

  it('should default to bash', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    expect(adapter.startCommand).toBe('bash')
  })

  it('should return null from parseStreamData', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    expect(adapter.parseStreamData('anything')).toBeNull()
  })

  it('should return null from parseScreenSnapshot', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    expect(adapter.parseScreenSnapshot('anything')).toBeNull()
  })

  it('should return quick actions', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    const actions = adapter.getQuickActions()
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0].label).toBe('Cancel')
  })

  it('should not support structured output', () => {
    mockConfig.SHELL_CMD = 'bash'
    const adapter = new ShellAdapter()
    expect(adapter.supportsStructuredOutput()).toBe(false)
  })
})
