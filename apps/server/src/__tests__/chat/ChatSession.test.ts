import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChild = {
  stdin: { write: vi.fn(), end: vi.fn(), writable: true, on: vi.fn() },
  stdout: { on: vi.fn(), setEncoding: vi.fn() },
  stderr: { on: vi.fn(), setEncoding: vi.fn() },
  on: vi.fn(),
  kill: vi.fn(),
  pid: 12345,
}
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockChild),
}))
vi.mock('../../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

import { spawn } from 'node:child_process'
import { ChatSession } from '../../chat/ChatSession.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

const SPAWN_OPTS = {
  claudeSessionId: '11111111-2222-3333-4444-555555555555',
  cwd: '/tmp/proj',
  tier: 'Explore' as const,
  resume: false,
}

describe('ChatSession — lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns claude with provider args and cwd', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', '--permission-mode', 'plan']),
      expect.objectContaining({ cwd: '/tmp/proj' }),
    )
  })

  it('kill() terminates the child process', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    session.kill()
    expect(mockChild.kill).toHaveBeenCalled()
  })

  it('emits crash callback on unexpected exit (non-zero)', () => {
    const onCrash = vi.fn()
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {}, onCrash)
    session.start()
    const exitHandler = mockChild.on.mock.calls.find((c) => c[0] === 'exit')![1]
    exitHandler(1, null)
    expect(onCrash).toHaveBeenCalledWith(expect.any(Number), expect.any(String))
  })
})

describe('ChatSession — streaming & backpressure', () => {
  beforeEach(() => vi.clearAllMocks())

  it('send() writes provider-formatted envelope to stdin', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    session.send('hello')
    const written = mockChild.stdin.write.mock.calls[0][0] as string
    expect(written.endsWith('\n')).toBe(true)
    expect(JSON.parse(written).message.content[0].text).toBe('hello')
  })

  it('parses stdout lines into events via provider', () => {
    const onEvent = vi.fn()
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, onEvent)
    session.start()
    const dataHandler = mockChild.stdout.on.mock.calls.find((c) => c[0] === 'data')![1]
    dataHandler(JSON.stringify({ type: 'result', subtype: 'success' }) + '\n')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }))
  })

  it('send() returns false when not started', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    expect(session.send('x')).toBe(false)
  })

  it('send() rejects oversized payload (>256KB)', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    expect(session.send('x'.repeat(257 * 1024))).toBe(false)
    expect(mockChild.stdin.write).not.toHaveBeenCalled()
  })
})
