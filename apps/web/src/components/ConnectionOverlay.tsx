import { memo } from 'react'
import { Loader2 } from 'lucide-react'

interface ConnectionOverlayProps {
  phase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'
  reconnectCount: number
  cachedScreen?: string
}

const phaseLabels: Record<string, string> = {
  DISCONNECTED: '连接已断开',
  CONNECTING_TERM: '正在连接终端通道...',
  CONNECTING_CTRL: '正在连接控制通道...',
  CONNECTED: '已连接',
}

export const ConnectionOverlay = memo(function ConnectionOverlay({ phase, reconnectCount, cachedScreen }: ConnectionOverlayProps) {
  if (phase === 'CONNECTED') return null

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
      {/* Cached screen background (dimmed) */}
      {cachedScreen && reconnectCount > 0 && (
        <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap p-2">{cachedScreen}</pre>
        </div>
      )}
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex flex-col items-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
        <p className="text-white text-sm font-medium">{phaseLabels[phase]}</p>
        {reconnectCount > 0 && (
          <p className="text-gray-400 text-xs mt-1">第 {reconnectCount} 次重连</p>
        )}
      </div>
    </div>
  )
})
