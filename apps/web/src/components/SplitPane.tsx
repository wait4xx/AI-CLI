import { useCallback, useRef, useEffect, Suspense, lazy, Fragment } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { PanelFrame } from './PanelFrame'
import { ChatTransport } from './ChatTransport'
import type { SplitNode, SplitContainer, SplitDirection } from '../lib/splitLayout'
import { isContainer } from '../lib/splitLayout'

const CodeEditor = lazy(() => import('./CodeEditor').then((m) => ({ default: m.CodeEditor })))
const TerminalContainer = lazy(() =>
  import('./TerminalContainer').then((m) => ({ default: m.TerminalContainer })),
)
const ChatView = lazy(() => import('./chat/ChatView').then((m) => ({ default: m.ChatView })))

interface SplitPaneProps {
  node: SplitNode
}

export function SplitPane({ node }: SplitPaneProps) {
  return (
    <>
      <ChatTransport />
      {isContainer(node) ? (
        <SplitContainerView container={node} />
      ) : (
        <PanelContent panelId={node.id} panelType={node.type} />
      )}
    </>
  )
}

function SplitContainerView({ container }: { container: SplitContainer }) {
  const updateSplitRatios = useSessionStore((s) => s.updateSplitRatios)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleResize = useCallback(
    (childIndex: number, delta: number) => {
      const el = containerRef.current
      if (!el) return

      const isHorizontal = container.direction === 'horizontal'
      const totalSize = isHorizontal ? el.offsetHeight : el.offsetWidth
      if (totalSize === 0) return

      const deltaRatio = delta / totalSize
      const newRatios = [...container.ratios]
      const toIdx = childIndex + 1
      if (toIdx >= newRatios.length) return

      const minRatio = 0.1
      const totalPair = newRatios[childIndex] + newRatios[toIdx]
      newRatios[childIndex] = Math.max(
        minRatio,
        Math.min(totalPair - minRatio, newRatios[childIndex] + deltaRatio),
      )
      newRatios[toIdx] = totalPair - newRatios[childIndex]

      updateSplitRatios(container.id, newRatios)
    },
    [container.id, container.direction, container.ratios, updateSplitRatios],
  )

  const isHorizontal = container.direction === 'horizontal'
  const flexDir = isHorizontal ? 'flex-col' : 'flex-row'

  return (
    <div ref={containerRef} className={`flex ${flexDir} h-full w-full overflow-hidden`}>
      {container.children.map((child, i) => (
        <Fragment key={child.id}>
          <div
            style={{ [isHorizontal ? 'height' : 'width']: `${container.ratios[i] * 100}%` }}
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <SplitPane node={child} />
          </div>
          {i < container.children.length - 1 && (
            <ResizeHandle
              direction={container.direction}
              onResize={(delta) => handleResize(i, delta)}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function ResizeHandle({
  direction,
  onResize,
}: {
  direction: SplitDirection
  onResize: (delta: number) => void
}) {
  const isHorizontal = direction === 'horizontal'
  const startPosRef = useRef(0)
  const draggingRef = useRef(false)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = isHorizontal ? e.clientY - startPosRef.current : e.clientX - startPosRef.current
      onResize(delta)
      startPosRef.current = isHorizontal ? e.clientY : e.clientX
    }
    const onMouseUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      const delta = isHorizontal
        ? e.touches[0].clientY - startPosRef.current
        : e.touches[0].clientX - startPosRef.current
      onResize(delta)
      startPosRef.current = isHorizontal ? e.touches[0].clientY : e.touches[0].clientX
    }
    const onTouchEnd = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isHorizontal, onResize])

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    draggingRef.current = true
    startPosRef.current = isHorizontal
      ? 'touches' in e
        ? e.touches[0].clientY
        : e.clientY
      : 'touches' in e
        ? e.touches[0].clientX
        : e.clientX
    document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      className={`shrink-0 ${
        isHorizontal
          ? 'h-1.5 cursor-row-resize hover:bg-blue-500/30 active:bg-blue-500/50 border-y border-[#292e42]'
          : 'w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 border-x border-[#292e42]'
      } transition-colors`}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    />
  )
}

function PanelContent({
  panelId,
  panelType,
}: {
  panelId: string
  panelType: 'editor' | 'terminal'
}) {
  const removePanel = useSessionStore((s) => s.removePanel)
  const removeFileFromPanel = useSessionStore((s) => s.removeFileFromPanel)

  if (panelType === 'terminal') {
    return (
      <PanelFrame panelId={panelId} panelType="terminal">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Loading terminal...
            </div>
          }
        >
          <TerminalPanel panelId={panelId} />
        </Suspense>
      </PanelFrame>
    )
  }

  // Editor panel
  const panelFiles = useSessionStore((s) => s.panelFiles[panelId])
  const files = panelFiles?.files ?? []
  const activeFilePath = panelFiles?.activeFilePath ?? null
  const activeFile = activeFilePath ? (files.find((f) => f.path === activeFilePath) ?? null) : null

  if (!activeFile) {
    return (
      <PanelFrame panelId={panelId} panelType="editor">
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          No file open
        </div>
      </PanelFrame>
    )
  }

  return (
    <PanelFrame panelId={panelId} panelType="editor">
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Loading editor...
          </div>
        }
      >
        <CodeEditor
          key={activeFile.path}
          filePath={activeFile.path}
          content={activeFile.content}
          language={activeFile.language}
          onClose={() => {
            removeFileFromPanel(panelId, activeFile.path)
            if (files.length <= 1) removePanel(panelId)
          }}
          onInjectCode={(code: string) => useSessionStore.getState().sendInjectCode?.(code)}
          onOpenFile={(path, content, language, replace) => {
            const store = useSessionStore.getState()
            if (replace) {
              const currentFiles = store.panelFiles[panelId]?.files ?? []
              const newFiles = currentFiles.map((f) =>
                f.path === activeFilePath ? { path, content, language } : f,
              )
              useSessionStore.setState({
                panelFiles: {
                  ...store.panelFiles,
                  [panelId]: { files: newFiles, activeFilePath: path },
                },
              })
            } else {
              store.addFileToPanel(panelId, { path, content, language })
            }
          }}
        />
      </Suspense>
    </PanelFrame>
  )
}

// Each terminal panel reads its assigned session from terminalSessions map.
// Tab clicks assign sessions to the focused panel via activePanelId.
//
// The active panel hosts the hybrid chat when the active conversation's
// viewMode === 'chat'. ChatTransport (mounted once at the SplitPane top)
// owns the single /ws/chat connection regardless of which panel hosts
// ChatView; switching to terminal kills the server-side chat process, and
// the persistent WS lets us send CHAT_SWITCH_VIEW back to respawn it.
function TerminalPanel({ panelId }: { panelId: string }) {
  const sessionId = useSessionStore((s) => s.terminalSessions[panelId])
  const activePanelId = useSessionStore((s) => s.activePanelId)
  const activeConv = useSessionStore(
    (s) => s.conversations.find((c) => c.conversationId === s.activeConversationId) ?? null,
  )

  const isChatHost = activePanelId === panelId && activeConv?.viewMode === 'chat'
  if (isChatHost) {
    return (
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Loading chat…
            </div>
          }
        >
          <ChatView />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {activeConv && activePanelId === panelId && activeConv.viewMode === 'terminal' && (
        <button
          onClick={() => useSessionStore.getState().chatSwitchView?.('chat')}
          className="shrink-0 border-b border-[#292e42] bg-blue-600/20 px-3 py-1.5 text-left text-xs text-blue-300 hover:bg-blue-600/30"
        >
          ← 返回对话
        </button>
      )}
      <div className="relative min-h-0 flex-1">
        {sessionId ? (
          <TerminalContainer panelId={panelId} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 select-none">
            Click a tab to assign terminal
          </div>
        )}
      </div>
    </div>
  )
}
