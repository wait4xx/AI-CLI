import { useState } from 'react'
import { Drawer } from 'vaul'
import { X, Minus, Plus, Terminal } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'
import { TERMINAL_THEME_LIST } from '../lib/themes'
import { EDITOR_THEME_LIST } from './CodeEditor'
import { TmuxManagerDrawer } from './TmuxManagerDrawer'
import { UserManagerDrawer } from './UserManagerDrawer'

const { Root, Trigger, Portal, Overlay, Content, Title, Close } = Drawer

export function SettingsDrawer({ trigger }: { trigger: React.ReactNode }) {
  const fontSize = useSessionStore((s) => s.fontSize)
  const editorFontSize = useSessionStore((s) => s.editorFontSize)
  const uiTheme = useSessionStore((s) => s.uiTheme)
  const terminalTheme = useSessionStore((s) => s.terminalTheme)
  const editorTheme = useSessionStore((s) => s.editorTheme)
  const activeAdapter = useSessionStore((s) => s.activeAdapter)
  const setFontSize = useSessionStore((s) => s.setFontSize)
  const setEditorFontSize = useSessionStore((s) => s.setEditorFontSize)
  const setUiTheme = useSessionStore((s) => s.setUiTheme)
  const setEditorTheme = useSessionStore((s) => s.setEditorTheme)
  const setTerminalTheme = useSessionStore((s) => s.setTerminalTheme)
  const setActiveAdapter = useSessionStore((s) => s.setActiveAdapter)
  const ui = useUiTheme()
  const [tmuxManagerOpen, setTmuxManagerOpen] = useState(false)

  const adapters = [
    { id: 'claude', label: 'Claude' },
    { id: 'aider', label: 'Aider' },
    { id: 'shell', label: 'Shell' },
  ] as const

  return (
    <Root>
      <Trigger asChild>{trigger}</Trigger>
      <Portal>
        <Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Content
          className={`fixed bottom-0 left-0 right-0 z-50 ${ui.surface} rounded-t-xl border-t ${ui.border} max-h-[80vh]`}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-600 mt-3" />
          <div className="flex items-center justify-between px-4 py-3">
            <Title className={`text-sm font-semibold ${ui.text}`}>Settings</Title>
            <Close asChild>
              <button className={`p-1 ${ui.textMuted} ${ui.hover}`}>
                <X className="w-4 h-4" />
              </button>
            </Close>
          </div>
          <div className="px-4 pb-4 space-y-4">
            {/* Terminal Font Size */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${ui.text}`}>Terminal Font Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                  disabled={fontSize <= 10}
                  className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className={`w-8 text-center text-sm ${ui.text} tabular-nums`}>
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                  disabled={fontSize >= 32}
                  className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Editor Font Size */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${ui.text}`}>Editor Font Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))}
                  disabled={editorFontSize <= 10}
                  className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className={`w-8 text-center text-sm ${ui.text} tabular-nums`}>
                  {editorFontSize}
                </span>
                <button
                  onClick={() => setEditorFontSize(Math.min(32, editorFontSize + 1))}
                  disabled={editorFontSize >= 32}
                  className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interface Theme */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${ui.text}`}>Interface</span>
              <div className="flex gap-1">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setUiTheme(t)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${uiTheme === t ? 'bg-blue-600 text-white' : `${ui.border} ${ui.textMuted} ${ui.hover}`}`}
                  >
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Theme */}
            <div>
              <span className={`text-sm ${ui.text} block mb-2`}>Terminal Theme</span>
              <div className="grid grid-cols-3 gap-1.5">
                {TERMINAL_THEME_LIST.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTerminalTheme(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${terminalTheme === t.id ? 'bg-blue-600 text-white' : `${ui.hover} ${ui.textMuted}`}`}
                  >
                    <span className="flex gap-0.5 shrink-0">
                      {t.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor Theme */}
            <div>
              <span className={`text-sm ${ui.text} block mb-2`}>Editor Theme</span>
              <div className="grid grid-cols-3 gap-1.5">
                {EDITOR_THEME_LIST.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setEditorTheme(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${editorTheme === t.id ? 'bg-blue-600 text-white' : `${ui.hover} ${ui.textMuted}`}`}
                  >
                    <span className="flex gap-0.5 shrink-0">
                      {t.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full border border-white/20"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Adapter */}
            <div className="flex items-center justify-between">
              <span className={`text-sm ${ui.text}`}>Adapter</span>
              <div className="flex gap-1">
                {adapters.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiveAdapter(a.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${activeAdapter === a.id ? 'bg-blue-600 text-white' : `${ui.border} ${ui.textMuted} ${ui.hover}`}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`px-4 py-3 border-t ${ui.border}`}>
            <UserManagerDrawer />
          </div>

          <div className={`px-4 py-3 border-t ${ui.border}`}>
            <button
              onClick={() => setTmuxManagerOpen(true)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg ${ui.hover} ${ui.active} transition-colors text-left`}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Terminal className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${ui.text}`}>Manage Tmux Sessions</p>
                <p className={`text-xs ${ui.textDim}`}>View, kill, rename all tmux sessions</p>
              </div>
            </button>
          </div>

          <div className={`px-4 py-3 border-t ${ui.border}`}>
            <p className={`text-xs font-medium ${ui.textMuted} mb-2`}>Keyboard Shortcuts</p>
            <div className={`space-y-1.5 text-xs ${ui.textDim}`}>
              <div className="flex justify-between">
                <span>Approve</span>
                <kbd className={`px-1.5 py-0.5 rounded ${ui.border} ${ui.text}`}>Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Deny</span>
                <kbd className={`px-1.5 py-0.5 rounded ${ui.border} ${ui.text}`}>n + Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel</span>
                <kbd className={`px-1.5 py-0.5 rounded ${ui.border} ${ui.text}`}>Ctrl+C</kbd>
              </div>
            </div>
          </div>
          <div className="h-6" />
        </Content>
      </Portal>
      <TmuxManagerDrawer open={tmuxManagerOpen} onOpenChange={setTmuxManagerOpen} />
    </Root>
  )
}
