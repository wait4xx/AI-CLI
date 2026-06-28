import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import { useDualChannelWS } from '../hooks/useDualChannelWS'
import { useAuth } from '../hooks/useAuth'
import { useSessionStore } from '../store/sessionStore'
import { findNode } from '../lib/splitLayout'
import { MobileKeyboardAdapter } from '../adapters/MobileKeyboardAdapter'
import { GestureHandler, MIN_FONT_SIZE, MAX_FONT_SIZE } from '../lib/GestureHandler'
import { ConnectionOverlay } from './ConnectionOverlay'
import { OfflineCache } from '../lib/offlineCache'
import { QuickActionsPanel } from './QuickActionsPanel'
import { getTerminalTheme, toXtermTheme } from '../lib/themes'
import '@xterm/xterm/css/xterm.css'

// Module-level terminal instance cache (ADR-011: never dispose)
const terminalCache = new Map<string, Terminal>()
const fitAddonCache = new Map<string, FitAddon>()

interface TerminalContainerProps {
  panelId: string
}

export function TerminalContainer({ panelId }: TerminalContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const keyboardAdapterRef = useRef<MobileKeyboardAdapter | null>(null)
  const gestureHandlerRef = useRef<GestureHandler | null>(null)
  const offlineCacheRef = useRef<OfflineCache | null>(null)

  const sendSGRScrollRef = useRef<(direction: 'up' | 'down', lines: number) => void>(() => {})

  const { accessToken, refreshToken: refreshTokenFn, logout } = useAuth()
  const {
    connect,
    disconnect,
    sendInput,
    sendResize,
    sendQuickAction,
    sendInjectCode,
    sendSelectPane,
    sendListPanes,
    sendRequestControl,
    sendGrantControl,
    sendDenyControl,
    sendForceTakeControl,
    reconnectCount,
    isConnected,
    connectionPhase,
  } = useDualChannelWS(
    useCallback(() => useSessionStore.getState().accessToken, []),
    refreshTokenFn,
    logout,
  )

  const fontSize = useSessionStore((s) => s.fontSize)
  const setFontSize = useSessionStore((s) => s.setFontSize)
  const terminalTheme = useSessionStore((s) => s.terminalTheme)
  const activeAdapter = useSessionStore((s) => s.activeAdapter)
  const tmuxPanes = useSessionStore((s) => s.tmuxPanes)

  const sessionId = useSessionStore((s) => s.terminalSessions[panelId] ?? null)
  const isObserver = useSessionStore((s) => s.observerSessions[sessionId ?? ''] ?? false)

  useEffect(() => {
    if (panelId === 'terminal-main') {
      useSessionStore.setState({
        sendInjectCode,
        sendGrantControl,
        sendDenyControl,
        sendRequestControl,
        sendForceTakeControl,
      })
    }
  }, [
    sendInjectCode,
    sendGrantControl,
    sendDenyControl,
    sendRequestControl,
    sendForceTakeControl,
    panelId,
  ])

  useEffect(() => {
    offlineCacheRef.current = new OfflineCache(sessionId || undefined)
  }, [sessionId])

  // Initialize terminal instance
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let term: Terminal
    let fitAddon: FitAddon

    const cacheKey = panelId
    const cached = terminalCache.get(cacheKey)

    if (cached && !('isDisposed' in cached && (cached as { isDisposed?: boolean }).isDisposed)) {
      term = cached
      fitAddon = fitAddonCache.get(cacheKey)!
      if (term.element && !term.element.parentElement) {
        container.appendChild(term.element)
      }
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
        } catch {
          /* terminal not fully ready yet */
        }
      })
    } else {
      if (cached) {
        terminalCache.delete(cacheKey)
        fitAddonCache.delete(cacheKey)
      }
      term = new Terminal({
        theme: toXtermTheme(getTerminalTheme(terminalTheme)),
        fontFamily: "'JetBrains Mono', 'Smiley Sans', Menlo, Consolas, monospace",
        fontSize,
        cursorBlink: true,
        // 默认 1000，原生滚动条已通过 CSS + wheel 拦截隐藏，无需靠小 buffer
        scrollback: 1000,
        convertEol: true,
        scrollSensitivity: 1,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(container)

      // Best-effort GPU renderer: try WebGL, fall back to Canvas, then default DOM
      try {
        term.loadAddon(new WebglAddon())
      } catch {
        try {
          term.loadAddon(new CanvasAddon())
        } catch {
          /* fall back to default DOM renderer */
        }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit()
          } catch {
            /* may fail in StrictMode double-invoke */
          }
        })
      })

      terminalCache.set(cacheKey, term)
      fitAddonCache.set(cacheKey, fitAddon)
    }

    termRef.current = term
    fitAddonRef.current = fitAddon

    // 彻底抹杀 xterm 原生滚动条
    const styleId = 'xterm-hide-scrollbar-' + panelId
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        [data-panel-id="${panelId}"] .xterm-scrollbar { display: none !important; }
        [data-panel-id="${panelId}"] .xterm-viewport { 
          overflow-y: hidden !important; 
          scrollbar-width: none !important; 
        }
        [data-panel-id="${panelId}"] .xterm-viewport::-webkit-scrollbar { 
          display: none !important; 
        }
      `
      document.head.appendChild(style)
    }
    container.dataset.panelId = panelId

    const keyboardAdapter = new MobileKeyboardAdapter(
      () => {},
      (keyboardHeight) => {
        if (containerRef.current) {
          containerRef.current.style.paddingBottom = `${keyboardHeight}px`
          setTimeout(() => fitAddonRef.current?.fit(), 50)
        }
      },
    )
    if (term.textarea) {
      keyboardAdapter.setXtermTextarea(term.textarea)
    }
    keyboardAdapter.attach(container)
    keyboardAdapterRef.current = keyboardAdapter

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

    // 在最外层 container 上拦截 wheel 事件，确保 100% 截断 xterm 的原生处理
    const handleWheelCapture = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const lines = Math.max(1, Math.min(Math.abs(Math.round(e.deltaY / 40)), 10))
      sendSGRScrollRef.current(e.deltaY < 0 ? 'up' : 'down', lines)
    }

    container.addEventListener('wheel', handleWheelCapture, { passive: false, capture: true })

    return () => {
      const style = document.getElementById('xterm-hide-scrollbar-' + panelId)
      if (style) style.remove()
      keyboardAdapter.destroy()
      gestureHandler.destroy()
      container.removeEventListener('wheel', handleWheelCapture, {
        capture: true,
      } as EventListenerOptions)
      if (term.element && term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    }
  }, [])

  useEffect(() => {
    const t = termRef.current
    if (t && !('isDisposed' in t && (t as { isDisposed?: boolean }).isDisposed)) {
      t.options.fontSize = fontSize
      try {
        fitAddonRef.current?.fit()
      } catch {
        /* may fail */
      }
    }
  }, [fontSize])

  useEffect(() => {
    const t = termRef.current
    if (t && !('isDisposed' in t && (t as { isDisposed?: boolean }).isDisposed)) {
      t.options.theme = toXtermTheme(getTerminalTheme(terminalTheme))
      try {
        fitAddonRef.current?.fit()
      } catch {
        /* may fail */
      }
    }
  }, [terminalTheme])

  useEffect(() => {
    if (!termRef.current) return
    const disposable = termRef.current.onData((data) => {
      sendInput(data)
    })
    return () => disposable.dispose()
  }, [sendInput])

  useEffect(() => {
    if (!termRef.current) return
    const disposable = termRef.current.onResize(({ cols, rows }) => {
      sendResize(cols, rows)

      if (virtualScrollRef.current > 0) {
        setTimeout(() => {
          sendSGRScrollRef.current('up', 1)
        }, 50)
      }
    })
    return () => disposable.dispose()
  }, [sendResize])

  useEffect(() => {
    function handleResize() {
      fitAddonRef.current?.fit()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit()
      } catch {
        /* may fail */
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const accessTokenRef = useRef(accessToken)
  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

  const prevAdapterRef = useRef<string | null>(null)
  const prevSessionIdRef = useRef<string | null | undefined>(undefined)
  const adapterSwitchIdRef = useRef<string | null>(null)

  useEffect(() => {
    const adapterChanged = prevAdapterRef.current !== activeAdapter
    const sessionChanged = prevSessionIdRef.current !== sessionId
    prevAdapterRef.current = activeAdapter
    prevSessionIdRef.current = sessionId

    if (!sessionChanged && !adapterChanged) return

    if (termRef.current) {
      termRef.current.clear()
    }

    if (adapterChanged && panelId === 'terminal-main') {
      const newSessionId = crypto.randomUUID()
      adapterSwitchIdRef.current = newSessionId
      useSessionStore
        .getState()
        .setSession(newSessionId, undefined, undefined, undefined, activeAdapter)
      return
    }

    if (adapterSwitchIdRef.current === sessionId) {
      adapterSwitchIdRef.current = null
    }

    if (isConnected || connectionPhase !== 'DISCONNECTED') {
      disconnect()
    }
  }, [activeAdapter, sessionId, isConnected, connectionPhase, disconnect, panelId])

  useEffect(() => {
    if (!accessToken || !sessionId || isConnected) return
    const term = termRef.current
    if (!term) return

    try {
      fitAddonRef.current?.fit()
    } catch {
      /* may fail */
    }

    const { cols, rows } = term
    if (cols >= 2 && rows >= 2) {
      const currentSession = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
      connect(sessionId, cols, rows, term, currentSession?.attachToTmux, currentSession?.cwd)
      return
    }

    let cancelled = false
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        fitAddonRef.current?.fit()
      } catch {
        /* may fail */
      }
      const t = termRef.current
      if (!t || t.cols < 2 || t.rows < 2) {
        requestAnimationFrame(() => {
          if (cancelled) return
          try {
            fitAddonRef.current?.fit()
          } catch {
            /* may fail */
          }
          const t2 = termRef.current
          if (!t2 || t2.cols < 2 || t2.rows < 2) return
          const cs = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
          connect(sessionId, t2.cols, t2.rows, t2, cs?.attachToTmux, cs?.cwd)
        })
        return
      }
      const currentSession = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
      connect(sessionId, t.cols, t.rows, t, currentSession?.attachToTmux, currentSession?.cwd)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [accessToken, sessionId, isConnected, connect])

  useEffect(() => {
    if (isConnected) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit()
        } catch {
          /* may fail */
        }
      })
    }
  }, [isConnected])

  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(() => {
      sendListPanes()
    }, 5000)
    return () => clearInterval(interval)
  }, [isConnected, sendListPanes])

  useEffect(() => {
    function handleVisibilityChange() {
      const term = termRef.current
      if (!term || !term.element) return

      if (document.hidden) {
        if (term.element.parentNode) {
          term.element.parentNode.removeChild(term.element)
        }
      } else {
        if (containerRef.current && !term.element.parentNode) {
          const prevCols = term.cols
          const prevRows = term.rows
          containerRef.current.appendChild(term.element)
          requestAnimationFrame(() => {
            try {
              fitAddonRef.current?.fit()
              if (term.cols !== prevCols || term.rows !== prevRows) {
                sendResize(term.cols, term.rows)
              }
              term.refresh(0, term.rows - 1)
            } catch {
              /* may fail */
            }
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [sendResize])

  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      requestAnimationFrame(() => {
        if (!unmountedRef.current) return
        disconnect()
        const { splitRoot } = useSessionStore.getState()
        const panelStillExists = findNode(splitRoot, panelId)
        if (!panelStillExists) {
          const cached = terminalCache.get(panelId)
          if (
            cached &&
            !('isDisposed' in cached && (cached as { isDisposed?: boolean }).isDisposed)
          ) {
            try {
              cached.dispose()
            } catch {
              /* may fail */
            }
            terminalCache.delete(panelId)
            fitAddonCache.delete(panelId)
          }
        }
      })
    }
  }, [disconnect, panelId])

  // --- Custom scrollbar: self-managed virtual scroll for tmux ---
  const THUMB_HEIGHT_PCT = 20
  const thumbRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const virtualScrollRef = useRef(0)
  const MAX_VIRTUAL_SCROLL = 500
  const [, forceUpdate] = useState(0)
  const rafIdRef = useRef(0)

  const updateThumbFromVirtual = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => forceUpdate((n) => n + 1))
  }, [])

  const sendSGRScroll = useCallback(
    (direction: 'up' | 'down', lines: number) => {
      const term = termRef.current
      if (!term || lines <= 0) return

      const col = Math.ceil(term.cols / 2)
      const row = Math.ceil(term.rows / 2)

      // 当已经到底部，且继续向下滚时，发送 ESC 强制退出 copy mode
      if (direction === 'down' && virtualScrollRef.current === 0) {
        sendInput('\x1b')
        return
      }

      const seq = direction === 'up' ? `\x1b[<64;${col};${row}M` : `\x1b[<65;${col};${row}M`
      for (let i = 0; i < lines; i++) sendInput(seq)

      if (direction === 'up') {
        virtualScrollRef.current = Math.min(MAX_VIRTUAL_SCROLL, virtualScrollRef.current + lines)
      } else {
        virtualScrollRef.current = Math.max(0, virtualScrollRef.current - lines)
      }
      updateThumbFromVirtual()
    },
    [sendInput, updateThumbFromVirtual],
  )

  useEffect(() => {
    sendSGRScrollRef.current = sendSGRScroll
  }, [sendSGRScroll])

  const handleScrollPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const thumb = thumbRef.current
      if (!thumb) return
      thumb.setPointerCapture(e.pointerId)
      let lastY = e.clientY

      const onMove = (ev: PointerEvent) => {
        const deltaY = ev.clientY - lastY
        lastY = ev.clientY

        const trackH = trackRef.current?.clientHeight || 1
        const linesFromDelta = Math.abs(deltaY) / (trackH / MAX_VIRTUAL_SCROLL)

        if (deltaY < 0 && linesFromDelta >= 0.5) {
          const lines = Math.max(1, Math.min(Math.round(linesFromDelta), 10))
          sendSGRScroll('up', lines)
        } else if (deltaY > 0 && linesFromDelta >= 0.5) {
          const lines = Math.max(1, Math.min(Math.round(linesFromDelta), 10))
          sendSGRScroll('down', lines)
        }
      }

      const onUp = () => {
        thumb.removeEventListener('pointermove', onMove)
        thumb.removeEventListener('pointerup', onUp)
        thumb.removeEventListener('pointercancel', onUp)
      }
      thumb.addEventListener('pointermove', onMove)
      thumb.addEventListener('pointerup', onUp)
      thumb.addEventListener('pointercancel', onUp)
    },
    [sendSGRScroll],
  )

  const handleTrackWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const lines = Math.max(1, Math.min(Math.abs(Math.round(e.deltaY / 40)), 10))
      sendSGRScroll(e.deltaY < 0 ? 'up' : 'down', lines)
    },
    [sendSGRScroll],
  )

  const thumbTop =
    virtualScrollRef.current === 0
      ? 100 - THUMB_HEIGHT_PCT
      : (100 - THUMB_HEIGHT_PCT) * (1 - virtualScrollRef.current / MAX_VIRTUAL_SCROLL)

  return (
    <div className="absolute inset-0 flex flex-col">
      {tmuxPanes.length > 1 && (
        <div className="flex items-center gap-0.5 px-1 py-1 bg-[#1a1b26] border-b border-[#292e42] overflow-x-auto shrink-0 scrollbar-hide">
          {tmuxPanes.map((p) => (
            <button
              key={p.index}
              onClick={() => sendSelectPane(p.index)}
              className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                p.active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {p.title || `Pane ${p.index + 1}`}
            </button>
          ))}
        </div>
      )}
      {isObserver && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-600/20 border-b border-amber-600/30 text-amber-300 text-xs shrink-0">
          <span>Read-only mode — another device is controlling this terminal</span>
          <button
            onClick={() => useSessionStore.getState().sendRequestControl?.()}
            className="px-2 py-0.5 rounded bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 text-xs transition-colors"
          >
            Request Control
          </button>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ backgroundColor: getTerminalTheme(terminalTheme).background }}
        />
        <div
          ref={trackRef}
          className="absolute right-0 top-0 bottom-0 w-2.5 group"
          onWheel={handleTrackWheel}
          style={{ touchAction: 'none', zIndex: 10 }}
        >
          <div className="absolute inset-0 rounded-l bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
          <div
            ref={thumbRef}
            className="absolute left-0.5 right-0.5 rounded-sm bg-white/0 group-hover:bg-white/30 active:bg-white/50 transition-colors duration-200"
            style={{
              height: `${THUMB_HEIGHT_PCT}%`,
              bottom: `${100 - thumbTop - THUMB_HEIGHT_PCT}%`,
            }}
            onPointerDown={handleScrollPointerDown}
          />
        </div>
      </div>
      <ConnectionOverlay
        phase={connectionPhase}
        reconnectCount={reconnectCount}
        cachedScreen={offlineCacheRef.current?.getCachedScreen()}
      />
      <QuickActionsPanel onAction={sendQuickAction} />
    </div>
  )
}
