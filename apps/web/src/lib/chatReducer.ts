import type { ChatMessage, ProviderEvent } from '@ai-cli/shared'

/**
 * chatReducer — pure reduction of the normalized ProviderEvent stream into a
 * renderable chat state. Kept free of React/transport concerns so it is fully
 * unit-testable and safe to double-invoke.
 *
 * One subtlety: the server's ClaudeCodeProvider emits `text-delta` for both
 * `assistant` and `user`-typed stream lines, and `ProviderEvent` carries no
 * role. To avoid rendering the user's own message twice (once optimistically on
 * send, once if echoed), we remember the last dispatched user text in
 * `pendingEcho` and drop a text-delta that exactly matches it while no
 * assistant turn is open yet. In practice headless claude user lines only carry
 * tool_result, so this is a defensive measure.
 */

export interface ToolCallView {
  callId: string
  toolName: string
  inputSummary: string
  status: 'running' | 'success' | 'error'
  outputSnippet: string
}

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  toolCalls: ToolCallView[]
  done: boolean
  error?: string
}

export interface ChatRenderState {
  turns: ChatTurn[]
  status: 'idle' | 'thinking' | 'working'
  crashed: { message: string; resumable: boolean } | null
  pendingEcho: string | null
}

export type ChatAction =
  | { type: 'user-message'; text: string }
  | { type: 'event'; event: ProviderEvent }
  | { type: 'crashed'; message: string; resumable: boolean }
  | { type: 'load-history'; messages: ChatMessage[] }
  | { type: 'reset' }

export const initialChatState: ChatRenderState = {
  turns: [],
  status: 'idle',
  crashed: null,
  pendingEcho: null,
}

let turnSeq = 0
function newId(): string {
  turnSeq += 1
  return `t${turnSeq}`
}

/** The last assistant turn that is still accepting deltas, if any. */
function openAssistantTurn(turns: ChatTurn[]): ChatTurn | null {
  const last = turns[turns.length - 1]
  if (last && last.role === 'assistant' && !last.done) return last
  return null
}

/** Find a tool call by id, searching assistant turns from newest to oldest. */
function findToolCall(turns: ChatTurn[], callId: string): { turn: ChatTurn; index: number } | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]
    if (t.role !== 'assistant') continue
    const idx = t.toolCalls.findIndex((c) => c.callId === callId)
    if (idx >= 0) return { turn: t, index: idx }
  }
  return null
}

/** Mutate the open assistant turn, creating one first if none exists. */
function withOpenAssistant(turns: ChatTurn[], mutate: (turn: ChatTurn) => ChatTurn): ChatTurn[] {
  const open = openAssistantTurn(turns)
  if (open) {
    return turns.map((t) => (t.id === open.id ? mutate(t) : t))
  }
  const created: ChatTurn = {
    id: newId(),
    role: 'assistant',
    text: '',
    ts: Date.now(),
    toolCalls: [],
    done: false,
  }
  return [...turns, mutate(created)]
}

export function chatReducer(state: ChatRenderState, action: ChatAction): ChatRenderState {
  switch (action.type) {
    case 'user-message': {
      const turn: ChatTurn = {
        id: newId(),
        role: 'user',
        text: action.text,
        ts: Date.now(),
        toolCalls: [],
        done: true,
      }
      return { ...state, turns: [...state.turns, turn], pendingEcho: action.text }
    }
    case 'event':
      return applyEvent(state, action.event)
    case 'crashed':
      return { ...state, crashed: { message: action.message, resumable: action.resumable } }
    case 'load-history': {
      const turns = action.messages.map<ChatTurn>((m) => ({
        id: newId(),
        role: m.role,
        text: m.text,
        ts: m.ts,
        toolCalls: [],
        done: true,
      }))
      return { ...state, turns, pendingEcho: null, crashed: null }
    }
    case 'reset':
      return initialChatState
    default:
      return state
  }
}

function applyEvent(state: ChatRenderState, event: ProviderEvent): ChatRenderState {
  switch (event.type) {
    case 'text-delta': {
      // Echo suppression: drop an exact match of the most recent user message
      // while no assistant turn is open yet.
      if (
        state.pendingEcho != null &&
        event.text === state.pendingEcho &&
        openAssistantTurn(state.turns) === null
      ) {
        return { ...state, pendingEcho: null }
      }
      const open = openAssistantTurn(state.turns)
      if (open) {
        const turns = state.turns.map((t) =>
          t.id === open.id ? { ...t, text: t.text + event.text } : t,
        )
        return { ...state, turns, pendingEcho: null }
      }
      const turn: ChatTurn = {
        id: newId(),
        role: 'assistant',
        text: event.text,
        ts: Date.now(),
        toolCalls: [],
        done: false,
      }
      return { ...state, turns: [...state.turns, turn], pendingEcho: null }
    }
    case 'tool-call-start': {
      const turns = withOpenAssistant(state.turns, (open) => {
        const existing = open.toolCalls.findIndex((c) => c.callId === event.callId)
        const tc: ToolCallView = {
          callId: event.callId,
          toolName: event.toolName,
          inputSummary: event.inputSummary,
          status: 'running',
          outputSnippet: '',
        }
        if (existing >= 0) {
          const next = [...open.toolCalls]
          next[existing] = { ...next[existing], ...tc }
          return { ...open, toolCalls: next }
        }
        return { ...open, toolCalls: [...open.toolCalls, tc] }
      })
      return { ...state, turns, pendingEcho: null }
    }
    case 'tool-result': {
      const found = findToolCall(state.turns, event.callId)
      if (!found) return { ...state, pendingEcho: null }
      const { turn, index } = found
      const turns = state.turns.map((t) => {
        if (t.id !== turn.id) return t
        const next = [...t.toolCalls]
        next[index] = {
          ...next[index],
          status: event.status,
          outputSnippet: event.outputSnippet,
        }
        return { ...t, toolCalls: next }
      })
      return { ...state, turns, pendingEcho: null }
    }
    case 'status':
      return { ...state, status: event.state }
    case 'error': {
      const turn: ChatTurn = {
        id: newId(),
        role: 'assistant',
        text: '',
        ts: Date.now(),
        toolCalls: [],
        done: true,
        error: event.message,
      }
      return { ...state, turns: [...state.turns, turn], pendingEcho: null }
    }
    case 'done': {
      const turns = state.turns.map((t, i) =>
        i === state.turns.length - 1 && t.role === 'assistant' ? { ...t, done: true } : t,
      )
      return { ...state, turns, status: 'idle', pendingEcho: null }
    }
    default:
      return state
  }
}
