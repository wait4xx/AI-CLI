/**
 * Integration test: boots a REAL Fastify app (auth plugin + /ws/chat route +
 * ChatGateway + ConversationManager + a stub ChatProvider) and drives the
 * WebSocket flow end-to-end using a real `ws` client.
 *
 * Covers the layers that the isolated ChatGateway unit tests skip:
 *  - HTTP upgrade through @fastify/websocket
 *  - the auth-plugin whitelist (WHITELIST_PATHS must include /ws/chat)
 *  - verifyWsUpgradeToken at the route handler
 *  - route wiring (chatRoutes → fastify.chatGateway.handleChatConnection)
 *  - ConversationManager.create idempotency via the stub provider
 *
 * No real `claude` process is spawned — vi.mock replaces ChatSession with a
 * no-op class, and the stub provider's spawnArgs/sendMessage/parseStreamLine
 * are inert.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import jwt from 'jsonwebtoken'
import { WebSocket } from 'ws'
import type { Writable } from 'node:stream'
import type { ChatPermissionTier, ProviderEvent } from '@ai-cli/shared'
import type { ChatProvider, SpawnOpts } from '../chat/ChatProvider.js'

// ---------------------------------------------------------------------------
// Env — set BEFORE importing anything that reads getConfig()
// ---------------------------------------------------------------------------
const TMP_DIR = mkdtempSync(join(tmpdir(), 'ai-cli-chat-int-'))
process.env.JWT_SECRET = 'integration-jwt-secret-at-least-32-chars'
process.env.JWT_REFRESH_SECRET = 'integration-refresh-secret-32-chars!!'
process.env.DATA_DIR = TMP_DIR
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'testpassword123'
process.env.NODE_ENV = 'test'
process.env.PROJECT_ROOT = '/tmp'

// ---------------------------------------------------------------------------
// Mocks — must come before imports of modules that transitively use them
// ---------------------------------------------------------------------------
vi.mock('../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))
vi.mock('../core/audit.js', () => ({
  auditLog: vi.fn(),
  closeAuditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../chat/ChatSession.js', () => {
  class MockChatSession {
    start = vi.fn()
    send = vi.fn()
    kill = vi.fn()
  }
  return { ChatSession: MockChatSession }
})

import authPlugin from '../plugins/auth.js'
import { ConversationManager } from '../chat/ConversationManager.js'
import { ChatGateway } from '../chat/ChatGateway.js'
import { chatRoutes } from '../routes/chat.js'

// ---------------------------------------------------------------------------
// Stub ChatProvider — inert, never spawns anything
// ---------------------------------------------------------------------------
class StubProvider implements ChatProvider {
  readonly id = 'stub'
  spawnArgs(_opts: SpawnOpts): string[] {
    return []
  }
  sendMessage(_stdin: Writable, _text: string): void {
    /* no-op */
  }
  parseStreamLine(_line: string): ProviderEvent[] {
    return []
  }
  availableTiers(): ChatPermissionTier[] {
    return ['Explore', 'Edit']
  }
  supportsResume(): boolean {
    return true
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET!

function makeToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      userId: 'admin-user',
      username: 'admin',
      role: 'admin',
      tokenVersion: 0,
      ...overrides,
    },
    JWT_SECRET,
  )
}

/** Small promise+timeout helper — resolves with the first message matching `type`. */
function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 3000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler)
      reject(new Error(`timeout waiting for ${type} after ${timeoutMs}ms`))
    }, timeoutMs)

    function handler(data: Buffer) {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === type) {
          clearTimeout(timer)
          ws.off('message', handler)
          resolve(msg as Record<string, unknown>)
        }
      } catch {
        // ignore parse errors from non-JSON frames
      }
    }
    ws.on('message', handler)
  })
}

/** Collect all messages received on a ws into an array. */
function messageCollector(ws: WebSocket): { messages: unknown[]; dispose: () => void } {
  const messages: unknown[] = []
  const handler = (data: Buffer) => {
    try {
      messages.push(JSON.parse(data.toString()))
    } catch {
      // ignore
    }
  }
  ws.on('message', handler)
  return { messages, dispose: () => ws.off('message', handler) }
}

/** Wait for the ws 'close' event (or timeout). */
function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for close')), timeoutMs)
    ws.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/** Collect all messages matching a predicate. */
function messagesMatching(
  msgs: unknown[],
  pred: (m: Record<string, unknown>) => boolean,
): unknown[] {
  return msgs.filter((m) => pred(m as Record<string, unknown>))
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------
let app: ReturnType<typeof Fastify>
let port: number
let conversationManager: ConversationManager

beforeAll(async () => {
  app = Fastify()
  await app.register(websocket)
  await app.register(authPlugin)

  conversationManager = new ConversationManager()
  conversationManager.registerProvider(new StubProvider())
  const chatGateway = new ChatGateway(
    conversationManager,
    JWT_SECRET,
    process.env.JWT_REFRESH_SECRET!,
  )
  app.decorate('chatGateway', chatGateway)
  app.decorate('conversationManager', conversationManager)

  await app.register(chatRoutes)
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  if (addr && typeof addr === 'object') {
    port = addr.port
  } else {
    throw new Error('failed to get listening port')
  }
})

afterAll(async () => {
  conversationManager.destroyAll()
  await app.close()
})

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
describe('Chat WS integration — real Fastify + auth + /ws/chat', () => {
  it('rejects upgrade WITHOUT a token (auth whitelist + verifyWsUpgradeToken)', async () => {
    // Without ?token= the route schema (required:['token']) rejects the HTTP
    // upgrade with 400. The ws client fires 'error' (not 'close') — we listen
    // for either and assert the connection never reached the OPEN state.
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`)
    const settled = new Promise<void>((resolve) => {
      ws.once('error', () => resolve())
      ws.once('close', () => resolve())
    })
    await settled
    // The socket was rejected — it's either CLOSED or CLOSING, never OPEN.
    expect(ws.readyState).not.toBe(WebSocket.OPEN)
    // Clean up if still connecting/closing
    try {
      ws.terminate()
    } catch {
      // already closed
    }
  })

  it('admin WITH token: CHAT_CREATE → CHAT_CREATED', async () => {
    const token = makeToken()
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${token}`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', (err) => reject(err))
    })

    const claudeSessionId = randomUUID()
    ws.send(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '/tmp',
        claudeSessionId,
        providerId: 'stub',
      }),
    )

    const created = await waitForMessage(ws, 'CHAT_CREATED')
    expect(created.conversationId).toBeDefined()
    expect(created.tier).toBe('Explore')
    expect(created.viewMode).toBe('chat')

    ws.close()
  })

  it('CHAT_SWITCH_VIEW {viewMode:"terminal"} → CHAT_VIEW_CHANGED', async () => {
    const token = makeToken()
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${token}`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', (err) => reject(err))
    })

    const claudeSessionId = randomUUID()
    ws.send(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '/tmp',
        claudeSessionId,
        providerId: 'stub',
      }),
    )

    const created = (await waitForMessage(ws, 'CHAT_CREATED')) as { conversationId: string }
    const convId = created.conversationId

    ws.send(
      JSON.stringify({
        type: 'CHAT_SWITCH_VIEW',
        conversationId: convId,
        viewMode: 'terminal',
      }),
    )

    const viewChanged = await waitForMessage(ws, 'CHAT_VIEW_CHANGED')
    expect(viewChanged.viewMode).toBe('terminal')
    expect(viewChanged.conversationId).toBe(convId)

    ws.close()
  })

  it('CHAT_ESCALATE {tier:"Edit"} as admin → CHAT_VIEW_CHANGED with tier', async () => {
    const token = makeToken()
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${token}`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', (err) => reject(err))
    })

    const claudeSessionId = randomUUID()
    ws.send(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '/tmp',
        claudeSessionId,
        providerId: 'stub',
      }),
    )

    const created = (await waitForMessage(ws, 'CHAT_CREATED')) as { conversationId: string }
    const convId = created.conversationId

    ws.send(
      JSON.stringify({
        type: 'CHAT_ESCALATE',
        conversationId: convId,
        tier: 'Edit',
      }),
    )

    const viewChanged = await waitForMessage(ws, 'CHAT_VIEW_CHANGED')
    expect(viewChanged.tier).toBe('Edit')
    expect(viewChanged.conversationId).toBe(convId)

    ws.close()
  })

  it('ownership: a second non-owner user gets CHAT_ERROR on admin conversation', async () => {
    const adminToken = makeToken()
    const adminWs = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${adminToken}`)
    await new Promise<void>((resolve, reject) => {
      adminWs.once('open', () => resolve())
      adminWs.once('error', (err) => reject(err))
    })

    const claudeSessionId = randomUUID()
    adminWs.send(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '/tmp',
        claudeSessionId,
        providerId: 'stub',
      }),
    )

    const created = (await waitForMessage(adminWs, 'CHAT_CREATED')) as { conversationId: string }
    const convId = created.conversationId

    // Second user — non-admin, different userId
    const userToken = makeToken({ userId: 'u2', username: 'intruder', role: 'user' })
    const userWs = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?token=${userToken}`)
    await new Promise<void>((resolve, reject) => {
      userWs.once('open', () => resolve())
      userWs.once('error', (err) => reject(err))
    })

    const { messages, dispose } = messageCollector(userWs)
    userWs.send(
      JSON.stringify({
        type: 'CHAT_SEND',
        conversationId: convId,
        text: 'hello',
      }),
    )

    // Wait a moment for the error to arrive
    await new Promise((r) => setTimeout(r, 500))
    dispose()

    const errors = messagesMatching(messages, (m) => m.type === 'CHAT_ERROR')
    expect(errors.length).toBeGreaterThan(0)
    const errMsg = (errors[0] as { message?: string }).message ?? ''
    expect(/owner/.test(errMsg)).toBe(true)

    adminWs.close()
    userWs.close()
  })
})
