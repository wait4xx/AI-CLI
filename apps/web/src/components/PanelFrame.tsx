import { useState } from 'react'
import { X, Plus, Columns2, Rows2, Terminal, FileText } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import type { PanelType } from '../lib/splitLayout'

interface PanelFrameProps {
  panelId: string
  panelType: PanelType
  children: React.ReactNode
}

export function PanelFrame({ panelId, panelType, children }: PanelFrameProps) {
  const theme = useSessionStore((s) => s.uiTheme)
  const panelFiles = useSessionStore((s) => s.panelFiles[panelId])
  const terminalSessions = useSessionStore((s) => s.terminalSessions)
  const sessions = useSessionStore((s) => s.sessions)
  const activePanelId = useSessionStore((s) => s.activePanelId)
  const { removePanel, setActiveFile, removeFileFromPanel, splitPanel, setActivePanelId } =
    useSessionStore()

  const isDark = theme === 'dark'
  const border = isDark ? 'border-[#292e42]' : 'border-[#e0e0e0]'
  const bgPanel = isDark ? 'bg-[#16161e]' : 'bg-[#f0f0f0]'
  const textPrimary = isDark ? 'text-gray-200' : 'text-gray-800'
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500'
  const hoverBg = isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'

  const [showSplitMenu, setShowSplitMenu] = useState(false)

  const files = panelFiles?.files ?? []
  const activeFilePath = panelFiles?.activeFilePath ?? null

  // Look up session info for terminal panels — show UUID prefix for matching with session manager
  const sessionLabel =
    panelType === 'terminal'
      ? (() => {
          const sid = terminalSessions[panelId]
          if (!sid) return null
          const session = sessions.find((s) => s.id === sid)
          const shortId = sid.slice(0, 8)
          return session?.label ? `${session.label} (${shortId})` : shortId
        })()
      : null

  const isActive = panelId === activePanelId

  return (
    <div
      data-panel-id={panelId}
      onClick={() => setActivePanelId(panelId)}
      className={`flex flex-col h-full relative ${isActive ? 'ring-1 ring-blue-500/50' : ''}`}
    >
      {/* Tab bar */}
      <div className={`flex items-center h-[32px] border-b ${border} ${bgPanel} shrink-0`}>
        <div className={`flex items-center px-1 ${textMuted} shrink-0`}>
          {panelType === 'terminal' ? (
            <Terminal className="w-3 h-3" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
        </div>

        {/* Scrollable content: session label + file tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0 scrollbar-hide px-0.5">
          {panelType === 'terminal' && sessionLabel && (
            <span
              data-drag-session={terminalSessions[panelId]}
              className={`px-2 py-0.5 text-xs shrink-0 cursor-grab ${isDark ? 'bg-[#292e42] text-gray-200' : 'bg-[#e0e0e0] text-gray-800'} rounded font-mono`}
            >
              {sessionLabel}
            </span>
          )}

          {files.map((f) => {
            const name = f.path.split('/').pop() || f.path
            const isActive = f.path === activeFilePath
            return (
              <button
                key={f.path}
                data-drag-file={f.path}
                data-drag-source-panel={panelId}
                onClick={() => setActiveFile(panelId, f.path)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors shrink-0 cursor-grab ${
                  isActive
                    ? isDark
                      ? 'bg-[#292e42] text-gray-200'
                      : 'bg-[#e0e0e0] text-gray-800'
                    : `${textMuted} ${hoverBg}`
                }`}
              >
                <span className="truncate max-w-[100px]">{name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFileFromPanel(panelId, f.path)
                    if (files.length <= 1) removePanel(panelId)
                  }}
                  className={`ml-0.5 p-0.5 rounded ${hoverBg}`}
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </button>
            )
          })}
        </div>

        {/* Fixed buttons — outside overflow container so dropdown is not clipped */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSplitMenu(!showSplitMenu)}
            className={`p-1 rounded ${hoverBg} transition-colors`}
            aria-label="Split panel"
          >
            <Plus className={`w-3 h-3 ${textMuted}`} />
          </button>
          {showSplitMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSplitMenu(false)} />
              <div
                className={`absolute right-0 top-full mt-1 ${isDark ? 'bg-[#24283b] border-gray-700' : 'bg-white border-gray-300'} border rounded-lg shadow-xl py-1 min-w-[160px] z-50`}
              >
                <div className={`px-3 py-1 text-[10px] ${textMuted} uppercase tracking-wider`}>
                  New Split
                </div>
                <button
                  onClick={() => {
                    splitPanel(panelId, 'vertical', 'terminal')
                    setShowSplitMenu(false)
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${textPrimary} ${hoverBg}`}
                >
                  <Columns2 className="w-3.5 h-3.5" /> Terminal Right
                </button>
                <button
                  onClick={() => {
                    splitPanel(panelId, 'horizontal', 'terminal')
                    setShowSplitMenu(false)
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${textPrimary} ${hoverBg}`}
                >
                  <Rows2 className="w-3.5 h-3.5" /> Terminal Below
                </button>
                <div className={`my-1 border-t ${border}`} />
                <button
                  onClick={() => {
                    splitPanel(panelId, 'vertical', 'editor')
                    setShowSplitMenu(false)
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${textPrimary} ${hoverBg}`}
                >
                  <Columns2 className="w-3.5 h-3.5" /> Editor Right
                </button>
                <button
                  onClick={() => {
                    splitPanel(panelId, 'horizontal', 'editor', true)
                    setShowSplitMenu(false)
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${textPrimary} ${hoverBg}`}
                >
                  <Rows2 className="w-3.5 h-3.5" /> Editor Above
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => removePanel(panelId)}
          className={`p-1 rounded ${hoverBg} transition-colors shrink-0`}
          aria-label="Close panel"
        >
          <X className={`w-3 h-3 ${textMuted}`} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">{children}</div>
    </div>
  )
}
