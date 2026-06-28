import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from '../../lib/chatReducer'
import type { ProviderEvent, ChatMessage } from '@ai-cli/shared'

function userMessage(text: string) {
  return chatReducer(initialChatState, { type: 'user-message', text })
}
function ev(state: ReturnType<typeof userMessage>, event: ProviderEvent) {
  return chatReducer(state, { type: 'event', event })
}

describe('chatReducer', () => {
  describe('user-message', () => {
    it('appends a finalized user turn and records pendingEcho', () => {
      const s = userMessage('hello')
      expect(s.turns).toHaveLength(1)
      const t = s.turns[0]
      expect(t.role).toBe('user')
      expect(t.text).toBe('hello')
      expect(t.done).toBe(true)
      expect(t.toolCalls).toEqual([])
      expect(s.pendingEcho).toBe('hello')
    })
  })

  describe('text-delta', () => {
    it('creates an open assistant turn when none is open', () => {
      const s = ev(initialChatState, { type: 'text-delta', text: 'Hi' })
      expect(s.turns).toHaveLength(1)
      expect(s.turns[0]).toMatchObject({ role: 'assistant', text: 'Hi', done: false })
    })

    it('appends to the open assistant turn', () => {
      let s = ev(initialChatState, { type: 'text-delta', text: 'Hi' })
      s = ev(s, { type: 'text-delta', text: ' there' })
      expect(s.turns).toHaveLength(1)
      expect(s.turns[0].text).toBe('Hi there')
      expect(s.turns[0].done).toBe(false)
    })

    it('starts a new assistant turn after done', () => {
      let s = ev(initialChatState, { type: 'text-delta', text: 'first' })
      s = ev(s, { type: 'done' })
      s = ev(s, { type: 'text-delta', text: 'second' })
      expect(s.turns).toHaveLength(2)
      expect(s.turns[0].done).toBe(true)
      expect(s.turns[1].text).toBe('second')
    })

    it('suppresses an exact echo of the last user message before any assistant turn', () => {
      const s = userMessage('what is 2+2')
      const after = ev(s, { type: 'text-delta', text: 'what is 2+2' })
      expect(after.turns).toHaveLength(1)
      expect(after.turns[0].role).toBe('user')
      expect(after.pendingEcho).toBeNull()
    })

    it('does not suppress a non-matching delta and clears pendingEcho', () => {
      const s = userMessage('what is 2+2')
      const after = ev(s, { type: 'text-delta', text: 'The answer is 4' })
      expect(after.turns).toHaveLength(2)
      expect(after.turns[1]).toMatchObject({ role: 'assistant', text: 'The answer is 4' })
      expect(after.pendingEcho).toBeNull()
    })

    it('does not suppress once an assistant turn is already open', () => {
      let s = userMessage('hi')
      s = ev(s, { type: 'text-delta', text: 'Hello!' })
      s = ev(s, { type: 'text-delta', text: 'hi' })
      expect(s.turns).toHaveLength(2)
      expect(s.turns[1].text).toBe('Hello!hi')
    })
  })

  describe('tool-call-start', () => {
    it('creates an open assistant turn if needed and adds the tool call', () => {
      const s = ev(initialChatState, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'src/foo.ts',
      })
      expect(s.turns).toHaveLength(1)
      expect(s.turns[0].role).toBe('assistant')
      expect(s.turns[0].toolCalls).toHaveLength(1)
      expect(s.turns[0].toolCalls[0]).toMatchObject({
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'src/foo.ts',
        status: 'running',
        outputSnippet: '',
      })
    })

    it('upserts by callId (no duplicate)', () => {
      let s = ev(initialChatState, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'a',
      })
      s = ev(s, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'b',
      })
      expect(s.turns[0].toolCalls).toHaveLength(1)
      expect(s.turns[0].toolCalls[0].inputSummary).toBe('b')
    })
  })

  describe('tool-result', () => {
    it('updates the matching tool call status and snippet', () => {
      let s = ev(initialChatState, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'f',
      })
      s = ev(s, {
        type: 'tool-result',
        callId: 'c1',
        status: 'success',
        outputSnippet: 'file contents',
      })
      expect(s.turns[0].toolCalls[0]).toMatchObject({
        status: 'success',
        outputSnippet: 'file contents',
      })
    })

    it('maps is_error-derived error status', () => {
      let s = ev(initialChatState, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Write',
        inputSummary: 'f',
      })
      s = ev(s, {
        type: 'tool-result',
        callId: 'c1',
        status: 'error',
        outputSnippet: 'denied',
      })
      expect(s.turns[0].toolCalls[0].status).toBe('error')
    })

    it('finds the tool call across multiple turns', () => {
      let s = ev(initialChatState, {
        type: 'tool-call-start',
        callId: 'c1',
        toolName: 'Read',
        inputSummary: 'first',
      })
      s = ev(s, { type: 'done' })
      s = ev(s, { type: 'text-delta', text: 'next' })
      s = ev(s, {
        type: 'tool-result',
        callId: 'c1',
        status: 'success',
        outputSnippet: 'ok',
      })
      expect(s.turns[0].toolCalls[0].status).toBe('success')
    })
  })

  describe('status', () => {
    it('maps status events to the state field', () => {
      let s = ev(initialChatState, { type: 'status', state: 'thinking' })
      expect(s.status).toBe('thinking')
      s = ev(s, { type: 'status', state: 'working' })
      expect(s.status).toBe('working')
    })
  })

  describe('error', () => {
    it('appends a finalized error assistant turn', () => {
      const s = ev(initialChatState, { type: 'error', message: 'boom' })
      expect(s.turns).toHaveLength(1)
      expect(s.turns[0]).toMatchObject({ role: 'assistant', error: 'boom', done: true })
    })
  })

  describe('done', () => {
    it('finalizes the last assistant turn and resets status to idle', () => {
      let s = ev(initialChatState, { type: 'status', state: 'working' })
      s = ev(s, { type: 'text-delta', text: 'x' })
      s = ev(s, { type: 'done' })
      expect(s.turns[0].done).toBe(true)
      expect(s.status).toBe('idle')
    })
  })

  describe('crashed', () => {
    it('sets the crashed field without touching turns', () => {
      const s = userMessage('hi')
      const after = chatReducer(s, { type: 'crashed', message: 'process died', resumable: true })
      expect(after.crashed).toEqual({ message: 'process died', resumable: true })
      expect(after.turns).toBe(s.turns)
    })
  })

  describe('load-history', () => {
    it('replaces turns with history entries and clears pendingEcho', () => {
      const base = userMessage('pending')
      const history: ChatMessage[] = [
        { role: 'user', text: 'old q', ts: 1 },
        { role: 'assistant', text: 'old a', ts: 2 },
      ]
      const s = chatReducer(base, { type: 'load-history', messages: history })
      expect(s.turns).toHaveLength(2)
      expect(s.turns.map((t) => [t.role, t.text])).toEqual([
        ['user', 'old q'],
        ['assistant', 'old a'],
      ])
      s.turns.forEach((t) => expect(t.done).toBe(true))
      expect(s.pendingEcho).toBeNull()
    })

    it('history then a matching text-delta is NOT suppressed (echo cleared)', () => {
      const s = chatReducer(initialChatState, {
        type: 'load-history',
        messages: [{ role: 'user', text: 'hi', ts: 1 }],
      })
      const after = ev(s, { type: 'text-delta', text: 'hi' })
      expect(after.turns).toHaveLength(2)
      expect(after.turns[1].role).toBe('assistant')
    })
  })

  describe('reset', () => {
    it('returns to initial state and clears pendingEcho', () => {
      let s = userMessage('hi')
      s = ev(s, { type: 'text-delta', text: 'hey' })
      const reset = chatReducer(s, { type: 'reset' })
      expect(reset).toEqual(initialChatState)
      const after = ev(reset, { type: 'text-delta', text: 'hi' })
      expect(after.turns).toHaveLength(1)
    })
  })
})
