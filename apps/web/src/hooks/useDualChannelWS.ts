import { useCallback, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import {
  PROTOCOL_VERSION,
  WS_CLOSE_CODE,
  TERM_PING,
  type ControlClientMessage,
  type ControlServerMessage,
} from '@ai-cli/shared'
import { useSessionStore } from '../store/sessionStore'
import { sendNotification } from '../lib/notifications'
import { OfflineCache } from '../lib/offlineCache'

const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
// 安全修复[C5]: 生产环境强制使用 wss://，非 HTTPS 时发出警告
if (import.meta.env.PROD && window.location.protocol === 'http:') {
  console.warn(
    '[安全警告] 当前页面使用 HTTP 协议，WebSocket 将以明文 ws:// 传输。' +
    '生产环境应始终使用 HTTPS 以确保 WebSocket 加密传输(wss://)。'
  )
}

// 安全修复[C7]: 运行时消息类型校验
const CONTROL_MSG_TYPES = new Set([
  'AUTH', 'AUTH_OK', 'ATTACH_SESSION', 'INIT_SESSION', 'RESIZE',
  'QUICK_ACTION', 'INJECT_CODE', 'OBSERVE_SESSION', 'PING', 'PONG',
  'STATUS_UPDATE', 'SESSION_READY', 'TOKEN_RENEWED', 'ERROR',
])

function isValidControlMsg(data: unknown): data is { type: string; [key: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.type !== 'string') return false
  if (!CONTROL_MSG_TYPES.has(obj.type)) return false
  return true
}

const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000
const PING_INTERVAL = 30_000
const RESIZE_DEBOUNCE = 200
const RESIZE_THROTTLE = 1_000

interface UseDualChannelWS {
  connect: (sessionId: string, cols: number, rows: number, term: Terminal) => void
  disconnect: () => void
  termWs: WebSocket | null
  ctrlWs: WebSocket | null
  reconnectCount: number
  sendInput: (data: string | Uint8Array) => void
  sendResize: (cols: number, rows: number) => void
  sendQuickAction: (payload: string) => void
  sendInjectCode: (code: string) => void
  sendObserveSession: (sessionId: string) => void
}

export function useDualChannelWS(
  getAccessToken: () => string | null,
  getRefreshToken: () => Promise<string>,
  onAuthFailure: () => void,
): UseDualChannelWS {
  const [reconnectCount, setReconnectCount] = useState(0)

  const termWsRef = useRef<WebSocket | null>(null)
  const ctrlWsRef = useRef<WebSocket | null>(null)
  const termPingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ctrlPingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const sessionRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResizeSentRef = useRef(0)
  const isConnectingRef = useRef(false)
  const offlineCacheRef = useRef<OfflineCache | null>(null)

  const store = useSessionStore

  function clearAllTimers() {
    if (termPingRef.current) { clearInterval(termPingRef.current); termPingRef.current = null }
    if (ctrlPingRef.current) { clearInterval(ctrlPingRef.current); ctrlPingRef.current = null }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    if (resizeDebounceRef.current) { clearTimeout(resizeDebounceRef.current); resizeDebounceRef.current = null }
  }

  function closeSockets() {
    if (termWsRef.current) {
      termWsRef.current.onopen = null
      termWsRef.current.onmessage = null
      termWsRef.current.onclose = null
      termWsRef.current.onerror = null
      if (termWsRef.current.readyState === WebSocket.OPEN || termWsRef.current.readyState === WebSocket.CONNECTING) {
        termWsRef.current.close()
      }
      termWsRef.current = null
    }
    if (ctrlWsRef.current) {
      ctrlWsRef.current.onopen = null
      ctrlWsRef.current.onmessage = null
      ctrlWsRef.current.onclose = null
      ctrlWsRef.current.onerror = null
      if (ctrlWsRef.current.readyState === WebSocket.OPEN || ctrlWsRef.current.readyState === WebSocket.CONNECTING) {
        ctrlWsRef.current.close()
      }
      ctrlWsRef.current = null
    }
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return

    const delay = reconnectDelayRef.current
    const jittered = delay * (0.5 + Math.random() * 0.5)
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY)

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      const s = sessionRef.current
      const t = termRef.current
      if (s && t) {
        setReconnectCount((c) => c + 1)
        connectInternal(s.sessionId, s.cols, s.rows, t)
      }
    }, jittered)
  }

  function reconnectTermOnly() {
    const s = sessionRef.current
    const t = termRef.current
    if (!s || !t) return

    // Close only terminal socket
    if (termWsRef.current) {
      termWsRef.current.onopen = null
      termWsRef.current.onmessage = null
      termWsRef.current.onclose = null
      termWsRef.current.onerror = null
      if (termWsRef.current.readyState === WebSocket.OPEN || termWsRef.current.readyState === WebSocket.CONNECTING) {
        termWsRef.current.close()
      }
      termWsRef.current = null
    }
    if (termPingRef.current) { clearInterval(termPingRef.current); termPingRef.current = null }

    // Reconnect terminal, keep control
    const token = getAccessToken()
    if (!token) { onAuthFailure(); return }

    store.getState().setConnected('CONNECTING_TERM')
    const termWs = new WebSocket(`${WS_BASE}/ws/terminal`)
    termWs.binaryType = 'arraybuffer'
    termWsRef.current = termWs

    termWs.onopen = () => {
      const auth: ControlClientMessage = {
        type: 'AUTH',
        accessToken: token,
        protocolVersion: PROTOCOL_VERSION,
      }
      termWs.send(JSON.stringify(auth))
    }

    termWs.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'AUTH_OK') {
            const attach: ControlClientMessage = { type: 'ATTACH_SESSION', sessionId: s.sessionId }
            termWs.send(JSON.stringify(attach))
            termWs.onmessage = (ev) => {
              if (ev.data instanceof ArrayBuffer) {
                const buf = new Uint8Array(ev.data)
                if (buf.length === 1 && buf[0] === 0x01) return
                t.write(buf)
              }
            }
            startTermPing()
            store.getState().setConnected('CONNECTED')
            isConnectingRef.current = false
            return
          }
        } catch {}
        return
      }
    }

    termWs.onclose = (event) => {
      if (termPingRef.current) { clearInterval(termPingRef.current); termPingRef.current = null }
      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) { window.location.reload(); return }
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) { handleAuthFailureAndRetry(); return }
      // Unexpected close — try again
      scheduleReconnect()
    }
  }

  function reconnectCtrlOnly() {
    const s = sessionRef.current
    if (!s) return

    // Close only control socket
    if (ctrlWsRef.current) {
      ctrlWsRef.current.onopen = null
      ctrlWsRef.current.onmessage = null
      ctrlWsRef.current.onclose = null
      ctrlWsRef.current.onerror = null
      if (ctrlWsRef.current.readyState === WebSocket.OPEN || ctrlWsRef.current.readyState === WebSocket.CONNECTING) {
        ctrlWsRef.current.close()
      }
      ctrlWsRef.current = null
    }
    if (ctrlPingRef.current) { clearInterval(ctrlPingRef.current); ctrlPingRef.current = null }

    const token = getAccessToken()
    if (!token) { onAuthFailure(); return }

    store.getState().setConnected('CONNECTING_CTRL')
    const ctrlWs = new WebSocket(`${WS_BASE}/ws/control`)
    ctrlWsRef.current = ctrlWs

    ctrlWs.onopen = () => {
      const auth: ControlClientMessage = {
        type: 'AUTH',
        accessToken: token,
        protocolVersion: PROTOCOL_VERSION,
      }
      ctrlWs.send(JSON.stringify(auth))
    }

    let authenticated = false
    ctrlWs.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        const msg: ControlServerMessage = JSON.parse(event.data)
        // 安全修复[C7]: 运行时校验消息类型
        if (!isValidControlMsg(msg)) {
          console.warn('[安全警告] 收到无效的控制消息类型，已丢弃:', msg)
          return
        }
        if (!authenticated) {
          if (msg.type === 'AUTH_OK') {
            authenticated = true
            const init: ControlClientMessage = {
              type: 'INIT_SESSION',
              sessionId: s.sessionId,
              cols: s.cols,
              rows: s.rows,
              adapter: 'claude',
            }
            ctrlWs.send(JSON.stringify(init))
            return
          }
          return
        }
        if (msg.type === 'SESSION_READY') {
          store.getState().setConnected('CONNECTED')
          isConnectingRef.current = false
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
          setReconnectCount(0)
          startCtrlPing()
          return
        }
        handleCtrlMessage(msg)
      } catch {}
    }

    ctrlWs.onclose = (event) => {
      if (ctrlPingRef.current) { clearInterval(ctrlPingRef.current); ctrlPingRef.current = null }
      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) { window.location.reload(); return }
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) { handleAuthFailureAndRetry(); return }
      scheduleReconnect()
    }
  }

  function startTermPing() {
    if (termPingRef.current) clearInterval(termPingRef.current)
    termPingRef.current = setInterval(() => {
      const ws = termWsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(new Uint8Array([TERM_PING]))
      }
    }, PING_INTERVAL)
  }

  function startCtrlPing() {
    if (ctrlPingRef.current) clearInterval(ctrlPingRef.current)
    ctrlPingRef.current = setInterval(() => {
      const ws = ctrlWsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        const msg: ControlClientMessage = { type: 'PING' }
        ws.send(JSON.stringify(msg))
      }
    }, PING_INTERVAL)
  }

  function handleCtrlMessage(data: ControlServerMessage) {
    // 安全修复[C7]: 二次校验（防御性编程）
    if (!isValidControlMsg(data)) return

    switch (data.type) {
      case 'STATUS_UPDATE':
        store.getState().setAgentStatus(data.status)
        store.getState().updateSessionStatus(data.sessionId, data.status)
        if (data.status === 'WAITING_APPROVAL' && document.hidden) {
          sendNotification('AI CLI', 'An action is waiting for your approval')
        }
        break
      case 'TOKEN_RENEWED':
        store.getState().setTokens(data.accessToken, store.getState().refreshToken ?? '')
        break
      case 'ERROR':
        console.error('[WS Control] Error:', data.message)
        break
      case 'PONG':
        break
      case 'AUTH_OK':
        // Handled in connection flow — ignore stray
        break
      case 'SESSION_READY':
        // Handled in connection flow — ignore stray
        break
    }
  }

  function connectInternal(sessionId: string, cols: number, rows: number, term: Terminal) {
    if (isConnectingRef.current) return
    isConnectingRef.current = true

    store.getState().setConnected('CONNECTING_TERM')

    const token = getAccessToken()
    if (!token) {
      isConnectingRef.current = false
      onAuthFailure()
      return
    }

    sessionRef.current = { sessionId, cols, rows }
    termRef.current = term

    // Initialize offline cache
    offlineCacheRef.current = new OfflineCache(sessionId)

    // --- Terminal WS ---
    const termWs = new WebSocket(`${WS_BASE}/ws/terminal`)
    termWs.binaryType = 'arraybuffer'
    termWsRef.current = termWs

    termWs.onopen = () => {
      const auth: ControlClientMessage = {
        type: 'AUTH',
        accessToken: token,
        protocolVersion: PROTOCOL_VERSION,
      }
      termWs.send(JSON.stringify(auth))
    }

    termWs.onmessage = (event) => {
      // Before binary mode switch, messages are JSON
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'AUTH_OK') {
            // Send ATTACH
            const attach: ControlClientMessage = { type: 'ATTACH_SESSION', sessionId }
            termWs.send(JSON.stringify(attach))

            // Switch to binary mode — subsequent messages are binary
            termWs.onmessage = (ev) => {
              if (ev.data instanceof ArrayBuffer) {
                const buf = new Uint8Array(ev.data)
                if (buf.length === 1 && buf[0] === 0x01) return
                term.write(buf)
                // Cache screen data for offline mode
                offlineCacheRef.current?.cacheScreen(new TextDecoder().decode(buf))
              }
            }

            startTermPing()

            // Terminal connected, now connect Control
            connectControl(token, sessionId, cols, rows)
            return
          }
        } catch {
          // Ignore malformed JSON
        }
        return
      }

      // Binary message before AUTH_OK — discard
      if (event.data instanceof ArrayBuffer) {
        const buf = new Uint8Array(event.data)
        if (buf.length === 1 && buf[0] === 0x01) return
        term.write(buf)
      }
    }

    termWs.onclose = (event) => {
      if (termPingRef.current) { clearInterval(termPingRef.current); termPingRef.current = null }

      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
        window.location.reload()
        return
      }

      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
        handleAuthFailureAndRetry()
        return
      }

      // Close ctrl if term failed during CONNECTING_TERM
      if (store.getState().connectionPhase === 'CONNECTING_TERM') {
        closeSockets()
        clearAllTimers()
        store.getState().setDisconnected()
        isConnectingRef.current = false
        scheduleReconnect()
      } else if (store.getState().isConnected) {
        // Terminal closed unexpectedly but control may still be up — reconnect only terminal
        reconnectTermOnly()
      }
    }

    termWs.onerror = () => {
      // onclose will handle cleanup
    }
  }

  function connectControl(token: string, sessionId: string, cols: number, rows: number) {
    store.getState().setConnected('CONNECTING_CTRL')

    const ctrlWs = new WebSocket(`${WS_BASE}/ws/control`)
    ctrlWsRef.current = ctrlWs

    ctrlWs.onopen = () => {
      const auth: ControlClientMessage = {
        type: 'AUTH',
        accessToken: token,
        protocolVersion: PROTOCOL_VERSION,
      }
      ctrlWs.send(JSON.stringify(auth))
    }

    let authenticated = false

    ctrlWs.onmessage = (event) => {
      if (typeof event.data !== 'string') return

      try {
        const msg: ControlServerMessage = JSON.parse(event.data)
        // 安全修复[C7]: 运行时校验消息类型
        if (!isValidControlMsg(msg)) {
          console.warn('[安全警告] 收到无效的控制消息类型，已丢弃:', msg)
          return
        }

        if (!authenticated) {
          if (msg.type === 'AUTH_OK') {
            authenticated = true
            const init: ControlClientMessage = {
              type: 'INIT_SESSION',
              sessionId,
              cols,
              rows,
              adapter: 'claude',
            }
            ctrlWs.send(JSON.stringify(init))
            return
          }
          // Discard non-AUTH_OK before auth
          return
        }

        if (msg.type === 'SESSION_READY') {
          // Both channels connected
          store.getState().setConnected('CONNECTED')
          store.getState().setSession(sessionId)
          isConnectingRef.current = false
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
          setReconnectCount(0)

          startCtrlPing()

          // Flush queued offline inputs on reconnect
          if (offlineCacheRef.current?.hasQueuedInputs()) {
            offlineCacheRef.current.flushInputs((data) => sendInput(data))
          }

          // Ctrl+L to trigger pty redraw on reconnect
          if (reconnectCount > 0) {
            const termWs = termWsRef.current
            if (termWs && termWs.readyState === WebSocket.OPEN) {
              termWs.send('\x0c')
            }
          }
          return
        }

        handleCtrlMessage(msg)
      } catch {
        // Ignore malformed JSON
      }
    }

    ctrlWs.onclose = (event) => {
      if (ctrlPingRef.current) { clearInterval(ctrlPingRef.current); ctrlPingRef.current = null }

      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
        window.location.reload()
        return
      }

      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
        handleAuthFailureAndRetry()
        return
      }

      // If connected, only reconnect control channel
      if (store.getState().isConnected) {
        reconnectCtrlOnly()
      } else if (store.getState().connectionPhase === 'CONNECTING_CTRL') {
        closeSockets()
        clearAllTimers()
        store.getState().setDisconnected()
        isConnectingRef.current = false
        scheduleReconnect()
      }
    }

    ctrlWs.onerror = () => {
      // onclose will handle cleanup
    }
  }

  async function handleAuthFailureAndRetry() {
    // Pause reconnecting, try to refresh the token first
    closeSockets()
    clearAllTimers()
    store.getState().setDisconnected()
    isConnectingRef.current = false

    try {
      const newToken = await getRefreshToken()
      if (newToken) {
        const s = sessionRef.current
        const t = termRef.current
        if (s && t) {
          setReconnectCount((c) => c + 1)
          connectInternal(s.sessionId, s.cols, s.rows, t)
        }
      } else {
        onAuthFailure()
      }
    } catch {
      onAuthFailure()
    }
  }

  const connect = useCallback((sessionId: string, cols: number, rows: number, term: Terminal) => {
    // Reset reconnect state for a fresh connect
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    closeSockets()
    clearAllTimers()
    isConnectingRef.current = false
    connectInternal(sessionId, cols, rows, term)
  }, [])

  const disconnect = useCallback(() => {
    sessionRef.current = null
    termRef.current = null
    closeSockets()
    clearAllTimers()
    isConnectingRef.current = false
    store.getState().setDisconnected()
  }, [])

  const sendInput = useCallback((data: string | Uint8Array) => {
    const ws = termWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    } else {
      // Queue input for offline mode
      offlineCacheRef.current?.queueInput(data)
    }
  }, [])

  const sendResize = useCallback((cols: number, rows: number) => {
    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current)
    }

    resizeDebounceRef.current = setTimeout(() => {
      const now = Date.now()
      if (now - lastResizeSentRef.current < RESIZE_THROTTLE) return
      lastResizeSentRef.current = now

      const ws = ctrlWsRef.current
      const sessionId = sessionRef.current?.sessionId
      if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
        const msg: ControlClientMessage = { type: 'RESIZE', sessionId, cols, rows }
        ws.send(JSON.stringify(msg))
      }

      if (sessionRef.current) {
        sessionRef.current.cols = cols
        sessionRef.current.rows = rows
      }
    }, RESIZE_DEBOUNCE)
  }, [])

  const sendQuickAction = useCallback((payload: string) => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'QUICK_ACTION', sessionId, payload }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendInjectCode = useCallback((code: string) => {
    // 安全修复[C9]: 限制注入代码长度为 100KB，防止过大 payload
    const MAX_INJECT_CODE_SIZE = 100 * 1024 // 100KB
    if (code.length > MAX_INJECT_CODE_SIZE) {
      console.warn(`[安全警告] INJECT_CODE 内容超过 ${MAX_INJECT_CODE_SIZE} 字节限制 (${code.length} bytes)，已拒绝发送`)
      return
    }

    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'INJECT_CODE', sessionId, code }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendObserveSession = useCallback((sessionId: string) => {
    const ws = ctrlWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ControlClientMessage = { type: 'OBSERVE_SESSION', sessionId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  return {
    connect,
    disconnect,
    get termWs() { return termWsRef.current },
    get ctrlWs() { return ctrlWsRef.current },
    reconnectCount,
    sendInput,
    sendResize,
    sendQuickAction,
    sendInjectCode,
    sendObserveSession,
  }
}
