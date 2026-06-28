import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

describe('ClaudeCodeProvider — basics', () => {
  const p = new ClaudeCodeProvider()

  it('id is claude-code', () => {
    expect(p.id).toBe('claude-code')
  })

  it('supports Explore and Edit tiers', () => {
    expect(p.availableTiers().sort()).toEqual(['Edit', 'Explore'])
  })

  it('supports resume', () => {
    expect(p.supportsResume()).toBe(true)
  })

  describe('spawnArgs', () => {
    const base = { claudeSessionId: '11111111-2222-3333-4444-555555555555', cwd: '/tmp' }

    it('Explore tier uses --permission-mode plan and pins session-id', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: false })
      expect(args).toContain('--permission-mode')
      expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
      expect(args).toContain('--session-id')
      expect(args[args.indexOf('--session-id') + 1]).toBe(base.claudeSessionId)
      expect(args).toContain('-p')
      expect(args).toContain('--output-format')
      expect(args).toContain('stream-json')
    })

    it('Edit tier uses --permission-mode acceptEdits', () => {
      const args = p.spawnArgs({ ...base, tier: 'Edit', resume: false })
      expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
    })

    it('resume=true adds --resume with the session id', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: true })
      expect(args).toContain('--resume')
      expect(args[args.indexOf('--resume') + 1]).toBe(base.claudeSessionId)
    })

    it('never emits default permission mode', () => {
      for (const tier of p.availableTiers()) {
        const args = p.spawnArgs({ ...base, tier, resume: false })
        const i = args.indexOf('--permission-mode')
        expect(args[i + 1]).not.toBe('default')
      }
    })

    it('passes --model when provided', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: false, model: 'sonnet' })
      expect(args[args.indexOf('--model') + 1]).toBe('sonnet')
    })
  })
})

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('ClaudeCodeProvider — parseStreamLine', () => {
  const p = new ClaudeCodeProvider()

  it('parses assistant text content block to text-delta', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello world' }))
  })

  it('parses tool_use block to tool-call-start', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/a/b.ts' } },
        ],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-call-start', callId: 'call_1', toolName: 'Read' }),
    )
  })

  it('parses tool_result block to tool-result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'ok', is_error: false }],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-result', callId: 'call_1', status: 'success' }),
    )
  })

  it('marks errored tool_result as error status', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_2', content: 'boom', is_error: true }],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-result', callId: 'call_2', status: 'error' }),
    )
  })

  it('parses result(type=result) to done', () => {
    const line = JSON.stringify({ type: 'result', subtype: 'success', result: 'done' })
    const ev = p.parseStreamLine(line)
    expect(ev.some((e) => e.type === 'done')).toBe(true)
  })

  it('emits status working for system thinking_tokens', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'thinking_tokens', tokens: 10 })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'status', state: 'working' }))
  })

  it('returns [] for non-JSON / unknown lines', () => {
    expect(p.parseStreamLine('not json')).toEqual([])
    expect(
      p.parseStreamLine(JSON.stringify({ type: 'system', subtype: 'init', tools: [] })),
    ).toEqual([])
  })

  it('parses the captured fixture file without throwing', () => {
    const path = join(FIXTURE_DIR, 'claude-stream-sample.jsonl')
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
    let total = 0
    for (const l of lines) {
      total += p.parseStreamLine(l).length
    }
    expect(total).toBeGreaterThan(0) // fixture 至少产出若干事件
  })
})
