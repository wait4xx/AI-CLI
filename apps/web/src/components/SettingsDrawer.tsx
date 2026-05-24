import { Drawer } from 'vaul'
import { X, Minus, Plus } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const { Root, Trigger, Portal, Overlay, Content, Title, Close } = Drawer

export function SettingsDrawer({ trigger }: { trigger: React.ReactNode }) {
  const fontSize = useSessionStore((s) => s.fontSize)
  const theme = useSessionStore((s) => s.theme)
  const setFontSize = useSessionStore((s) => s.setFontSize)
  const setTheme = useSessionStore((s) => s.setTheme)

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
                <span className="w-8 text-center text-sm text-gray-100 tabular-nums">{fontSize}</span>
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
    </Root>
  )
}
