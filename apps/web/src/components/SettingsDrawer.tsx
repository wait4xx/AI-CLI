import { useState } from 'react'
import { Drawer } from 'vaul'
import { X, Minus, Plus, Terminal } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { TmuxManagerDrawer } from './TmuxManagerDrawer'

const { Root, Trigger, Portal, Overlay, Content, Title, Close } = Drawer

export function SettingsDrawer({ trigger }: { trigger: React.ReactNode }) {
  const fontSize = useSessionStore((s) => s.fontSize)
  const theme = useSessionStore((s) => s.theme)
  const activeAdapter = useSessionStore((s) => s.activeAdapter)
  const setFontSize = useSessionStore((s) => s.setFontSize)
  const setTheme = useSessionStore((s) => s.setTheme)
  const setActiveAdapter = useSessionStore((s) => s.setActiveAdapter)
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
        <Content className="fixed bottom-0 left-0 right-0 z-50 bg-dark-surface rounded-t-xl border-t border-dark-border max-h-[80vh]">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-600 mt-3" />

          <div className="flex items-center justify-between px-4 py-3">
            <Title className="text-sm font-semibold text-gray-100">Settings</Title>
            <Close asChild>
              <button className="p-1 text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </Close>
          </div>

          <div className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Font Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                  disabled={fontSize <= 10}
                  className="p-1.5 rounded bg-dark-border text-gray-300 hover:text-gray-100 disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-sm text-gray-100 tabular-nums">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                  disabled={fontSize >= 32}
                  className="p-1.5 rounded bg-dark-border text-gray-300 hover:text-gray-100 disabled:opacity-30"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Theme</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-dark-border text-gray-400 hover:text-gray-200'}`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-dark-border text-gray-400 hover:text-gray-200'}`}
                >
                  Light
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Adapter</span>
              <div className="flex gap-1">
                {adapters.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiveAdapter(a.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${activeAdapter === a.id ? 'bg-blue-600 text-white' : 'bg-dark-border text-gray-400 hover:text-gray-200'}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-dark-border">
            <button
              onClick={() => setTmuxManagerOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Terminal className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">Manage Tmux Sessions</p>
                <p className="text-xs text-gray-500">View, kill, rename all tmux sessions</p>
              </div>
            </button>
          </div>

          <div className="px-4 py-3 border-t border-dark-border">
            <p className="text-xs font-medium text-gray-400 mb-2">Keyboard Shortcuts</p>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Approve</span>
                <kbd className="px-1.5 py-0.5 rounded bg-dark-border text-gray-300">Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Deny</span>
                <kbd className="px-1.5 py-0.5 rounded bg-dark-border text-gray-300">n + Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel</span>
                <kbd className="px-1.5 py-0.5 rounded bg-dark-border text-gray-300">Ctrl+C</kbd>
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
