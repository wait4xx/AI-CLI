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

const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

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
    switch (data.type) {
      case 'STATUS_UPDATE':
        store.getState().setAgentStatus(data.status)
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
                // Skip PONG byte (0x01)
                if (buf.length === 1 && buf[0] === 0x01) return
                term.write(buf)
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

      // If we were CONNECTED, this is an unexpected close — full reconnect
      if (store.getState().isConnected || store.getState().connectionPhase === 'CONNECTING_CTRL') {
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
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'INJECT_CODE', sessionId, code }
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
  }
}
