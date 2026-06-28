import { describe, it, expect } from 'vitest'
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
