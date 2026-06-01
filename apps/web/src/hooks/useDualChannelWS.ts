import { useCallback, useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import {
  WS_CLOSE_CODE,
  TERM_PING,
  TERM_PONG,
  TERM_SERVER_PING,
  type ControlClientMessage,
  type ControlServerMessage,
} from '@ai-cli/shared'
import { useSessionStore } from '../store/sessionStore'
import { sendNotification } from '../lib/notifications'
import { OfflineCache } from '../lib/offlineCache'

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (() => {
    // Dev: use current host (Vite proxy forwards /ws → backend)
    // Prod: derive from page protocol
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}`
  })()
// 安全修复[C5]: 生产环境强制使用 wss://，非 HTTPS 时发出警告
if (import.meta.env.PROD && window.location.protocol === 'http:') {
  console.warn(
    '[安全警告] 当前页面使用 HTTP 协议，WebSocket 将以明文 ws:// 传输。' +
      '生产环境应始终使用 HTTPS 以确保 WebSocket 加密传输(wss://)。',
  )
}

// 安全修复[C7]: 运行时消息类型校验
const CONTROL_MSG_TYPES = new Set([
  'AUTH',
  'AUTH_OK',
  'ATTACH_SESSION',
  'INIT_SESSION',
  'RESIZE',
  'QUICK_ACTION',
  'INJECT_CODE',
  'OBSERVE_SESSION',
  'PING',
  'PONG',
  'STATUS_UPDATE',
  'SESSION_READY',
  'TOKEN_RENEWED',
  'ERROR',
  'SESSION_DESTROYED',
  'FILE_CHANGED',
  'RECORDING_DATA',
  'RECORDING_STATUS',
  'START_RECORDING',
  'STOP_RECORDING',
  'GET_RECORDING',
  'PANE_INFO',
  'LIST_PANES',
  'SELECT_PANE',
  // Multi-device
  'OBSERVER_MODE',
  'CONTROL_REQUESTED',
  'CONTROL_GRANTED',
  'CONTROL_REVOKED',
  'DEVICE_LIST',
  'KICKED',
  'REQUEST_CONTROL',
  'GRANT_CONTROL',
  'DENY_CONTROL',
  'FORCE_TAKE_CONTROL',
  'SHARE_SESSION',
  'UNSHARE_SESSION',
  'REQUEST_WRITE',
  'SESSION_SHARED',
  'SESSION_UNSHARED',
  'WRITE_REQUESTED',
  'WRITE_GRANTED',
  'SHARED_SESSIONS_LIST',
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

type ConnectionPhase = 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

interface UseDualChannelWS {
  connect: (
    sessionId: string,
    cols: number,
    rows: number,
    term: Terminal,
    attachToTmux?: string,
    cwd?: string,
  ) => void
  disconnect: () => void
  termWs: WebSocket | null
  ctrlWs: WebSocket | null
  reconnectCount: number
  isConnected: boolean
  connectionPhase: ConnectionPhase
  sendInput: (data: string | Uint8Array) => void
  sendResize: (cols: number, rows: number) => void
  sendQuickAction: (payload: string) => void
  sendInjectCode: (code: string) => void
  sendObserveSession: (sessionId: string) => void
  sendSelectPane: (paneIndex: number) => void
  sendListPanes: () => void
  sendRequestControl: () => void
  sendGrantControl: (requestId: string) => void
  sendDenyControl: (requestId: string) => void
  sendForceTakeControl: (sessionId: string) => void
}

export function useDualChannelWS(
  getAccessToken: () => string | null,
  getRefreshToken: () => Promise<string>,
  onAuthFailure: () => void,
): UseDualChannelWS {
  // [M4修复] ref 用于内部逻辑，state 用于 UI 显示
  const reconnectCountRef = useRef(0)
  const [reconnectCount, setReconnectCount] = useState(0)

  // Per-instance connection state (each panel has its own WS)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>('DISCONNECTED')

  // Refs for WS handlers — avoids stale closures in onclose callbacks
  // that capture the initial render's state values and never see updates.
  const isConnectedRef = useRef(false)
  const connectionPhaseRef = useRef<ConnectionPhase>('DISCONNECTED')

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

  // Update both local state (per-panel) and global store (for StatusBar backward compat)
  function updateConnection(phase: ConnectionPhase) {
    setConnectionPhase(phase)
    setIsConnected(phase === 'CONNECTED')
    isConnectedRef.current = phase === 'CONNECTED'
    connectionPhaseRef.current = phase
    store.getState().setConnected(phase)
  }

  function updateDisconnected() {
    setConnectionPhase('DISCONNECTED')
    setIsConnected(false)
    isConnectedRef.current = false
    connectionPhaseRef.current = 'DISCONNECTED'
    store.getState().setDisconnected()
  }

  function clearAllTimers() {
    if (termPingRef.current) {
      clearInterval(termPingRef.current)
      termPingRef.current = null
    }
    if (ctrlPingRef.current) {
      clearInterval(ctrlPingRef.current)
      ctrlPingRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current)
      resizeDebounceRef.current = null
    }
  }

  function closeSockets() {
    if (termWsRef.current) {
      termWsRef.current.onopen = null
      termWsRef.current.onmessage = null
      termWsRef.current.onclose = null
      termWsRef.current.onerror = null
      if (
        termWsRef.current.readyState === WebSocket.OPEN ||
        termWsRef.current.readyState === WebSocket.CONNECTING
      ) {
        termWsRef.current.close()
      }
      termWsRef.current = null
    }
    if (ctrlWsRef.current) {
      ctrlWsRef.current.onopen = null
      ctrlWsRef.current.onmessage = null
      ctrlWsRef.current.onclose = null
      ctrlWsRef.current.onerror = null
      if (
        ctrlWsRef.current.readyState === WebSocket.OPEN ||
        ctrlWsRef.current.readyState === WebSocket.CONNECTING
      ) {
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
        reconnectCountRef.current += 1
        setReconnectCount(reconnectCountRef.current)
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
      if (
        termWsRef.current.readyState === WebSocket.OPEN ||
        termWsRef.current.readyState === WebSocket.CONNECTING
      ) {
        termWsRef.current.close()
      }
      termWsRef.current = null
    }
    if (termPingRef.current) {
      clearInterval(termPingRef.current)
      termPingRef.current = null
    }

    // Reconnect terminal, keep control
    const token = getAccessToken()
    if (!token) {
      onAuthFailure()
      return
    }

    updateConnection('CONNECTING_TERM')
    const termWs = new WebSocket(`${WS_BASE}/ws/terminal?token=${encodeURIComponent(token)}`)
    termWs.binaryType = 'arraybuffer'
    termWsRef.current = termWs

    termWs.onopen = () => {
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
      updateConnection('CONNECTED')
      isConnectingRef.current = false
    }

    termWs.onclose = (event) => {
      if (termPingRef.current) {
        clearInterval(termPingRef.current)
        termPingRef.current = null
      }
      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
        window.location.reload()
        return
      }
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
        handleAuthFailureAndRetry()
        return
      }
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
      if (
        ctrlWsRef.current.readyState === WebSocket.OPEN ||
        ctrlWsRef.current.readyState === WebSocket.CONNECTING
      ) {
        ctrlWsRef.current.close()
      }
      ctrlWsRef.current = null
    }
    if (ctrlPingRef.current) {
      clearInterval(ctrlPingRef.current)
      ctrlPingRef.current = null
    }

    const token = getAccessToken()
    if (!token) {
      onAuthFailure()
      return
    }

    updateConnection('CONNECTING_CTRL')
    const ctrlWs = new WebSocket(`${WS_BASE}/ws/control?token=${encodeURIComponent(token)}`)
    ctrlWsRef.current = ctrlWs

    ctrlWs.onopen = () => {
      const init: ControlClientMessage = {
        type: 'INIT_SESSION',
        sessionId: s.sessionId,
        cols: s.cols,
        rows: s.rows,
        adapter:
          useSessionStore.getState().sessions.find((sess) => sess.id === s.sessionId)
            ?.adapterName ||
          useSessionStore.getState().activeAdapter ||
          'claude',
      }
      ctrlWs.send(JSON.stringify(init))
    }

    ctrlWs.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        const msg: ControlServerMessage = JSON.parse(event.data)
        if (!isValidControlMsg(msg)) {
          console.warn('[安全警告] 收到无效的控制消息类型，已丢弃:', msg)
          return
        }
        if (msg.type === 'SESSION_READY') {
          updateConnection('CONNECTED')
          isConnectingRef.current = false
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
          reconnectCountRef.current = 0
          setReconnectCount(0)
          startCtrlPing()
          return
        }
        handleCtrlMessage(msg)
      } catch {
        // Ignore — malformed control message, non-critical
      }
    }

    ctrlWs.onclose = (event) => {
      if (ctrlPingRef.current) {
        clearInterval(ctrlPingRef.current)
        ctrlPingRef.current = null
      }
      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
        window.location.reload()
        return
      }
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
        handleAuthFailureAndRetry()
        return
      }
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
        store.getState().setAgentStatus(data.status, data.options)
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
      case 'SESSION_DESTROYED':
        disconnect()
        store.getState().removeSessionById(data.sessionId)
        break
      case 'PONG':
        break
      case 'AUTH_OK':
        // Handled in connection flow — ignore stray
        break
      case 'SESSION_READY':
        // Handled in connection flow — ignore stray
        break
      case 'FILE_CHANGED':
        store
          .getState()
          .onFileChange?.({
            path: data.path,
            oldContent: data.oldContent,
            newContent: data.newContent,
          })
        break
      case 'PANE_INFO':
        store.getState().setTmuxPanes(data.panes)
        break
      case 'OBSERVER_MODE':
        store.getState().setObserverMode(data.sessionId, data.isObserver)
        break
      case 'CONTROL_REQUESTED':
        store
          .getState()
          .addControlRequest({
            requestId: data.requestId,
            deviceName: data.deviceName,
            username: data.username,
            sessionId: data.sessionId,
          })
        break
      case 'CONTROL_GRANTED':
        if (sessionRef.current)
          store.getState().setObserverMode(sessionRef.current.sessionId, false)
        break
      case 'CONTROL_REVOKED':
        if (sessionRef.current) store.getState().setObserverMode(sessionRef.current.sessionId, true)
        break
      case 'DEVICE_LIST':
        store.getState().setConnectedDevices(data.devices)
        break
      case 'KICKED':
        disconnect()
        break
    }
  }

  function connectInternal(
    sessionId: string,
    cols: number,
    rows: number,
    term: Terminal,
    attachToTmux?: string,
    cwd?: string,
  ) {
    if (isConnectingRef.current) return
    isConnectingRef.current = true

    updateConnection('CONNECTING_CTRL')

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

    // --- Control WS (connect FIRST to create session) ---
    const ctrlWs = new WebSocket(`${WS_BASE}/ws/control?token=${encodeURIComponent(token)}`)
    ctrlWsRef.current = ctrlWs

    ctrlWs.onopen = () => {
      const init: ControlClientMessage = {
        type: 'INIT_SESSION',
        sessionId,
        cols,
        rows,
        adapter:
          useSessionStore.getState().sessions.find((sess) => sess.id === sessionId)?.adapterName ||
          useSessionStore.getState().activeAdapter ||
          'claude',
        ...(attachToTmux ? { attachToTmux } : {}),
        ...(cwd ? { cwd } : {}),
      }
      ctrlWs.send(JSON.stringify(init))
    }

    ctrlWs.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        const msg: ControlServerMessage = JSON.parse(event.data)
        if (!isValidControlMsg(msg)) return

        if (msg.type === 'SESSION_READY') {
          // Session created — now connect terminal
          connectTerminalAfterSessionReady(token, sessionId, term)
          startCtrlPing()
          // Check for tmux panes
          setTimeout(() => {
            sendListPanes()
          }, 2000)
          return
        }
        handleCtrlMessage(msg)
      } catch {
        // Ignore malformed JSON
      }
    }

    ctrlWs.onclose = (event) => {
      if (ctrlPingRef.current) {
        clearInterval(ctrlPingRef.current)
        ctrlPingRef.current = null
      }
      if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
        window.location.reload()
        return
      }
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
        handleAuthFailureAndRetry()
        return
      }
      if (isConnectedRef.current) {
        reconnectCtrlOnly()
      } else if (connectionPhaseRef.current === 'CONNECTING_CTRL') {
        closeSockets()
        clearAllTimers()
        updateDisconnected()
        isConnectingRef.current = false
        scheduleReconnect()
      }
    }

    ctrlWs.onerror = () => {}

    // --- Terminal WS (deferred — will connect after SESSION_READY) ---
    function connectTerminalAfterSessionReady(tk: string, sid: string, t: Terminal) {
      updateConnection('CONNECTING_TERM')

      const termWs = new WebSocket(`${WS_BASE}/ws/terminal?token=${encodeURIComponent(tk)}`)
      termWs.binaryType = 'arraybuffer'
      termWsRef.current = termWs

      termWs.onopen = () => {
        const attach: ControlClientMessage = { type: 'ATTACH_SESSION', sessionId: sid }
        termWs.send(JSON.stringify(attach))

        termWs.onmessage = (ev) => {
          if (ev.data instanceof ArrayBuffer) {
            const buf = new Uint8Array(ev.data)
            if (buf.length === 1 && (buf[0] === TERM_PONG || buf[0] === TERM_SERVER_PING)) return
            t.write(buf)
            offlineCacheRef.current?.cacheScreen(new TextDecoder().decode(buf))
          }
        }

        startTermPing()
        updateConnection('CONNECTED')
        isConnectingRef.current = false
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        reconnectCountRef.current = 0
        setReconnectCount(0)

        if (offlineCacheRef.current?.hasQueuedInputs()) {
          offlineCacheRef.current.flushInputs((data) => sendInput(data))
        }
      }

      termWs.onclose = (event) => {
        if (termPingRef.current) {
          clearInterval(termPingRef.current)
          termPingRef.current = null
        }
        if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
          window.location.reload()
          return
        }
        if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
          handleAuthFailureAndRetry()
          return
        }
        if (isConnectedRef.current) {
          reconnectTermOnly()
        } else {
          scheduleReconnect()
        }
      }

      termWs.onerror = () => {}
    }
  }

  async function handleAuthFailureAndRetry() {
    // Pause reconnecting, try to refresh the token first
    closeSockets()
    clearAllTimers()
    updateDisconnected()
    isConnectingRef.current = false

    try {
      const newToken = await getRefreshToken()
      if (newToken) {
        const s = sessionRef.current
        const t = termRef.current
        if (s && t) {
          reconnectCountRef.current += 1
          setReconnectCount(reconnectCountRef.current)
          connectInternal(s.sessionId, s.cols, s.rows, t)
        }
      } else {
        onAuthFailure()
      }
    } catch {
      onAuthFailure()
    }
  }

  const connect = useCallback(
    (
      sessionId: string,
      cols: number,
      rows: number,
      term: Terminal,
      attachToTmux?: string,
      cwd?: string,
    ) => {
      // Reset reconnect state for a fresh connect
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      closeSockets()
      clearAllTimers()
      isConnectingRef.current = false
      connectInternal(sessionId, cols, rows, term, attachToTmux, cwd)
    },
    [],
  )

  const disconnect = useCallback(() => {
    sessionRef.current = null
    termRef.current = null
    closeSockets()
    clearAllTimers()
    isConnectingRef.current = false
    updateDisconnected()
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
    // [N3修复] 使用字节长度而非字符长度，中文字符 UTF-8 占 3 字节
    const MAX_INJECT_CODE_SIZE = 100 * 1024 // 100KB
    const byteLength = new TextEncoder().encode(code).length
    if (byteLength > MAX_INJECT_CODE_SIZE) {
      console.warn(
        `[安全警告] INJECT_CODE 内容超过 ${MAX_INJECT_CODE_SIZE} 字节限制 (${byteLength} bytes)，已拒绝发送`,
      )
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

  const sendSelectPane = useCallback((paneIndex: number) => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'SELECT_PANE', sessionId, paneIndex }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendListPanes = useCallback(() => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'LIST_PANES', sessionId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendRequestControl = useCallback(() => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'REQUEST_CONTROL', sessionId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendGrantControl = useCallback((requestId: string) => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'GRANT_CONTROL', sessionId, requestId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendDenyControl = useCallback((requestId: string) => {
    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = { type: 'DENY_CONTROL', sessionId, requestId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const sendForceTakeControl = useCallback((sessionId: string) => {
    const ws = ctrlWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ControlClientMessage = { type: 'FORCE_TAKE_CONTROL', sessionId }
      ws.send(JSON.stringify(msg))
    }
  }, [])

  // Wire pane functions to store (in useEffect to avoid render-time side effects)
  useEffect(() => {
    store.getState().sendSelectPane = sendSelectPane
    store.getState().sendListPanes = sendListPanes
  }, [sendSelectPane, sendListPanes])

  return {
    connect,
    disconnect,
    get termWs() {
      return termWsRef.current
    },
    get ctrlWs() {
      return ctrlWsRef.current
    },
    reconnectCount,
    isConnected,
    connectionPhase,
    sendInput,
    sendResize,
    sendQuickAction,
    sendInjectCode,
    sendObserveSession,
    sendSelectPane,
    sendListPanes,
    sendRequestControl,
    sendGrantControl,
    sendDenyControl,
    sendForceTakeControl,
  }
}
