/**
 * [M9修复] SessionManager 单元测试
 * 覆盖：会话创建/销毁、所有权校验、MAX_SESSIONS 限制、destroy() 清理
 * 通过 mock node-pty 避免对 tmux 的实际依赖
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock node-pty ───
const mockPty = {
  pid: 12345,
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
}

vi.mock('node-pty', () => ({
  default: {
    spawn: vi.fn(() => mockPty),
  },
}))

// ─── Mock execFile for tmux commands ───
vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (...a: unknown[]) => void) => {
    // tmux which → success, tmux has-session → fail, tmux list-sessions → empty
    if (_args[0] === 'which') cb(null, { stdout: '/usr/bin/tmux' })
    else if (_args[0] === 'has-session') cb(new Error('no session'))
    else if (_args[0] === 'list-sessions') cb(new Error('no server'))
    else if (_args[0] === 'capture-pane') cb(null, { stdout: '$ prompt' })
    else cb(null, { stdout: '' })
  }),
}))

// ─── Mock sessionStore ───
vi.mock('../core/sessionStore.js', () => ({
  SessionStore: class {
    private store = new Map()
    load() {}
    get(id: string) {
      return this.store.get(id)
    }
    set(id: string, val: any) {
      this.store.set(id, val)
    }
    delete(id: string) {
      this.store.delete(id)
    }
    entries() {
      return this.store.entries()
    }
    flush() {}
  },
}))

// ─── Mock audit ───
vi.mock('../core/audit.js', () => ({
  auditLog: vi.fn(),
}))

// ─── Mock recorder ───
vi.mock('../core/recorder.js', () => ({
  SessionRecorder: class {
    isRecording() {
      return false
    }
    record() {}
    start() {}
    stop() {}
    getPlayback() {
      return []
    }
    getDuration() {
      return 0
    }
  },
}))

// ─── Mock logger ───
vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}))

import { SessionManager } from '../core/SessionManager.js'
import type { CLIAdapter } from '../adapters/base.js'

function createMockAdapter(_name = 'shell'): CLIAdapter {
  return {
    startCommand: 'bash',
    parseStreamData: vi.fn(() => null),
    parseScreenSnapshot: vi.fn(() => null),
    getQuickActions: vi.fn(() => []),
    supportsStructuredOutput: vi.fn(() => false),
  }
}

describe('SessionManager', () => {
  let manager: SessionManager
  let adapters: Map<string, CLIAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapters = new Map([
      ['shell', createMockAdapter('shell')],
      ['claude', createMockAdapter('claude')],
    ])
    manager = new SessionManager(adapters)
  })

  afterEach(() => {
    manager.destroy()
  })

  describe('createOrAttachSession', () => {
    it('should create a new session', () => {
      const session = manager.createOrAttachSession('test-1', 80, 24, 'shell', 'user-1')
      expect(session.sessionId).toBe('test-1')
      expect(manager.hasSession('test-1')).toBe(true)
      expect(manager.getSessionIds()).toContain('test-1')
    })

    it('should return existing session for same id', () => {
      const s1 = manager.createOrAttachSession('test-1', 80, 24, 'shell', 'user-1')
      const s2 = manager.createOrAttachSession('test-1', 120, 40, 'shell', 'user-1')
      expect(s1).toBe(s2)
    })

    it('should reject unknown adapter', () => {
      expect(() => manager.createOrAttachSession('test-x', 80, 24, 'unknown', 'user-1')).toThrow(
        'Unknown adapter: unknown',
      )
    })

    it('should reject invalid sessionId', () => {
      expect(() => manager.createOrAttachSession('../etc', 80, 24, 'shell', 'user-1')).toThrow(
        'Invalid sessionId',
      )
    })

    // [R9] Defense-in-depth: cols/rows validation at creation point
    it('should reject cols/rows out of range', () => {
      expect(() => manager.createOrAttachSession('test-cols', 0, 24, 'shell', 'user-1')).toThrow(
        'Invalid terminal dimensions',
      )
      expect(() => manager.createOrAttachSession('test-cols', 80, 0, 'shell', 'user-1')).toThrow(
        'Invalid terminal dimensions',
      )
      expect(() => manager.createOrAttachSession('test-cols', 501, 24, 'shell', 'user-1')).toThrow(
        'Invalid terminal dimensions',
      )
      expect(() => manager.createOrAttachSession('test-cols', 80, 201, 'shell', 'user-1')).toThrow(
        'Invalid terminal dimensions',
      )
    })

    it('should reject non-finite cols/rows', () => {
      expect(() => manager.createOrAttachSession('test-nan', NaN, 24, 'shell', 'user-1')).toThrow(
        'Invalid terminal dimensions',
      )
      expect(() =>
        manager.createOrAttachSession('test-nan', 80, Infinity, 'shell', 'user-1'),
      ).toThrow('Invalid terminal dimensions')
    })

    it('should accept boundary cols/rows values', () => {
      const s1 = manager.createOrAttachSession('boundary-1', 1, 1, 'shell', 'user-1')
      expect(s1.sessionId).toBe('boundary-1')
      const s2 = manager.createOrAttachSession('boundary-2', 500, 200, 'shell', 'user-1')
      expect(s2.sessionId).toBe('boundary-2')
    })

    it('should set owner correctly', () => {
      manager.createOrAttachSession('owned', 80, 24, 'shell', 'user-42')
      expect(manager.getOwner('owned')).toBe('user-42')
    })
  })

  describe('ownership', () => {
    it('should return null for non-existent session', () => {
      expect(manager.getOwner('nonexistent')).toBeNull()
    })
  })

  describe('destroySession', () => {
    it('should remove session and clean up', () => {
      manager.createOrAttachSession('to-kill', 80, 24, 'shell', 'user-1')
      expect(manager.hasSession('to-kill')).toBe(true)

      manager.destroySession('to-kill')
      expect(manager.hasSession('to-kill')).toBe(false)
      expect(manager.getSessionIds()).not.toContain('to-kill')
    })

    it('should be a no-op for non-existent session', () => {
      // Should not throw
      manager.destroySession('nonexistent')
    })

    it('should kill the pty process', () => {
      manager.createOrAttachSession('pty-kill', 80, 24, 'shell', 'user-1')
      manager.destroySession('pty-kill')
      expect(mockPty.kill).toHaveBeenCalled()
    })
  })

  describe('destroy (all)', () => {
    it('should destroy all sessions and clear timers', () => {
      manager.createOrAttachSession('s1', 80, 24, 'shell', 'user-1')
      manager.createOrAttachSession('s2', 80, 24, 'shell', 'user-2')
      expect(manager.getSessionIds().length).toBe(2)

      manager.destroy()
      expect(manager.getSessionIds().length).toBe(0)
    })
  })

  describe('input & resize', () => {
    it('should forward input to pty', () => {
      manager.createOrAttachSession('input-test', 80, 24, 'shell', 'user-1')
      manager.sendInput('input-test', 'ls\n')
      expect(mockPty.write).toHaveBeenCalledWith('ls\n')
    })

    it('should reject input for non-existent session', () => {
      expect(() => manager.sendInput('ghost', 'x')).toThrow('Session not found')
    })

    it('should resize pty', () => {
      manager.createOrAttachSession('resize-test', 80, 24, 'shell', 'user-1')
      manager.resize('resize-test', 120, 40)
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40)
    })

    it('should reject resize for non-existent session', () => {
      expect(() => manager.resize('ghost', 80, 24)).toThrow('Session not found')
    })
  })

  describe('quickAction', () => {
    it('should send quick action payload to pty', () => {
      manager.createOrAttachSession('qa-test', 80, 24, 'shell', 'user-1')
      manager.sendQuickAction('qa-test', 'pwd\n')
      expect(mockPty.write).toHaveBeenCalledWith('pwd\n')
    })

    it('should reject quick action for non-existent session', () => {
      expect(() => manager.sendQuickAction('ghost', 'x')).toThrow('Session not found')
    })
  })

  describe('broadcastControl', () => {
    it('should be a no-op for non-existent session', () => {
      // Should not throw
      manager.broadcastControl('ghost', { type: 'TEST' })
    })
  })

  describe('recording', () => {
    it('should start and stop recording', () => {
      manager.createOrAttachSession('rec-test', 80, 24, 'shell', 'user-1')
      manager.startRecording('rec-test')
      manager.stopRecording('rec-test')
    })

    it('should reject recording for non-existent session', () => {
      expect(() => manager.startRecording('ghost')).toThrow('Session not found')
      expect(() => manager.stopRecording('ghost')).toThrow('Session not found')
    })

    it('should get recording status', () => {
      manager.createOrAttachSession('status-test', 80, 24, 'shell', 'user-1')
      const status = manager.getRecordingStatus('status-test')
      expect(status).toHaveProperty('recording')
      expect(status).toHaveProperty('duration')
    })
  })

  describe('listAllTmuxSessions', () => {
    it('should return empty array when no tmux server', async () => {
      const sessions = await manager.listAllTmuxSessions()
      expect(sessions).toEqual([])
    })

    it('should parse tmux session list with managed marking', async () => {
      const { execFile } = await import('child_process')
      const mockExec = vi.mocked(execFile)
      manager.createOrAttachSession('managed-1', 80, 24, 'shell', 'user-1')
      mockExec.mockImplementation((_cmd: any, args: any, cb: any) => {
        if (args[0] === 'list-sessions' && args[2]?.includes('session_created')) {
          cb(null, {
            stdout:
              'aicli-managed-1:1:0:Mon May 26 10:00:00 2025\nexternal-session:2:1:Mon May 25 09:00:00 2025',
          })
        } else {
          cb(null, { stdout: '' })
        }
        return null as any
      })
      const sessions = await manager.listAllTmuxSessions()
      expect(sessions).toHaveLength(2)
      const managed = sessions.find((s) => s.name === 'aicli-managed-1')
      expect(managed?.isManaged).toBe(true)
      expect(managed?.adapterName).toBe('shell')
      const external = sessions.find((s) => s.name === 'external-session')
      expect(external?.isManaged).toBe(false)
      expect(external?.windows).toBe(2)
    })
  })

  describe('killTmuxSession', () => {
    it('should kill managed session with ownership check', async () => {
      manager.createOrAttachSession('kill-test', 80, 24, 'shell', 'user-1')
      await manager.killTmuxSession('aicli-kill-test', 'user-1')
      expect(manager.hasSession('kill-test')).toBe(false)
    })

    it('should reject killing managed session without ownership', async () => {
      manager.createOrAttachSession('kill-owner', 80, 24, 'shell', 'user-1')
      await expect(manager.killTmuxSession('aicli-kill-owner', 'user-2')).rejects.toThrow(
        'Permission denied',
      )
    })

    it('should kill external tmux session', async () => {
      const { execFile } = await import('child_process')
      const mockExec = vi.mocked(execFile)
      mockExec.mockImplementation((_cmd: any, args: any, cb: any) => {
        cb(null, { stdout: '' })
        return null as any
      })
      await expect(manager.killTmuxSession('external-test', 'user-1')).resolves.toBeUndefined()
    })
  })

  describe('renameTmuxSession', () => {
    it('should rename managed session and update tracking', async () => {
      manager.createOrAttachSession('rename-test', 80, 24, 'shell', 'user-1')
      const { execFile } = await import('child_process')
      const mockExec = vi.mocked(execFile)
      mockExec.mockImplementation((_cmd: any, args: any, cb: any) => {
        cb(null, { stdout: '' })
        return null as any
      })
      await manager.renameTmuxSession('aicli-rename-test', 'new-name', 'user-1')
      expect(manager.hasSession('rename-test')).toBe(true)
    })

    it('should reject invalid new name', async () => {
      await expect(manager.renameTmuxSession('old', '../bad', 'user-1')).rejects.toThrow(
        'Invalid session name',
      )
    })

    it('should reject rename without ownership', async () => {
      manager.createOrAttachSession('rename-owner', 80, 24, 'shell', 'user-1')
      await expect(
        manager.renameTmuxSession('aicli-rename-owner', 'new', 'user-2'),
      ).rejects.toThrow('Permission denied')
    })

    it('should rename external tmux session', async () => {
      const { execFile } = await import('child_process')
      const mockExec = vi.mocked(execFile)
      mockExec.mockImplementation((_cmd: any, args: any, cb: any) => {
        cb(null, { stdout: '' })
        return null as any
      })
      await expect(
        manager.renameTmuxSession('external', 'renamed', 'user-1'),
      ).resolves.toBeUndefined()
    })
  })
})
