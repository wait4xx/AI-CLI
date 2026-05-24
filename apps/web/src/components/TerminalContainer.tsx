import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useDualChannelWS } from '../hooks/useDualChannelWS'
import { useAuth } from '../hooks/useAuth'
import { useSessionStore } from '../store/sessionStore'
import { MobileKeyboardAdapter } from '../adapters/MobileKeyboardAdapter'
import { GestureHandler, MIN_FONT_SIZE, MAX_FONT_SIZE } from '../lib/GestureHandler'
import { ConnectionOverlay } from './ConnectionOverlay'
import { QuickActionsPanel } from './QuickActionsPanel'
import '@xterm/xterm/css/xterm.css'

// Module-level terminal instance cache (ADR-011: never dispose)
const terminalCache = new Map<string, Terminal>()
const fitAddonCache = new Map<string, FitAddon>()

const XTERM_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
}

export function TerminalContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const keyboardAdapterRef = useRef<MobileKeyboardAdapter | null>(null)
  const gestureHandlerRef = useRef<GestureHandler | null>(null)
  const rendererTypeRef = useRef<'webgl' | 'canvas'>('webgl')

  const { accessToken, refreshToken: refreshTokenFn, logout } = useAuth()
  const {
    connect,
    disconnect,
    sendInput,
    sendResize,
    sendQuickAction,
    sendInjectCode,
    reconnectCount,
  } = useDualChannelWS(
    useCallback(() => useSessionStore.getState().accessToken, []),
    refreshTokenFn,
    logout,
  )

  const { sessionId, connectionPhase, isConnected, fontSize, setFontSize } = useSessionStore()

  // Expose sendInjectCode to store so App.tsx / CodeEditor can use it
  useEffect(() => {
    useSessionStore.setState({ sendInjectCode })
  }, [sendInjectCode])

  // Initialize terminal instance
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let term: Terminal
    let fitAddon: FitAddon

    // Check if we have a cached terminal for this session
    const cacheKey = sessionId || '__default'
    const cached = terminalCache.get(cacheKey)

    if (cached) {
      term = cached
      fitAddon = fitAddonCache.get(cacheKey)!
      container.appendChild(term.element!)
      fitAddon.fit()
    } else {
      term = new Terminal({
        theme: XTERM_THEME,
        fontSize,
        cursorBlink: true,
        scrollback: 5000,
        convertEol: true,
      })

      fitAddon = new FitAddon()

      // Load addons in order: WebGL → Canvas fallback (ADR-010)
      try {
        term.loadAddon(new WebglAddon())
        rendererTypeRef.current = 'webgl'
      } catch {
        try {
          term.loadAddon(new CanvasAddon())
          rendererTypeRef.current = 'canvas'
        } catch (e) {
          console.warn('[Terminal] Both WebGL and Canvas addons failed, using DOM renderer', e)
        }
      }

      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())

      term.open(container)
      fitAddon.fit()

      terminalCache.set(cacheKey, term)
      fitAddonCache.set(cacheKey, fitAddon)
    }

    termRef.current = term
    fitAddonRef.current = fitAddon

    // MobileKeyboardAdapter
    const keyboardAdapter = new MobileKeyboardAdapter(
      (data) => sendInput(data),
      (keyboardHeight) => {
        if (containerRef.current) {
          containerRef.current.style.paddingBottom = `${keyboardHeight}px`
          // Re-fit after keyboard appears
          setTimeout(() => fitAddonRef.current?.fit(), 50)
        }
      },
    )
    keyboardAdapter.attach(container)
    keyboardAdapterRef.current = keyboardAdapter

    // GestureHandler
    const gestureHandler = new GestureHandler(
      container,
      (delta) => {
        const currentSize = useSessionStore.getState().fontSize
        const newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentSize + delta))
        if (newSize !== currentSize) {
          setFontSize(newSize)
          const t = termRef.current
          if (t) t.options.fontSize = newSize
          fitAddonRef.current?.fit()
        }
      },
      (text) => sendInput(text),
    )
    gestureHandler.onPinchStart = () => keyboardAdapter.setSuppressFocus(true)
    gestureHandler.onPinchEnd = () => keyboardAdapter.setSuppressFocus(false)
    gestureHandler.attach()
    gestureHandlerRef.current = gestureHandler

    return () => {
      keyboardAdapter.destroy()
      gestureHandler.destroy()
      // ADR-011: removeChild, never dispose
      if (term.element && term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    }
  }, []) // Intentionally empty — terminal instance lives across renders

  // Sync fontSize changes from store to terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize
      fitAddonRef.current?.fit()
    }
  }, [fontSize])

  // Terminal data → WS input
  useEffect(() => {
    if (!termRef.current) return
    const disposable = termRef.current.onData((data) => {
      sendInput(data)
    })
    return () => disposable.dispose()
  }, [sendInput])

  // Terminal resize → WS resize (debounce is in useDualChannelWS, ADR-018)
  useEffect(() => {
    if (!termRef.current) return
    const disposable = termRef.current.onResize(({ cols, rows }) => {
      sendResize(cols, rows)
    })
    return () => disposable.dispose()
  }, [sendResize])

  // Window resize → fit
  useEffect(() => {
    function handleResize() {
      fitAddonRef.current?.fit()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Connect on mount when authenticated with session
  useEffect(() => {
    if (!termRef.current || !accessToken || !sessionId) return
    if (!isConnected && connectionPhase === 'DISCONNECTED') {
      const { cols, rows } = termRef.current
      connect(sessionId, cols, rows, termRef.current)
    }
  }, [accessToken, sessionId, isConnected, connectionPhase, connect])

  // visibilitychange: DOM detach/reattach (ADR-011)
  useEffect(() => {
    function handleVisibilityChange() {
      const term = termRef.current
      if (!term || !term.element) return

      if (document.hidden) {
        // Remove from DOM but keep instance alive
        if (term.element.parentNode) {
          term.element.parentNode.removeChild(term.element)
        }
      } else {
        // Re-attach and fit
        if (containerRef.current && !term.element.parentNode) {
          containerRef.current.appendChild(term.element)
          fitAddonRef.current?.fit()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cleanup on unmount — disconnect WS
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden"
        style={{ backgroundColor: XTERM_THEME.background }}
      />
      <ConnectionOverlay phase={connectionPhase} reconnectCount={reconnectCount} />
      <QuickActionsPanel onAction={sendQuickAction} />
    </div>
  )
}
